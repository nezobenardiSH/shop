import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSalesforceConnection } from '@/lib/salesforce'
import { verifyToken } from '@/lib/auth-utils'
import { trackEvent, generateSessionId, getClientInfo } from '@/lib/analytics'
import { sendStoreVideoNotification } from '@/lib/lark-notifications'
import { prisma } from '@/lib/prisma'
import {
  createSalesforceTask,
  getMsmSalesforceUserId,
  getSalesforceRecordUrl,
  getTodayDateString
} from '@/lib/salesforce-tasks'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const trainerId = formData.get('trainerId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!trainerId) {
      return NextResponse.json({ error: 'No trainer ID provided' }, { status: 400 })
    }

    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json({ error: 'Failed to connect to Salesforce' }, { status: 500 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Data = buffer.toString('base64')

    // Check if there's already a video document linked to this trainer
    let existingDocumentId = null
    try {
      const existingLinks = await conn.query(`
        SELECT ContentDocumentId, ContentDocument.Title
        FROM ContentDocumentLink
        WHERE LinkedEntityId = '${trainerId}'
        AND ContentDocument.Title LIKE '%video%'
        ORDER BY ContentDocument.CreatedDate DESC
        LIMIT 1
      `)
      
      if (existingLinks.records && existingLinks.records.length > 0) {
        existingDocumentId = (existingLinks.records[0] as any).ContentDocumentId
        console.log('Found existing video document:', existingDocumentId)
      }
    } catch (error) {
      console.log('No existing video found or error checking:', error)
    }

    let contentVersion
    
    if (existingDocumentId) {
      // Create a new version of the existing document
      contentVersion = await conn.sobject('ContentVersion').create({
        Title: file.name,
        PathOnClient: file.name,
        VersionData: base64Data,
        ContentDocumentId: existingDocumentId, // Link to existing document
        Origin: 'C',
        ContentLocation: 'S'
      })
    } else {
      // Create a new document
      contentVersion = await conn.sobject('ContentVersion').create({
        Title: file.name,
        PathOnClient: file.name,
        VersionData: base64Data,
        FirstPublishLocationId: trainerId, // This will auto-create the ContentDocumentLink
        Origin: 'C',
        ContentLocation: 'S'
      })
    }

    if (!contentVersion.success) {
      throw new Error('Failed to create ContentVersion')
    }

    // Query the created ContentVersion to get ContentDocumentId
    const createdVersion = await conn.query(
      `SELECT Id, ContentDocumentId, Title FROM ContentVersion WHERE Id = '${contentVersion.id}'`
    )

    if (!createdVersion.records || createdVersion.records.length === 0) {
      throw new Error('Failed to retrieve created ContentVersion')
    }

    const contentDocumentId = (createdVersion.records[0] as any).ContentDocumentId

    // Note: ContentDocumentLink is automatically created by FirstPublishLocationId
    // No need to create it manually

    // Generate the public download URL
    const instanceUrl = conn.instanceUrl
    const downloadUrl = `${instanceUrl}/sfc/servlet.shepherd/version/download/${contentVersion.id}`

    // Check if there's an existing video URL to determine if this is a replacement
    const existingTrainer = await conn.sobject('Onboarding_Trainer__c').findOne({
      Id: trainerId
    }, ['Video_Proof_Link__c'])

    const isReplacement = existingTrainer && existingTrainer.Video_Proof_Link__c

    // Update the Onboarding_Trainer__c record with the video URL
    const updateResult = await conn.sobject('Onboarding_Trainer__c').update({
      Id: trainerId,
      Video_Proof_Link__c: downloadUrl
    })

    if (!updateResult.success) {
      console.error('Failed to update Video_Proof_Link__c field')
      return NextResponse.json({
        error: 'File uploaded but failed to update Video_Proof_Link__c field',
        fileUrl: downloadUrl
      }, { status: 500 })
    }

    console.log(`✅ Successfully ${isReplacement ? 'replaced' : 'uploaded'} video for trainer: ${trainerId}`)

    // Send notification to Onboarding Manager (MSM)
    let msmEmail: string | null = null
    let merchantName: string | null = null
    try {
      // Fetch MSM information for notification
      const trainerForNotification = await conn.query(
        `SELECT Id, Name, MSM_Name__r.Email, MSM_Name__r.Name FROM Onboarding_Trainer__c WHERE Id = '${trainerId}' LIMIT 1`
      )

      if (trainerForNotification.records && trainerForNotification.records.length > 0) {
        const trainerRecord = trainerForNotification.records[0] as any
        msmEmail = trainerRecord.MSM_Name__r?.Email
        merchantName = trainerRecord.Name
        const msmName = trainerRecord.MSM_Name__r?.Name

        if (msmEmail && merchantName) {
          await sendStoreVideoNotification(msmEmail, merchantName, trainerId)
          console.log(`📧 Store video notification sent to MSM: ${msmName} (${msmEmail})`)
        } else {
          console.log('⚠️ No MSM email or merchant name found - skipping store video notification')
        }
      }
    } catch (notificationError) {
      console.error('Failed to send store video notification:', notificationError)
      // Don't fail the request if notification fails
    }

    // Create Salesforce Task
    try {
      if (msmEmail && merchantName) {
        // Check if task already created (within last 24 hours to allow for re-uploads)
        const existingTask = await prisma.salesforceTaskTracking.findFirst({
          where: {
            trainerId,
            taskType: 'VIDEO_UPLOAD',
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })

        if (!existingTask) {
          // Get MSM Salesforce User ID
          const msmUserId = await getMsmSalesforceUserId(msmEmail)

          if (msmUserId) {
            // Create task in Salesforce
            const taskResult = await createSalesforceTask({
              subject: `Review setup video for ${merchantName}`,
              description: `Merchant: ${merchantName}

The merchant has uploaded their store setup video proof.

Video Link: ${downloadUrl}

🔗 Salesforce: ${getSalesforceRecordUrl(trainerId)}`,
              status: 'Not Started',
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
                  taskType: 'VIDEO_UPLOAD',
                  merchantName,
                  msmEmail
                }
              })
              console.log(`✅ Salesforce Task created: ${taskResult.taskId}`)
            } else {
              console.log(`⚠️ Failed to create Salesforce Task: ${taskResult.error}`)
            }
          } else {
            console.log(`⚠️ No Salesforce User found for ${msmEmail}, skipping task creation`)
          }
        } else {
          console.log(`⏭️ Salesforce Task already exists (created ${existingTask.createdAt.toISOString()})`)
        }
      }
    } catch (taskError) {
      console.error('❌ Failed to create Salesforce Task:', taskError)
      // Don't fail the upload if task creation fails
    }

    // Track analytics event for video upload
    try {
      const cookieStore = await cookies()
      const sessionId = cookieStore.get('analytics-session-id')?.value || generateSessionId(request)
      const { userAgent, ipAddress, deviceType } = getClientInfo(request)

      // Get user info from auth token to track who uploaded
      let isInternalUser = false
      let userType = 'merchant'
      const authToken = cookieStore.get('auth-token')?.value
      if (authToken) {
        const decoded = verifyToken(authToken)
        if (decoded) {
          isInternalUser = decoded.isInternalUser || false
          userType = decoded.userType || 'merchant'
        }
      }

      // Get merchant name from Salesforce
      const trainer = await conn.sobject('Onboarding_Trainer__c').findOne({
        Id: trainerId
      }, ['Name', 'Account_Name__c'])

      await trackEvent({
        merchantId: trainer?.Account_Name__c || trainerId,
        merchantName: trainer?.Name || 'Unknown',
        page: 'store-setup',
        action: 'video_uploaded',
        sessionId,
        userAgent,
        deviceType,
        ipAddress,
        isInternalUser,
        userType,
        metadata: {
          uploadedBy: isInternalUser ? 'internal' : 'merchant',
          isReplacement: isReplacement,
          fileName: file.name,
          fileSize: file.size
        }
      })
      console.log('📊 Analytics: Video upload tracked')
    } catch (analyticsError) {
      console.error('Failed to track video upload:', analyticsError)
      // Don't fail the request if analytics fails
    }

    return NextResponse.json({
      success: true,
      fileUrl: downloadUrl,
      contentVersionId: contentVersion.id,
      contentDocumentId: contentDocumentId,
      message: `Video ${isReplacement ? 'replaced' : 'uploaded'} successfully`,
      isReplacement: isReplacement
    })

  } catch (error) {
    console.error('Error uploading video to Salesforce:', error)
    return NextResponse.json({ 
      error: 'Failed to upload video', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// Get existing video URL
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const trainerId = searchParams.get('trainerId')

    if (!trainerId) {
      return NextResponse.json({ error: 'No trainer ID provided' }, { status: 400 })
    }

    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json({ error: 'Failed to connect to Salesforce' }, { status: 500 })
    }

    // Query the Onboarding_Trainer__c record for existing video URL
    const result = await conn.query(
      `SELECT Id, Video_Proof_Link__c FROM Onboarding_Trainer__c WHERE Id = '${trainerId}'`
    )

    if (!result.records || result.records.length === 0) {
      return NextResponse.json({ error: 'Trainer record not found' }, { status: 404 })
    }

    const trainer = result.records[0] as any
    return NextResponse.json({ 
      videoUrl: trainer.Video_Proof_Link__c || null 
    })

  } catch (error) {
    console.error('Error fetching video URL from Salesforce:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch video URL', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}