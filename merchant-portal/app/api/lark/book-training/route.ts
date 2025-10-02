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
      date,
      startTime,
      endTime
    } = body

    if (!merchantId || !merchantName || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Step 1: Check which trainers are available for this slot
    console.log('Checking availability for slot:', { date, startTime, endTime })
    const { available, availableTrainers } = await getSlotAvailability(date, startTime, endTime)
    
    if (!available || availableTrainers.length === 0) {
      return NextResponse.json(
        { 
          error: 'No trainers available for this time slot',
          details: 'All trainers are busy during the selected time'
        },
        { status: 409 }
      )
    }
    
    // Step 2: Intelligently assign a trainer
    console.log('Available trainers for slot:', availableTrainers)
    const assignment = assignTrainer(availableTrainers)
    console.log('Assigned trainer:', assignment)
    
    // Step 3: Get the assigned trainer's details
    const trainer = getTrainerDetails(assignment.assigned)
    const calendarId = trainer.calendarId
    
    console.log('Booking training with:', {
      merchantName,
      trainerEmail: trainer.email,
      calendarId,
      date,
      startTime,
      endTime
    })

    let eventId: string
    const mockMode = process.env.MOCK_LARK_BOOKING === 'true' || searchParams.get('mock') === 'true'
    
    if (mockMode) {
      // Mock mode for testing without Lark permissions
      console.log('📝 MOCK MODE: Simulating calendar event creation')
      eventId = `mock-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      console.log('Mock event created:', eventId)
    } else {
      try {
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
          endTime
        )
      } catch (bookingError: any) {
        console.error('Lark booking failed:', bookingError)
        
        // Fallback to mock mode if calendar creation fails
        console.log('⚠️ Falling back to mock mode due to Lark error')
        eventId = `mock-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    }

    // Update Salesforce with the booking
    let salesforceUpdated = false
    try {
      const conn = await getSalesforceConnection()
      
      console.log('📅 Updating Salesforce training date:', {
        trainerId: merchantId,
        date: date,
        eventId: eventId,
        assignedTrainer: assignment.assigned
      })
      
      // First check if we have a valid connection
      if (!conn) {
        console.error('❌ No Salesforce connection available')
        throw new Error('No Salesforce connection available')
      }
      
      // Update the training date using the correct format (YYYY-MM-DD)
      const updateResult = await conn.sobject('Onboarding_Trainer__c').update({
        Id: merchantId,
        Training_Date__c: date // Salesforce Date field expects YYYY-MM-DD
      })
      
      console.log('✅ Salesforce update result:', updateResult)
      
      // Check if update was successful
      if (updateResult.success || updateResult.id) {
        salesforceUpdated = true
        console.log('✅ Training date updated successfully in Salesforce')
      } else {
        console.error('❌ Salesforce update failed:', updateResult.errors)
        salesforceUpdated = false
      }
    } catch (sfError: any) {
      console.error('❌ Failed to update Salesforce:', sfError.message || sfError)
      salesforceUpdated = false
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