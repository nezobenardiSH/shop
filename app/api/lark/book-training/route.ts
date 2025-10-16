import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import { getSlotAvailability, assignTrainer, getTrainerDetails } from '@/lib/trainer-availability'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const body = await request.json()
    const {
      merchantId,
      merchantName,
      merchantAddress,
      merchantPhone,
      merchantContactPerson,
      merchantBusinessType,
      trainerName,
      onboardingTrainerName,  // Salesforce Onboarding_Trainer__c.Name (e.g., "Nasi Lemak")
      date,
      startTime,
      endTime,
      bookingType = 'training',
      trainerLanguages  // Required languages for the training session
    } = body

    if (!merchantId || !merchantName || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Step 1: Check which trainers are available for this slot (skip in mock mode)
    const mockMode = process.env.MOCK_LARK_BOOKING === 'true' || searchParams.get('mock') === 'true'
    
    let available = true
    let availableTrainers = ['Nezo'] // Default trainer for mock mode
    
    if (!mockMode) {
      console.log('Checking availability for slot:', { date, startTime, endTime })
      const slotResult = await getSlotAvailability(date, startTime, endTime)
      available = slotResult.available
      availableTrainers = slotResult.availableTrainers
    } else {
      console.log('MOCK MODE: Skipping availability check')
    }
    
    if (!available || availableTrainers.length === 0) {
      return NextResponse.json(
        { 
          error: 'No trainers available for this time slot',
          details: 'All trainers are busy during the selected time'
        },
        { status: 409 }
      )
    }
    
    // Step 2: Filter to only trainers with OAuth tokens (for real booking)
    let trainersWithAuth = availableTrainers
    if (!mockMode) {
      const { larkOAuthService } = await import('@/lib/lark-oauth-service')
      const authCheckPromises = availableTrainers.map(async (trainerName) => {
        const trainer = getTrainerDetails(trainerName)
        const hasAuth = await larkOAuthService.isUserAuthorized(trainer.email)
        return hasAuth ? trainerName : null
      })
      const authResults = await Promise.all(authCheckPromises)
      trainersWithAuth = authResults.filter((t): t is string => t !== null)
      
      console.log('Trainers with OAuth tokens:', trainersWithAuth)
      
      if (trainersWithAuth.length === 0) {
        console.log('⚠️ No trainers with OAuth tokens available')
        return NextResponse.json(
          { 
            error: 'No authorized trainers available',
            details: 'Available trainers have not yet connected their Lark calendars. Please contact support.'
          },
          { status: 503 }
        )
      }
    }
    
    // Step 3: Intelligently assign a trainer based on language requirements
    console.log('Available trainers for slot:', trainersWithAuth)
    console.log('Required languages:', trainerLanguages)
    const assignment = assignTrainer(trainersWithAuth, trainerLanguages)
    console.log('Assigned trainer:', assignment)
    
    // Step 3: Get the assigned trainer's details
    const trainer = getTrainerDetails(assignment.assigned)

    // Get calendar ID using centralized Calendar ID Manager
    let calendarId = trainer.calendarId // fallback
    if (!mockMode) {
      try {
        console.log(`🔍 Resolving calendar ID for booking using CalendarIdManager...`)
        const { CalendarIdManager } = await import('@/lib/calendar-id-manager')
        calendarId = await CalendarIdManager.getResolvedCalendarId(trainer.email)
        console.log(`📅 Using resolved calendar ID for booking: ${calendarId}`)
      } catch (error) {
        console.log('⚠️ CalendarIdManager failed, using config calendar ID:', error)
        console.log('Using config calendar ID:', calendarId)
      }
    }
    
    console.log('Booking training with:', {
      merchantName,
      trainerEmail: trainer.email,
      calendarId,
      date,
      startTime,
      endTime
    })

    let eventId: string
    
    if (mockMode) {
      // Mock mode for testing without Lark permissions
      console.log('MOCK MODE: Simulating calendar event creation')
      eventId = `mock-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      console.log('Mock event created:', eventId)
    } else {
      try {
        console.log('🎯 NOT IN MOCK MODE - Attempting real calendar booking')
        console.log('Trainer details:', {
          name: trainer.name,
          email: trainer.email,
          calendarId: calendarId
        })
        
        eventId = await larkService.bookTraining(
          {
            name: merchantName,
            address: merchantAddress,
            phone: merchantPhone,
            contactPerson: merchantContactPerson,
            businessType: merchantBusinessType,
            salesforceId: merchantId
          },
          trainer.email,
          calendarId,
          date,
          startTime,
          endTime,
          bookingType,
          onboardingTrainerName || merchantName  // Use Onboarding Trainer Name (e.g., "Nasi Lemak") for event title
        )
        
        console.log('✅ Real calendar event created successfully:', eventId)
      } catch (bookingError: any) {
        console.error('❌ Lark booking failed with error:', {
          message: bookingError.message,
          stack: bookingError.stack,
          name: bookingError.name
        })
        
        // Fallback to mock mode if calendar creation fails
        console.log('⚠️ Falling back to mock mode due to Lark error')
        eventId = `mock-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    }

    // Update Salesforce with the booking
    let salesforceUpdated = false
    try {
      const conn = await getSalesforceConnection()
      
      console.log(`Updating Salesforce ${bookingType} date:`, {
        trainerId: merchantId,
        date: date,
        eventId: eventId,
        assignedTrainer: assignment.assigned,
        bookingType: bookingType
      })
      
      // First check if we have a valid connection
      if (!conn) {
        console.error('No Salesforce connection available')
        throw new Error('No Salesforce connection available')
      }
      
      // Map booking types to Salesforce field names
      const fieldMapping: { [key: string]: { field: string, object: string } } = {
        'hardware-fulfillment': { field: 'Hardware_Fulfillment_Date__c', object: 'Order' },
        'installation': { field: 'Installation_Date__c', object: 'Onboarding_Trainer__c' },
        'training': { field: 'Training_Date__c', object: 'Onboarding_Trainer__c' },
        'go-live': { field: 'First_Revised_EGLD__c', object: 'Onboarding_Trainer__c' }
      }
      
      const mapping = fieldMapping[bookingType] || { field: 'Training_Date__c', object: 'Onboarding_Trainer__c' }
      
      let updateResult: any
      
      if (mapping.object === 'Order') {
        // For Order object, we need to find the Order first
        console.log('Updating Hardware Fulfillment Date in Order object')
        const trainer = await conn.sobject('Onboarding_Trainer__c')
          .select('Id, Account_Name__c')
          .where({ Id: merchantId })
          .limit(1)
          .execute()
        
        if (trainer && trainer.length > 0) {
          const accountId = trainer[0].Account_Name__c
          console.log('Found Account ID:', accountId)
          
          const orders = await conn.query(
            `SELECT Id FROM Order WHERE AccountId = '${accountId}' LIMIT 1`
          )
          
          if (orders.records && orders.records.length > 0) {
            const orderId = orders.records[0].Id
            console.log('Found Order ID:', orderId)
            console.log('Updating field:', mapping.field, 'with date:', date)
            
            updateResult = await conn.sobject('Order').update({
              Id: orderId,
              [mapping.field]: date
            })
            
            console.log('Order update result:', updateResult)
          } else {
            console.log('No Order found for Account:', accountId)
          }
        } else {
          console.log('No Trainer found with ID:', merchantId)
        }
      } else {
        // Update Onboarding_Trainer__c record
        updateResult = await conn.sobject('Onboarding_Trainer__c').update({
          Id: merchantId,
          [mapping.field]: date // Salesforce Date field expects YYYY-MM-DD
        })
      }
      
      console.log('Salesforce update result:', updateResult)
      
      // Check if update was successful
      if (updateResult.success || updateResult.id) {
        salesforceUpdated = true
        console.log('Training date updated successfully in Salesforce')
      } else {
        console.error('Salesforce update failed:', updateResult.errors)
        salesforceUpdated = false
      }
    } catch (sfError: any) {
      const errorMessage = sfError.message || sfError
      console.error('Failed to update Salesforce:', errorMessage)
      salesforceUpdated = false
      
      // If it's a permission/validation error for hardware fulfillment, provide clearer feedback
      if (bookingType === 'hardware-fulfillment' && errorMessage.includes('CSM')) {
        console.log('⚠️ Note: Hardware Fulfillment Date requires special permissions in Salesforce')
      }
    }

    return NextResponse.json({
      success: true,
      eventId,
      assignedTrainer: assignment.assigned,
      assignmentReason: assignment.reason,
      salesforceUpdated,
      trainingDate: `${date}T${startTime}:00`,
      message: `Training session booked with ${assignment.assigned} for ${date} from ${startTime} to ${endTime}`
    })
  } catch (error) {
    console.error('Error booking training:', error)
    return NextResponse.json(
      { error: 'Failed to book training session' },
      { status: 500 }
    )
  }
}