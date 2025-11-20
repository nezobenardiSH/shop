import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import { getSalesforceConnection } from '@/lib/salesforce'
import { sendCancellationNotification, sendManagerCancellationNotification } from '@/lib/lark-notifications'
import fs from 'fs/promises'
import path from 'path'

export async function DELETE(request: NextRequest) {
  try {
    // Read trainers config dynamically to pick up changes without restart
    const configPath = path.join(process.cwd(), 'config', 'trainers.json')
    const configContent = await fs.readFile(configPath, 'utf-8')
    const trainersConfig = JSON.parse(configContent)

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
      (t: any) => t.name.toLowerCase().trim() === trainerName.toLowerCase().trim()
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

    // Variables for notifications
    let msmEmail: string | null = null
    let msmName: string | null = null
    let cancellationDate: string | null = null

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

      // Fetch MSM data and current date before clearing
      try {
        const trainerQuery = `
          SELECT ${mapping.dateField}, MSM_Name__r.Email, MSM_Name__r.Name
          FROM Onboarding_Trainer__c
          WHERE Id = '${merchantId}'
          LIMIT 1
        `
        const trainerResult = await conn.query(trainerQuery)
        if (trainerResult.totalSize > 0) {
          const trainerRecord = trainerResult.records[0] as any
          msmEmail = trainerRecord.MSM_Name__r?.Email || null
          msmName = trainerRecord.MSM_Name__r?.Name || null
          cancellationDate = trainerRecord[mapping.dateField] || null
          console.log('📞 Fetched MSM data:', { msmEmail, msmName, cancellationDate })
        }
      } catch (fetchError) {
        console.error('Failed to fetch MSM data:', fetchError)
      }

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

    // Send cancellation notification to trainer/installer
    try {
      const formattedDate = cancellationDate ? new Date(cancellationDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) : 'N/A'

      await sendCancellationNotification(
        trainer.email,
        merchantName,
        formattedDate,
        bookingType.charAt(0).toUpperCase() + bookingType.slice(1)
      )
      console.log('📧 Cancellation notification sent to:', trainer.email)
    } catch (notificationError) {
      console.error('Trainer cancellation notification failed:', notificationError)
    }

    // Send cancellation notification to manager (MSM)
    if (msmEmail) {
      try {
        const formattedDate = cancellationDate ? new Date(cancellationDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : 'N/A'

        await sendManagerCancellationNotification(
          msmEmail,
          merchantName,
          merchantId,
          formattedDate,
          bookingType.charAt(0).toUpperCase() + bookingType.slice(1),
          trainerName
        )
        console.log('📧 Manager cancellation notification sent to MSM:', msmEmail)
      } catch (managerNotificationError) {
        console.error('Manager cancellation notification failed:', managerNotificationError)
      }
    } else {
      console.log('⚠️ No MSM email found - skipping manager cancellation notification')
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