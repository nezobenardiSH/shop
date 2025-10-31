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
    
    // If trainer not found by name, use first trainer as fallback
    if (!trainer) {
      console.log('Trainer not found, using first trainer as fallback')
      const fallbackTrainer = trainersConfig.trainers[0]
      if (fallbackTrainer) {
        trainer = {
          ...fallbackTrainer,
          name: trainerName || fallbackTrainer.name
        }
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
          eventIdField: 'Installation_Event_ID__c'
        },
        'training': {
          dateField: 'Training_Date__c',
          eventIdField: 'Training_Event_ID__c'
        }
      }

      const mapping = fieldMapping[bookingType] || fieldMapping['training']

      // Clear the date field on Onboarding_Trainer__c
      const updateData: any = {
        Id: merchantId,
        [mapping.dateField]: null
      }

      // Update training status if it's a training-related booking
      if (bookingType.includes('training')) {
        updateData.Training_Status__c = 'Not Scheduled'
      }

      await conn.sobject('Onboarding_Trainer__c').update(updateData)
      console.log(`Cleared ${mapping.dateField} for booking type: ${bookingType}`)

      // Clear the event ID from Onboarding_Portal__c object
      try {
        const portalQuery = `
          SELECT Id
          FROM Onboarding_Portal__c
          WHERE Onboarding_Trainer_Record__c = '${merchantId}'
          LIMIT 1
        `
        const portalResult = await conn.query(portalQuery)

        if (portalResult.totalSize > 0) {
          const portalId = portalResult.records[0].Id
          console.log(`📝 Clearing event ID from Onboarding_Portal__c.${mapping.eventIdField}`)

          await conn.sobject('Onboarding_Portal__c').update({
            Id: portalId,
            [mapping.eventIdField]: null
          })
          console.log(`✅ Successfully cleared event ID from Onboarding_Portal__c`)
        } else {
          console.log(`⚠️ No Onboarding_Portal__c record found for Onboarding_Trainer_Record__c = ${merchantId}`)
        }
      } catch (portalError: any) {
        console.log(`❌ Error clearing event ID from Onboarding_Portal__c:`, portalError.message)
        console.log(`   Event ID will not be cleared, but cancellation will continue`)
      }
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