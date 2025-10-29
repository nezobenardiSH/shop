import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import trainersConfig from '@/config/trainers.json'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      merchantId,
      merchantName,
      trainerName,
      eventId,
      bookingType = 'training' // Default to training if not specified
    } = body

    if (!merchantId || !merchantName || !trainerName || !eventId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let trainer = trainersConfig.trainers.find(
      t => t.name.toLowerCase().trim() === trainerName.toLowerCase().trim()
    )
    
    // If trainer not found by name, use default trainer config
    if (!trainer && trainersConfig.defaultTrainer) {
      console.log('Trainer not found, using default trainer configuration')
      trainer = {
        ...trainersConfig.defaultTrainer,
        name: trainerName || trainersConfig.defaultTrainer.name
      }
    }
    
    if (!trainer) {
      return NextResponse.json(
        { error: `Trainer "${trainerName}" not found in configuration` },
        { status: 404 }
      )
    }

    const calendarId = trainer.calendarId || trainersConfig.defaultCalendarId

    await larkService.cancelTraining(
      trainer.email,
      calendarId,
      eventId,
      merchantName
    )

    try {
      const conn = await getSalesforceConnection()
      
      // Map booking types to Salesforce field names
      const fieldMapping: { [key: string]: { dateField: string, eventIdField: string } } = {
        'installation': {
          dateField: 'Installation_Date__c',
          eventIdField: 'Installation_Event_Id__c'
        },
        'training': {
          dateField: 'Training_Date__c',
          eventIdField: 'Training_Event_Id__c'
        }
      }

      const mapping = fieldMapping[bookingType] || fieldMapping['training']
      
      // Clear the specific date and event ID fields
      const updateData: any = {
        Id: merchantId,
        [mapping.dateField]: null,
        [mapping.eventIdField]: null
      }
      
      // Update training status if it's a training-related booking
      if (bookingType.includes('training')) {
        updateData.Training_Status__c = 'Not Scheduled'
      }
      
      await conn.sobject('Onboarding_Trainer__c').update(updateData)
      console.log(`Cleared ${mapping.dateField} and ${mapping.eventIdField} for booking type: ${bookingType}`)
    } catch (sfError) {
      console.error('Failed to update Salesforce:', sfError)
    }

    return NextResponse.json({
      success: true,
      message: 'Training session cancelled successfully'
    })
  } catch (error) {
    console.error('Error cancelling training:', error)
    return NextResponse.json(
      { error: 'Failed to cancel training session' },
      { status: 500 }
    )
  }
}