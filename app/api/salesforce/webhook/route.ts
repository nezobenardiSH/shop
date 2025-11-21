import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSalesforceConnection } from '@/lib/salesforce'
import { sendMenuSubmissionNotification } from '@/lib/lark-notifications'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recordId, changes, objectType, eventType } = body
    
    console.log('Received Salesforce webhook:', { recordId, changes, objectType, eventType })
    
    // Handle different object types
    if (objectType === 'Onboarding_Trainer__c') {
      return await handleTrainerUpdate(recordId, changes, eventType)
    }
    
    // Handle Menu Upload events (custom event)
    if (eventType === 'menu_uploaded') {
      return await handleMenuUpload(body)
    }
    
    // Default behavior for merchant/account updates
    const merchant = await prisma.merchant.findUnique({
      where: { salesforceId: recordId }
    })
    
    if (!merchant) {
      console.log('Merchant not found for Salesforce ID:', recordId)
      return NextResponse.json({ 
        success: false, 
        message: 'Merchant not found' 
      }, { status: 404 })
    }
    
    // Prepare update data from Salesforce changes
    const updateData: any = {}
    
    if (changes.BillingStreet !== undefined) {
      updateData.address = changes.BillingStreet
    }
    if (changes.Phone !== undefined) {
      updateData.phone = changes.Phone
    }
    if (changes.Onboarding_Stage__c !== undefined) {
      updateData.onboardingStage = changes.Onboarding_Stage__c
    }
    if (changes.Installation_Date__c !== undefined) {
      updateData.installationDate = changes.Installation_Date__c ? 
        new Date(changes.Installation_Date__c) : null
    }
    if (changes.Training_Date__c !== undefined) {
      updateData.trainingDate = changes.Training_Date__c ? 
        new Date(changes.Training_Date__c) : null
    }
    
    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      // Update local database with Salesforce changes
      const updatedMerchant = await prisma.merchant.update({
        where: { id: merchant.id },
        data: updateData
      })
      
      console.log('Updated merchant from Salesforce:', updatedMerchant.id)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Merchant updated successfully',
        updatedFields: Object.keys(updateData)
      })
    } else {
      return NextResponse.json({ 
        success: true, 
        message: 'No changes to process' 
      })
    }
  } catch (error) {
    console.error('Webhook processing failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handler for Onboarding Trainer updates
async function handleTrainerUpdate(recordId: string, changes: any, eventType: string) {
  try {
    console.log('Processing trainer update:', { recordId, changes, eventType })
    
    // Check if there are any menu-related changes
    const menuUploadDetected = detectMenuUpload(changes)
    
    if (menuUploadDetected) {
      return await processMenuUploadStatusUpdate(recordId, changes)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Trainer update processed',
      menuUploadDetected: false
    })
    
  } catch (error) {
    console.error('Trainer update processing failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Trainer update processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handler for Menu Upload events
async function handleMenuUpload(data: any) {
  try {
    const { trainerId, accountId, menuData } = data
    
    console.log('Processing menu upload event:', { trainerId, accountId })
    
    if (!trainerId && !accountId) {
      return NextResponse.json(
        { success: false, error: 'Either trainerId or accountId is required for menu upload' },
        { status: 400 }
      )
    }
    
    return await processMenuUploadStatusUpdate(trainerId || accountId, { menu_uploaded: true })
    
  } catch (error) {
    console.error('Menu upload processing failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Menu upload processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Detect if changes indicate a menu upload
function detectMenuUpload(changes: any): boolean {
  // Check various indicators that a menu might have been uploaded
  const menuIndicators = [
    'menu_uploaded',
    'Menu_Uploaded__c',
    'Product_List_Received__c',
    'Menu_Collection_Status__c',
    'Menu_Collection_Submission_Link__c'  // Primary indicator: submission link changed
  ]

  for (const indicator of menuIndicators) {
    if (changes[indicator] !== undefined) {
      console.log(`Menu upload detected via field: ${indicator}`)
      return true
    }
  }
  
  // Check if Product_Setup_Status__c changed to something indicating menu received
  if (changes.Product_Setup_Status__c) {
    const statusValue = changes.Product_Setup_Status__c
    const menuReceivedStatuses = [
      'Menu Uploaded',
      'Product List Received',
      'Ticket Created - Pending Completion'
    ]
    
    if (menuReceivedStatuses.includes(statusValue)) {
      console.log(`Menu upload detected via status change: ${statusValue}`)
      return true
    }
  }
  
  return false
}

// Process the status update when menu is uploaded
async function processMenuUploadStatusUpdate(recordId: string, changes: any) {
  try {
    const conn = await getSalesforceConnection()
    if (!conn) {
      throw new Error('Failed to connect to Salesforce')
    }
    
    // Get current trainer record (include MSM for notifications)
    const trainerQuery = `
      SELECT Id, Name, Product_Setup_Status__c, Account_Name__c,
             MSM_Name__r.Email, MSM_Name__r.Name
      FROM Onboarding_Trainer__c
      WHERE Id = '${recordId}' OR Account_Name__c = '${recordId}'
      LIMIT 1
    `
    
    const trainerResult = await conn.query(trainerQuery)
    
    if (trainerResult.totalSize === 0) {
      return NextResponse.json(
        { success: false, error: 'Onboarding Trainer not found' },
        { status: 404 }
      )
    }
    
    const trainer = trainerResult.records[0] as any
    const currentStatus = trainer.Product_Setup_Status__c

    // Send notification to Onboarding Manager (MSM) - Always send on every submission
    const msmEmail = trainer.MSM_Name__r?.Email
    const msmName = trainer.MSM_Name__r?.Name
    let notificationSent = false

    if (msmEmail) {
      try {
        await sendMenuSubmissionNotification(msmEmail, trainer.Name, trainer.Id)
        console.log(`📧 Menu submission notification sent to MSM: ${msmName} (${msmEmail})`)
        notificationSent = true
      } catch (notificationError) {
        console.error('Failed to send menu submission notification:', notificationError)
        // Don't fail the request if notification fails
      }
    } else {
      console.log('⚠️ No MSM email found - skipping menu submission notification')
    }

    // Try to update status (optional - don't fail if this doesn't work)
    const statusesToUpdate = [
      'Pending Product List from Merchant',
      'Not Started',
      null,
      undefined
    ]

    let statusUpdated = false
    let statusUpdateError = null

    if (statusesToUpdate.includes(currentStatus)) {
      try {
        const updateData = {
          Id: trainer.Id,
          Product_Setup_Status__c: 'Ticket Created - Pending Completion'
        }

        const updateResult = await conn.sobject('Onboarding_Trainer__c').update(updateData)

        if (updateResult.success) {
          console.log(`✅ Status updated to "Ticket Created - Pending Completion"`)
          statusUpdated = true
        } else {
          statusUpdateError = 'Salesforce update failed'
          console.log('⚠️ Status update failed but notification was sent')
        }
      } catch (error: any) {
        statusUpdateError = error.message
        console.log('⚠️ Status update error:', error.message)
        console.log('   Notification was still sent successfully')
      }
    }

    // Return success as long as notification was sent (status update is optional)
    return NextResponse.json({
      success: true,
      message: `Menu submission processed. Notification sent: ${notificationSent}`,
      notificationSent,
      statusUpdated,
      statusUpdateError,
      trainerId: trainer.Id,
      trainerName: trainer.Name
    })
    
  } catch (error: any) {
    console.error('Menu upload status update failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: `Menu upload status update failed: ${error.message}` 
      },
      { status: 500 }
    )
  }
}
