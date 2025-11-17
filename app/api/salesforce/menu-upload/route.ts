import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'
import { trackEvent, generateSessionId, getClientInfo } from '@/lib/analytics'
import { verifyToken } from '@/lib/auth-utils'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trainerId, merchantId, accountId, menuData } = body

    console.log('Received menu upload notification:', { trainerId, merchantId, accountId })

    if (!trainerId && !merchantId && !accountId) {
      return NextResponse.json(
        { success: false, error: 'Either trainerId, merchantId, or accountId is required' },
        { status: 400 }
      )
    }

    // Get Salesforce connection
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Salesforce' },
        { status: 500 }
      )
    }

    // Find the trainer record
    let trainerQuery = ''
    if (trainerId) {
      trainerQuery = `SELECT Id, Name, Product_Setup_Status__c, Account_Name__c FROM Onboarding_Trainer__c WHERE Id = '${trainerId}' LIMIT 1`
    } else if (accountId) {
      trainerQuery = `SELECT Id, Name, Product_Setup_Status__c, Account_Name__c FROM Onboarding_Trainer__c WHERE Account_Name__c = '${accountId}' LIMIT 1`
    } else {
      // If merchantId is provided, we'd need to map it to Account or Trainer
      return NextResponse.json(
        { success: false, error: 'Cannot find trainer with provided merchantId. Use trainerId or accountId instead.' },
        { status: 400 }
      )
    }

    let trainerResult
    try {
      trainerResult = await conn.query(trainerQuery)
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: `Failed to query trainer: ${error.message}` },
        { status: 500 }
      )
    }

    if (trainerResult.totalSize === 0) {
      return NextResponse.json(
        { success: false, error: 'Onboarding Trainer not found' },
        { status: 404 }
      )
    }

    const trainer = trainerResult.records[0] as any
    const currentStatus = trainer.Product_Setup_Status__c

    // Check if status should be updated
    const statusesToUpdate = [
      'Pending Product List from Merchant',
      'Not Started',
      null,
      undefined
    ]

    if (!statusesToUpdate.includes(currentStatus)) {
      return NextResponse.json({
        success: true,
        message: `Menu uploaded but status already advanced. Current status: ${currentStatus}`,
        currentStatus,
        trainerId: trainer.Id,
        trainerName: trainer.Name
      })
    }

    // Update the status to indicate menu has been received and ticket created
    const updateData = {
      Id: trainer.Id,
      Product_Setup_Status__c: 'Ticket Created - Pending Completion'
    }

    try {
      const updateResult = await conn.sobject('Onboarding_Trainer__c').update(updateData)
      
      if (updateResult.success) {
        console.log(`Successfully updated trainer ${trainer.Id} status to "Ticket Created - Pending Completion"`)
        
        // Track the menu submission event
        try {
          const cookieStore = await cookies()
          const sessionId = cookieStore.get('analytics-session-id')?.value || generateSessionId(request)
          const { userAgent, ipAddress, deviceType } = getClientInfo(request)
          
          // Get user info from auth token
          let isInternalUser = false
          let userType = 'merchant'
          const authToken = cookieStore.get('auth-token')?.value
          if (authToken) {
            const decoded = verifyToken(authToken)
            if (decoded) {
              isInternalUser = decoded.isInternalUser || false
              userType = decoded.userType || 'internal_team'
            }
          }
          
          await trackEvent({
            merchantId: trainer.Id,  // Use trainer ID, not Account ID
            merchantName: trainer.Name,
            page: 'menu-submission',
            action: 'menu_submitted',
            sessionId,
            userAgent,
            deviceType,
            ipAddress,
            isInternalUser,
            userType,
            metadata: {
              submittedBy: isInternalUser ? 'internal' : 'merchant',
              previousStatus: currentStatus || 'Not Started',
              newStatus: 'Ticket Created - Pending Completion',
              accountId: trainer.Account_Name__c  // Keep account ID in metadata for reference
            }
          })
          console.log('📊 Analytics: Menu submission tracked')
        } catch (analyticsError) {
          console.error('Failed to track menu submission:', analyticsError)
          // Don't fail the request if analytics fails
        }
        
        return NextResponse.json({
          success: true,
          message: `Menu upload processed successfully. Status updated from "${currentStatus || 'Not Started'}" to "Ticket Created - Pending Completion"`,
          previousStatus: currentStatus,
          newStatus: 'Ticket Created - Pending Completion',
          trainerId: trainer.Id,
          trainerName: trainer.Name,
          salesforceResult: updateResult
        })
      } else {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to update status in Salesforce', 
            details: updateResult 
          },
          { status: 400 }
        )
      }
    } catch (updateError: any) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Status update failed: ${updateError.message}`,
          details: updateError
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Menu upload processing error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: `Server error: ${error.message}` 
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check current status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trainerId = searchParams.get('trainerId')
    const accountId = searchParams.get('accountId')

    if (!trainerId && !accountId) {
      return NextResponse.json(
        { success: false, error: 'Either trainerId or accountId is required' },
        { status: 400 }
      )
    }

    // Get Salesforce connection
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Salesforce' },
        { status: 500 }
      )
    }

    // Find the trainer record
    let trainerQuery = ''
    if (trainerId) {
      trainerQuery = `SELECT Id, Name, Product_Setup_Status__c, Account_Name__c, Menu_Collection_Form_Link__c FROM Onboarding_Trainer__c WHERE Id = '${trainerId}' LIMIT 1`
    } else {
      trainerQuery = `SELECT Id, Name, Product_Setup_Status__c, Account_Name__c, Menu_Collection_Form_Link__c FROM Onboarding_Trainer__c WHERE Account_Name__c = '${accountId}' LIMIT 1`
    }

    const trainerResult = await conn.query(trainerQuery)
    
    if (trainerResult.totalSize === 0) {
      return NextResponse.json(
        { success: false, error: 'Onboarding Trainer not found' },
        { status: 404 }
      )
    }

    const trainer = trainerResult.records[0] as any

    return NextResponse.json({
      success: true,
      trainer: {
        id: trainer.Id,
        name: trainer.Name,
        productSetupStatus: trainer.Product_Setup_Status__c,
        accountId: trainer.Account_Name__c,
        menuCollectionFormLink: trainer.Menu_Collection_Form_Link__c
      }
    })

  } catch (error: any) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: `Server error: ${error.message}` 
      },
      { status: 500 }
    )
  }
}