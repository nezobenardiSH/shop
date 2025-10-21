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
      trainerLanguages,  // Required languages for the training session
      onboardingServicesBought,  // To determine if onsite or remote training
      existingEventId  // Event ID of existing booking to be cancelled (for rescheduling)
    } = body

    console.log('📥 Booking request received:', {
      merchantId,
      merchantName,
      date,
      startTime,
      endTime,
      bookingType,
      existingEventId: existingEventId || 'NONE (new booking)',
      existingEventIdLength: existingEventId ? existingEventId.length : 0,
      isRescheduling: !!existingEventId
    })

    // Warn if event ID is too long for Salesforce
    if (existingEventId && existingEventId.length > 20) {
      console.warn('⚠️ WARNING: Existing event ID is too long for Salesforce (max 20 chars):', {
        eventId: existingEventId,
        length: existingEventId.length,
        note: 'Rescheduling may fail - Salesforce field needs to be expanded'
      })
    }

    if (!merchantId || !merchantName || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Step 1: Determine if location filtering should be applied
    const { detectServiceType, shouldFilterByLocation } = await import('@/lib/service-type-detector')
    const serviceType = detectServiceType(onboardingServicesBought)
    const filterByLocation = shouldFilterByLocation(serviceType, bookingType)

    console.log('🔍 Service Type Detection:', {
      onboardingServicesBought,
      serviceType,
      filterByLocation,
      merchantAddress
    })

    // Step 2: Check which trainers are available for this slot (skip in mock mode)
    const mockMode = process.env.MOCK_LARK_BOOKING === 'true' || searchParams.get('mock') === 'true'

    let available = true
    let availableTrainers = ['Nezo'] // Default trainer for mock mode

    if (!mockMode) {
      console.log('Checking availability for slot:', { date, startTime, endTime })

      // Pass merchantAddress only if location filtering should be applied (onsite training)
      const addressForFiltering = filterByLocation ? merchantAddress : undefined
      const slotResult = await getSlotAvailability(date, startTime, endTime, addressForFiltering)
      available = slotResult.available
      availableTrainers = slotResult.availableTrainers

      console.log(`📊 Availability check result: ${availableTrainers.length} trainers available`)
      console.log(`   Service type: ${serviceType}`)
      console.log(`   Location filtering: ${filterByLocation ? 'YES' : 'NO'}`)
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
    
    // Step 3: Filter to only trainers with OAuth tokens (for real booking)
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
    
    // Step 4: Intelligently assign a trainer based on language requirements
    console.log('Available trainers for slot:', trainersWithAuth)
    console.log('Required languages:', trainerLanguages)
    const assignment = assignTrainer(trainersWithAuth, trainerLanguages)
    console.log('Assigned trainer:', assignment)
    
    // Step 5: Get the assigned trainer's details
    const trainer = getTrainerDetails(assignment.assigned)
    console.log('Trainer details from getTrainerDetails:', {
      assignedName: assignment.assigned,
      fullName: trainer.name,
      email: trainer.email
    })

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
      endTime,
      existingEventId
    })

    // Step 5.5: If this is a reschedule (existingEventId provided), delete the old event first
    if (existingEventId && !mockMode) {
      try {
        console.log('🗑️ Rescheduling detected - cancelling existing event:', existingEventId)
        await larkService.cancelTraining(
          trainer.email,
          calendarId,
          existingEventId,
          merchantName
        )
        console.log('✅ Successfully cancelled existing event')
      } catch (cancelError) {
        console.error('⚠️ Failed to cancel existing event:', cancelError)
        // Continue with new booking even if cancellation fails
        // The old event might have already been deleted or may not exist
      }
    }

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
        'pos-training': { field: 'POS_Training_Date__c', object: 'Onboarding_Trainer__c' },
        'backoffice-training': { field: 'Training_Date__c', object: 'Onboarding_Trainer__c' }, // BackOffice uses Training_Date__c (Date only field)
        'go-live': { field: 'First_Revised_EGLD__c', object: 'Onboarding_Trainer__c' }
      }

      const mapping = fieldMapping[bookingType] || { field: 'Training_Date__c', object: 'Onboarding_Trainer__c' }

      console.log('📋 Field mapping for bookingType:', bookingType, '→', mapping)
      
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
        // For DateTime fields, we need to include the time in ISO format
        const dateTimeValue = `${date}T${startTime}:00+08:00` // Singapore timezone

        console.log('Updating Salesforce field:', mapping.field)
        console.log('Date value:', date)
        console.log('DateTime value:', dateTimeValue)

        // Prepare update object with training date
        let fieldValue: string
        if (bookingType === 'backoffice-training' || bookingType === 'training') {
          // Training_Date__c is a Date field, not DateTime
          fieldValue = date // Just the date, no time
          console.log('Using date only for Training_Date__c field')
        } else {
          // POS_Training_Date__c and other fields are DateTime
          fieldValue = dateTimeValue
          console.log('Using datetime for field:', mapping.field)
        }
        
        const updateData: any = {
          Id: merchantId,
          [mapping.field]: fieldValue
        }

        // Store the Lark event ID based on booking type
        const eventIdFieldMapping: { [key: string]: string } = {
          'installation': 'Installation_Event_Id__c',
          'training': 'Training_Event_Id__c',           // BackOffice training
          'pos-training': 'POS_Training_Event_Id__c',
          'backoffice-training': 'Training_Event_Id__c' // Same as 'training'
        }

        const eventIdField = eventIdFieldMapping[bookingType]
        if (eventIdField) {
          console.log(`📝 Storing event ID in field ${eventIdField}: ${eventId}`)
          console.log(`📏 Event ID length: ${eventId.length} characters`)

          if (eventId.length > 50) {
            console.error(`❌ CRITICAL: Event ID is ${eventId.length} characters, but Salesforce field max is 50!`)
            console.error(`   Event ID will NOT be saved to Salesforce`)
            console.error(`   Please ask Salesforce admin to increase ${eventIdField} field length`)
          }

          updateData[eventIdField] = eventId
        }

        // Update the appropriate CSM field based on booking type
        // CSM_Name__c and CSM_Name_BO__c are lookup fields to User (internal Salesforce users)
        console.log('📝 Attempting to set CSM fields for trainer:', trainer.name, '(', trainer.email, ')')
        console.log('📝 Booking type:', bookingType)

        // Search for User (internal Salesforce user) using trainer info from trainers.json
        try {
          let userId: string | null = null

          // Search by email first (most reliable), then by name
          const searchQuery = `SELECT Id, Name, Email FROM User WHERE Email = '${trainer.email}' OR Name = '${trainer.name}' LIMIT 1`
          console.log('🔍 Searching for User with query:', searchQuery)
          const searchResult = await conn.query(searchQuery)
          console.log('🔍 User search result:', JSON.stringify(searchResult, null, 2))

          if (searchResult.records && searchResult.records.length > 0) {
            userId = searchResult.records[0].Id
            console.log('✅ Found User:', {
              id: userId,
              name: searchResult.records[0].Name,
              email: searchResult.records[0].Email
            })
          } else {
            console.log('❌ No User found for trainer:', trainer.name, '/', trainer.email)
            console.log('   CSM fields cannot be set without a valid User in Salesforce')
            console.log('   Make sure the trainer has a Salesforce User account with email:', trainer.email)
          }

          // If we have a User ID, update the appropriate CSM field
          if (userId) {
            if (bookingType === 'pos-training') {
              updateData.CSM_Name__c = userId
              console.log('📝 Setting CSM_Name__c (POS) to User ID:', userId)
            } else if (bookingType === 'backoffice-training' || bookingType === 'training') {
              updateData.CSM_Name_BO__c = userId
              console.log('📝 Setting CSM_Name_BO__c (BackOffice) to User ID:', userId)
            }
          } else {
            console.log('⚠️ Could not get User ID for trainer, CSM fields will not be updated')
          }
        } catch (userError: any) {
          console.log('❌ Error searching for User for CSM fields:', userError.message)
          console.log('   CSM fields will not be updated, but training date will still be saved')
        }

        console.log('📦 Final update data being sent to Salesforce:', JSON.stringify(updateData, null, 2))
        console.log('Update data keys:', Object.keys(updateData))
        console.log('CSM_Name_BO__c value:', updateData.CSM_Name_BO__c)
        
        // Try to update with User ID first
        try {
          updateResult = await conn.sobject('Onboarding_Trainer__c').update(updateData)
          console.log('✅ Successfully updated Salesforce with data:', JSON.stringify(updateResult, null, 2))
        } catch (updateError: any) {
          console.log('⚠️ Failed to update with User ID:', updateError.message)

          // If the CSM field update fails (likely due to invalid User ID),
          // retry without the CSM field to at least update the training date and event ID
          if (updateError.message && (updateError.message.includes('CSM') || updateError.message.includes('User'))) {
            console.log('Retrying without CSM field update...')
            const updateDataWithoutCSM: any = {
              Id: merchantId,
              [mapping.field]: fieldValue
            }

            // Also include the event ID if it was in the original update data
            const eventIdField = eventIdFieldMapping[bookingType]
            if (eventIdField && updateData[eventIdField]) {
              updateDataWithoutCSM[eventIdField] = updateData[eventIdField]
              console.log(`📝 Including event ID in retry: ${eventIdField} = ${updateData[eventIdField]}`)
            }

            updateResult = await conn.sobject('Onboarding_Trainer__c').update(updateDataWithoutCSM)
            console.log('✅ Successfully updated training date and event ID (without CSM field)')
          } else {
            throw updateError
          }
        }
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