import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import { getSalesforceConnection } from '@/lib/salesforce'
import { deleteSalesforceEvent } from '@/lib/salesforce-events'
import { createSalesforceTask, getMsmSalesforceUserId, getTodayDateString, getSalesforceRecordUrl } from '@/lib/salesforce-tasks'
import { deleteIntercomTicket } from '@/lib/intercom'
import { prisma } from '@/lib/prisma'
import { TaskType } from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'

export async function DELETE(request: NextRequest) {
  try {
    // Read trainers config dynamically to pick up changes without restart
    const configPath = path.join(process.cwd(), 'config', 'trainers.json')
    const configContent = await fs.readFile(configPath, 'utf-8')
    const trainersConfig = JSON.parse(configContent)

    // Read installers config for installation bookings
    const installersConfigPath = path.join(process.cwd(), 'config', 'installers.json')
    const installersConfigContent = await fs.readFile(installersConfigPath, 'utf-8')
    const installersConfig = JSON.parse(installersConfigContent)

    // Flatten all installers from all regions
    const allInstallers: any[] = []
    for (const region of ['klangValley', 'penang', 'johorBahru']) {
      if (installersConfig[region]?.installers) {
        allInstallers.push(...installersConfig[region].installers)
      }
    }

    const body = await request.json()
    const {
      merchantId,
      merchantName,
      trainerName,
      eventId,
      bookingType = 'training', // Default to training if not specified
      cancellationReason,       // NEW - required
      isExternal = false,       // NEW - for external vendor installations
      salesforceEventId,        // NEW - for KPI event deletion
      surftekTicketId,          // NEW - for external vendor tracking
      surftekCaseNumber,        // NEW - for external vendor tracking
      scheduledTime             // NEW - for notifications
    } = body

    // Validate required fields
    if (!merchantId || !merchantName) {
      return NextResponse.json(
        { error: 'Missing required fields: merchantId and merchantName are required' },
        { status: 400 }
      )
    }

    // Cancellation reason is required
    if (!cancellationReason || !cancellationReason.trim()) {
      return NextResponse.json(
        { error: 'Cancellation reason is required' },
        { status: 400 }
      )
    }

    // For internal bookings, we need trainerName and eventId
    if (!isExternal && (!trainerName || !eventId)) {
      console.log('[Cancel] Missing fields:', { trainerName, eventId, isExternal })
      return NextResponse.json(
        { error: 'Missing required fields for internal booking: trainerName and eventId are required' },
        { status: 400 }
      )
    }

    console.log('[Cancel] Request received:', {
      merchantId,
      merchantName,
      trainerName,
      eventId,
      bookingType,
      isExternal,
      salesforceEventId
    })

    // Variables for notifications
    let msmEmail: string | null = null
    let msmName: string | null = null
    let cancellationDate: string | null = null
    let trainerEmail: string | null = null

    // Track if Lark deletion succeeded (to decide whether to clear eventId)
    let larkDeletionSucceeded = false

    // For internal bookings, delete the Lark calendar event
    if (!isExternal && trainerName && eventId) {
      let assigneeEmail: string | null = null
      let calendarId: string | null = null

      if (bookingType === 'installation') {
        // Look up installer in installers config
        console.log('[Cancel] Looking up installer in config:', {
          searchingFor: trainerName,
          availableInstallers: allInstallers.map((i: any) => i.name)
        })

        const installer = allInstallers.find(
          (i: any) => i.name.toLowerCase().trim() === trainerName.toLowerCase().trim()
        )

        if (installer) {
          console.log('[Cancel] Found installer in config:', installer.name, installer.email)
          assigneeEmail = installer.email
          calendarId = installer.larkCalendarId || trainersConfig.defaultCalendarId
        } else {
          console.log('[Cancel] Installer not found in config, using first installer as fallback')
          const fallbackInstaller = allInstallers[0]
          if (fallbackInstaller) {
            assigneeEmail = fallbackInstaller.email
            calendarId = fallbackInstaller.larkCalendarId || trainersConfig.defaultCalendarId
            console.log('[Cancel] Using fallback installer:', fallbackInstaller.name, fallbackInstaller.email)
          }
        }
      } else {
        // Look up trainer in trainers config
        console.log('[Cancel] Looking up trainer in config:', {
          searchingFor: trainerName,
          availableTrainers: trainersConfig.trainers.map((t: any) => t.name)
        })

        let trainer = trainersConfig.trainers.find(
          (t: any) => t.name.toLowerCase().trim() === trainerName.toLowerCase().trim()
        )

        // If trainerName looks like a Salesforce ID (starts with 005), look up actual trainer
        if (!trainer && trainerName.startsWith('005')) {
          console.log('[Cancel] trainerName is a Salesforce ID, looking up actual trainer...')
          try {
            const conn = await getSalesforceConnection()

            // First try to get the User's name and email from Salesforce
            const userQuery = `SELECT Id, Name, Email FROM User WHERE Id = '${trainerName}' LIMIT 1`
            console.log('[Cancel] Querying Salesforce User:', userQuery)
            const userResult = await conn.query(userQuery)

            if (userResult.totalSize > 0) {
              const sfUser = userResult.records[0] as any
              console.log('[Cancel] Found Salesforce User:', sfUser.Name, sfUser.Email)

              // Match by email first (most reliable)
              trainer = trainersConfig.trainers.find(
                (t: any) => t.email.toLowerCase() === sfUser.Email?.toLowerCase()
              )

              // If not found by email, try by name
              if (!trainer) {
                trainer = trainersConfig.trainers.find(
                  (t: any) => t.name.toLowerCase().trim() === sfUser.Name?.toLowerCase().trim()
                )
              }

              if (trainer) {
                console.log('[Cancel] Matched trainer from SF User:', trainer.name, trainer.email)
              }
            }
          } catch (lookupError) {
            console.error('[Cancel] Failed to look up trainer from Salesforce User:', lookupError)
          }
        }

        if (trainer) {
          console.log('[Cancel] Found trainer in config:', trainer.name, trainer.email)
          assigneeEmail = trainer.email
          calendarId = trainer.calendarId || trainersConfig.defaultCalendarId
        } else {
          console.log('[Cancel] Trainer not found in config, using first trainer as fallback')
          const fallbackTrainer = trainersConfig.trainers[0]
          if (fallbackTrainer) {
            assigneeEmail = fallbackTrainer.email
            calendarId = fallbackTrainer.calendarId || trainersConfig.defaultCalendarId
            console.log('[Cancel] Using fallback trainer:', fallbackTrainer.name, fallbackTrainer.email)
          }
        }
      }

      // Set trainerEmail for notifications (used later)
      trainerEmail = assigneeEmail

      if (assigneeEmail && calendarId) {
        console.log('[Cancel] Attempting Lark deletion:', {
          assigneeEmail,
          calendarId,
          eventId,
          bookingType
        })

        try {
          await larkService.cancelTraining(
            assigneeEmail,
            calendarId,
            eventId,
            merchantName
          )
          console.log('[Cancel] Lark calendar event deleted successfully')
          larkDeletionSucceeded = true
        } catch (larkError: any) {
          console.error('[Cancel] Failed to delete Lark calendar event:', larkError?.message || larkError)
          // Will still clear other fields but preserve eventId for retry
        }
      } else {
        console.log('[Cancel] No assignee found for Lark deletion')
      }
    } else if (isExternal) {
      console.log('[Cancel] External vendor booking - skipping Lark calendar deletion')
      larkDeletionSucceeded = true // External doesn't need Lark deletion
    } else {
      console.log('[Cancel] Skipping Lark deletion - missing data:', { trainerName, eventId, isExternal })
    }

    // Get Salesforce connection
    const conn = await getSalesforceConnection()

    // Fetch MSM data and current date before clearing
    try {
      // Map booking types to Salesforce field names
      const dateFieldMapping: { [key: string]: string } = {
        'installation': 'Installation_Date__c',
        'training': 'Training_Date__c'
      }
      const dateField = dateFieldMapping[bookingType] || dateFieldMapping['training']

      const trainerQuery = `
        SELECT ${dateField}, MSM_Name__r.Email, MSM_Name__r.Name
        FROM Onboarding_Trainer__c
        WHERE Id = '${merchantId}'
        LIMIT 1
      `
      const trainerResult = await conn.query(trainerQuery)
      if (trainerResult.totalSize > 0) {
        const trainerRecord = trainerResult.records[0] as any
        msmEmail = trainerRecord.MSM_Name__r?.Email || null
        msmName = trainerRecord.MSM_Name__r?.Name || null
        cancellationDate = trainerRecord[dateField] || null
        console.log('[Cancel] Fetched MSM data:', { msmEmail, msmName, cancellationDate })
      }
    } catch (fetchError) {
      console.error('[Cancel] Failed to fetch MSM data:', fetchError)
    }

    // Only clear Salesforce fields if Lark deletion succeeded (or external vendor)
    if (larkDeletionSucceeded) {
      // Clear Salesforce fields on Onboarding_Trainer__c
      try {
        const trainerUpdateData: any = {
          Id: merchantId
        }

        if (bookingType === 'training') {
          // Clear training fields
          trainerUpdateData.Training_Date__c = null
          trainerUpdateData.CSM_Name__c = null  // Clear trainer assignment
          // Note: Training_Status__c removed - "Not Scheduled" is not a valid picklist value
        } else if (bookingType === 'installation') {
          // Clear installation fields
          trainerUpdateData.Installation_Date__c = null
          trainerUpdateData.Installation_Date_Time__c = null
          trainerUpdateData.Assigned_Installer__c = null  // Clear installer assignment
        }

        await conn.sobject('Onboarding_Trainer__c').update(trainerUpdateData)
        console.log(`[Cancel] Cleared Onboarding_Trainer__c fields for ${bookingType}`)
      } catch (trainerUpdateError) {
        console.error('[Cancel] Failed to update Onboarding_Trainer__c:', trainerUpdateError)
      }

      // Clear fields from Onboarding_Portal__c
      try {
        const portalQuery = `
          SELECT Id, Intercom_Installation_Ticket_ID__c
          FROM Onboarding_Portal__c
          WHERE Onboarding_Trainer_Record__c = '${merchantId}'
          LIMIT 1
        `
        const portalResult = await conn.query(portalQuery)

        if (portalResult.totalSize > 0) {
          const portalRecord = portalResult.records[0] as any
          const portalId = portalRecord.Id
          const intercomTicketId = portalRecord.Intercom_Installation_Ticket_ID__c
          const portalUpdateData: any = {
            Id: portalId
          }

          if (bookingType === 'training') {
            // Clear training portal fields
            portalUpdateData.Training_Event_ID__c = null
            portalUpdateData.Training_Date__c = null
            portalUpdateData.Trainer_Name__c = null
            portalUpdateData.Training_Salesforce_Event_ID__c = null
            portalUpdateData.Remote_Training_Meeting_Link__c = null
            // Save cancellation reason
            portalUpdateData.Training_Cancellation_Reason__c = cancellationReason
          } else if (bookingType === 'installation') {
            // Clear installation portal fields
            portalUpdateData.Installation_Event_ID__c = null
            portalUpdateData.Installation_Date__c = null
            portalUpdateData.Installer_Name__c = null
            portalUpdateData.Installation_Salesforce_Event_ID__c = null
            // Save cancellation reason
            portalUpdateData.Installation_Cancellation_Reason__c = cancellationReason

            // Close Intercom ticket if exists (for internal installations)
            if (!isExternal && intercomTicketId) {
              try {
                const ticketClosed = await deleteIntercomTicket(intercomTicketId)
                if (ticketClosed) {
                  console.log('[Cancel] Intercom ticket closed:', intercomTicketId)
                } else {
                  console.log('[Cancel] Failed to close Intercom ticket:', intercomTicketId)
                }
              } catch (intercomError) {
                console.error('[Cancel] Error closing Intercom ticket:', intercomError)
                // Non-blocking - continue with cancellation
              }
              // Clear Intercom fields regardless of API success
              portalUpdateData.Intercom_Installation_Ticket_ID__c = null
              portalUpdateData.Intercom_Installation_Ticket_URL__c = null
            }

            // For external vendor, also clear Surftek fields
            if (isExternal) {
              portalUpdateData.Surftek_Ticket_ID__c = null
              portalUpdateData.Surftek_Case_Number__c = null
            }
          }

          await conn.sobject('Onboarding_Portal__c').update(portalUpdateData)
          console.log(`[Cancel] Cleared Onboarding_Portal__c fields for ${bookingType}${isExternal ? ' (including Surftek fields)' : ''}`)
        } else {
          console.log(`[Cancel] No Onboarding_Portal__c record found for merchant ${merchantId}`)
        }
      } catch (portalError: any) {
        console.error('[Cancel] Error clearing Onboarding_Portal__c:', portalError.message)
      }
    } else {
      console.log('[Cancel] Skipping Salesforce field clearing - Lark deletion failed')
      // Return error to user so they know to retry
      return NextResponse.json(
        { error: 'Failed to delete calendar event. Please try again or contact support.' },
        { status: 500 }
      )
    }

    // Delete Salesforce Event (KPI tracking) if provided
    if (salesforceEventId) {
      try {
        const deleted = await deleteSalesforceEvent(salesforceEventId)
        if (deleted) {
          console.log('[Cancel] Salesforce Event deleted:', salesforceEventId)
        } else {
          console.log('[Cancel] Failed to delete Salesforce Event:', salesforceEventId)
        }
      } catch (sfEventError) {
        console.error('[Cancel] Error deleting Salesforce Event:', sfEventError)
        // Non-blocking - continue with cancellation
      }
    }

    // Format date for notifications
    const formattedDate = cancellationDate ? new Date(cancellationDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) : 'N/A'

    const bookingTypeLabel = bookingType.charAt(0).toUpperCase() + bookingType.slice(1)

    // Send cancellation notification to trainer/installer (only for internal bookings)
    if (!isExternal && trainerEmail) {
      try {
        const message = `❌ ${bookingTypeLabel} Booking Cancelled\n\n` +
                       `Merchant: ${merchantName}\n` +
                       `Date: ${formattedDate}\n` +
                       (scheduledTime ? `Time: ${scheduledTime}\n` : '') +
                       `\nReason: ${cancellationReason}\n\n` +
                       `This booking has been removed from your calendar.`

        await larkService.sendAppMessage(trainerEmail, message, 'text')
        console.log('[Cancel] Notification sent to trainer/installer:', trainerEmail)
      } catch (notificationError) {
        console.error('[Cancel] Trainer/installer notification failed:', notificationError)
      }
    }

    // Send cancellation notification to manager (MSM)
    if (msmEmail) {
      try {
        const salesforceUrl = getSalesforceRecordUrl(merchantId)
        let message: string

        if (isExternal) {
          // External vendor cancellation - include manual action required
          message = `❌ External Vendor ${bookingTypeLabel} Cancelled\n\n` +
                   `Merchant: ${merchantName}\n` +
                   `Date: ${formattedDate}\n` +
                   (scheduledTime ? `Time: ${scheduledTime}\n` : '') +
                   `\nReason: ${cancellationReason}\n\n` +
                   `⚠️ MANUAL ACTION REQUIRED\n` +
                   `Please cancel the Surftek booking:\n` +
                   (surftekCaseNumber ? `- Case Number: ${surftekCaseNumber}\n` : '') +
                   (surftekTicketId ? `- Ticket ID: ${surftekTicketId}\n` : '') +
                   `\n🔗 Salesforce: ${salesforceUrl}`
        } else {
          // Internal cancellation
          message = `❌ ${bookingTypeLabel} Booking Cancelled\n\n` +
                   `Merchant: ${merchantName}\n` +
                   `Assigned ${bookingType === 'training' ? 'Trainer' : 'Installer'}: ${trainerName}\n` +
                   `Date: ${formattedDate}\n` +
                   (scheduledTime ? `Time: ${scheduledTime}\n` : '') +
                   `\nReason: ${cancellationReason}\n\n` +
                   `🔗 Salesforce: ${salesforceUrl}`
        }

        await larkService.sendAppMessage(msmEmail, message, 'text')
        console.log('[Cancel] Manager notification sent to:', msmEmail)
      } catch (managerNotificationError) {
        console.error('[Cancel] Manager notification failed:', managerNotificationError)
      }
    } else {
      console.log('[Cancel] No MSM email found - skipping manager notification')
    }

    // Create Salesforce Task for cancellation
    if (msmEmail) {
      try {
        const msmUserId = await getMsmSalesforceUserId(msmEmail)

        if (msmUserId) {
          let taskSubject: string
          let taskDescription: string
          let taskType: TaskType

          if (isExternal) {
            // External vendor cancellation task
            taskType = TaskType.EXTERNAL_INSTALLATION_CANCELLATION
            taskSubject = `[Portal] Cancel External Vendor Booking - ${merchantName}`
            taskDescription = `External Vendor Installation CANCELLED via Portal

Merchant: ${merchantName}
Original Date: ${formattedDate}
${scheduledTime ? `Original Time: ${scheduledTime}` : ''}

Cancellation Reason:
${cancellationReason}

⚠️ MANUAL ACTION REQUIRED
Please cancel the Surftek booking:
${surftekCaseNumber ? `- Case Number: ${surftekCaseNumber}` : ''}
${surftekTicketId ? `- Ticket ID: ${surftekTicketId}` : ''}

🔗 Salesforce: ${getSalesforceRecordUrl(merchantId)}`
          } else {
            // Internal cancellation task
            taskType = bookingType === 'training' ? TaskType.TRAINING_CANCELLATION : TaskType.INTERNAL_INSTALLATION_CANCELLATION
            taskSubject = `[Portal] ${bookingTypeLabel} Cancelled - ${merchantName}`
            taskDescription = `${bookingTypeLabel} CANCELLED via Portal

Merchant: ${merchantName}
${bookingType === 'training' ? 'Trainer' : 'Installer'}: ${trainerName}
Original Date: ${formattedDate}
${scheduledTime ? `Original Time: ${scheduledTime}` : ''}

Cancellation Reason:
${cancellationReason}

🔗 Salesforce: ${getSalesforceRecordUrl(merchantId)}`
          }

          const taskResult = await createSalesforceTask({
            subject: taskSubject,
            description: taskDescription,
            status: 'Open',
            priority: 'Normal',
            ownerId: msmUserId,
            whatId: merchantId,
            activityDate: getTodayDateString()
          })

          if (taskResult.success && taskResult.taskId) {
            await prisma.salesforceTaskTracking.create({
              data: {
                taskId: taskResult.taskId,
                trainerId: merchantId,
                taskType: taskType,
                merchantName,
                msmEmail
              }
            })
            console.log(`[Cancel] Salesforce Task created: ${taskResult.taskId}`)
          } else {
            console.log(`[Cancel] Failed to create Salesforce Task: ${taskResult.error}`)
          }
        } else {
          console.log(`[Cancel] No Salesforce User found for ${msmEmail}, skipping task creation`)
        }
      } catch (taskError) {
        console.error('[Cancel] Failed to create Salesforce Task:', taskError)
        // Don't fail the cancellation if task creation fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `${bookingTypeLabel} booking cancelled successfully`,
      isExternal
    })
  } catch (error) {
    console.error('[Cancel] Error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    )
  }
}
