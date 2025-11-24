import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'
import { sendMenuSubmissionNotification } from '@/lib/lark-notifications'
import { prisma } from '@/lib/prisma'
import {
  createSalesforceTask,
  getMsmSalesforceUserId,
  getSalesforceRecordUrl,
  getTodayDateString
} from '@/lib/salesforce-tasks'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds timeout

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [CRON] Starting menu submission check...')

    // Step 1: Query Salesforce for recent menu submissions
    const conn = await getSalesforceConnection()
    if (!conn) {
      throw new Error('Failed to connect to Salesforce')
    }

    // Get records updated in last 10 minutes (to avoid missing any due to timing)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    const query = `
      SELECT ot.Id, ot.Name, ot.Menu_Collection_Submission_Link__c,
             ot.MSM_Name__r.Email, ot.MSM_Name__r.Name,
             ot.LastModifiedDate
      FROM Onboarding_Trainer__c ot,
           Onboarding_Portal__c op
      WHERE ot.Menu_Collection_Submission_Link__c != NULL
        AND ot.LastModifiedDate >= ${tenMinutesAgo}
        AND op.Onboarding_Trainer_Record__c = ot.Id
        AND op.Onboarding_Portal_Access__c = true
        AND op.Is_test_account__c = false
      ORDER BY ot.LastModifiedDate DESC
    `

    console.log('📋 Querying Salesforce for recent submissions...')
    const result = await conn.query(query)

    console.log(`📊 Found ${result.totalSize} records with menu submissions`)

    if (result.totalSize === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new menu submissions found',
        checked: 0,
        notified: 0
      })
    }

    // Step 2: Process each record
    let notifiedCount = 0
    let skippedCount = 0

    for (const record of result.records) {
      const trainer = record as any
      const trainerId = trainer.Id
      const submissionLink = trainer.Menu_Collection_Submission_Link__c
      const merchantName = trainer.Name
      const msmEmail = trainer.MSM_Name__r?.Email
      const msmName = trainer.MSM_Name__r?.Name

      console.log(`\n🔍 Processing: ${merchantName} (${trainerId})`)

      // Check if we already notified about this submission
      const existingNotification = await prisma.menuSubmissionNotification.findUnique({
        where: {
          trainerId_submissionLink: {
            trainerId,
            submissionLink
          }
        }
      })

      if (existingNotification) {
        console.log(`   ⏭️  Already notified on ${existingNotification.notifiedAt.toISOString()}`)
        skippedCount++
        continue
      }

      // Check if MSM is configured
      if (!msmEmail) {
        console.log(`   ⚠️  No MSM email found, skipping notification`)
        skippedCount++
        continue
      }

      // Send notification
      let notificationSent = false
      try {
        await sendMenuSubmissionNotification(msmEmail, merchantName, trainerId)
        console.log(`   ✅ Notification sent to: ${msmName} (${msmEmail})`)

        // Record that we sent the notification
        await prisma.menuSubmissionNotification.create({
          data: {
            trainerId,
            submissionLink,
            merchantName,
            msmEmail
          }
        })

        notifiedCount++
        notificationSent = true
      } catch (notificationError) {
        console.error(`   ❌ Failed to send notification:`, notificationError)
        // Continue with next record even if this one fails
      }

      // Create Salesforce Task (only create if we also sent notification - ensures we don't create tasks for old submissions)
      // Note: If we sent a notification, it means this is a new/updated submission
      try {
        if (msmEmail && notificationSent) {
          // Get MSM Salesforce User ID
          const msmUserId = await getMsmSalesforceUserId(msmEmail)

          if (msmUserId) {
            // Create task in Salesforce
            const taskResult = await createSalesforceTask({
              subject: `[Portal] Check menu/product submission for ${merchantName}`,
              description: `Merchant: ${merchantName}

The merchant has submitted their menu/product information.

Menu Link: ${submissionLink}

🔗 Salesforce: ${getSalesforceRecordUrl(trainerId)}`,
              status: 'Open',
              priority: 'Normal',
              ownerId: msmUserId,
              whatId: trainerId,
              activityDate: getTodayDateString()
            })

            if (taskResult.success && taskResult.taskId) {
              // Track task in database
              await prisma.salesforceTaskTracking.create({
                data: {
                  taskId: taskResult.taskId,
                  trainerId,
                  taskType: 'MENU_SUBMISSION',
                  merchantName,
                  msmEmail
                }
              })
              console.log(`   ✅ Salesforce Task created: ${taskResult.taskId}`)
            } else {
              console.log(`   ⚠️  Failed to create Salesforce Task: ${taskResult.error}`)
            }
          } else {
            console.log(`   ⚠️  No Salesforce User found for ${msmEmail}, skipping task creation`)
          }
        }
      } catch (taskError) {
        console.error(`   ❌ Failed to create Salesforce Task:`, taskError)
        // Don't fail the entire process if task creation fails
      }
    }

    console.log(`\n📈 Summary: ${notifiedCount} notified, ${skippedCount} skipped`)

    return NextResponse.json({
      success: true,
      message: 'Menu submission check completed',
      checked: result.totalSize,
      notified: notifiedCount,
      skipped: skippedCount
    })

  } catch (error: any) {
    console.error('❌ [CRON] Menu submission check failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
