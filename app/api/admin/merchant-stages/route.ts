import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/auth-utils'
import { getSalesforceConnection } from '@/lib/salesforce'

/**
 * GET /api/admin/merchant-stages
 * Get onboarding stage information for merchants
 * Query Parameters:
 * - merchantIds: Comma-separated list of merchant IDs (Salesforce Onboarding_Trainer__c IDs)
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('admin-token')?.value

    if (!adminToken) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const decoded = verifyAdminToken(adminToken)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired admin token' },
        { status: 401 }
      )
    }

    // Get merchant IDs from query params
    const { searchParams } = new URL(request.url)
    const merchantIdsParam = searchParams.get('merchantIds')

    if (!merchantIdsParam) {
      return NextResponse.json(
        { error: 'merchantIds parameter is required' },
        { status: 400 }
      )
    }

    const merchantIds = merchantIdsParam.split(',').map(id => id.trim()).filter(id => id)

    if (merchantIds.length === 0) {
      return NextResponse.json({
        success: true,
        merchants: []
      })
    }

    // Connect to Salesforce
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { error: 'Failed to connect to Salesforce' },
        { status: 500 }
      )
    }

    // Build SOQL query to fetch all merchants at once
    const merchantIdsForQuery = merchantIds.map(id => `'${id}'`).join(',')
    const query = `
      SELECT Id, Name,
             Onboarding_Trainer_Stage__c,
             Product_Setup_Status__c,
             Completed_product_setup__c,
             Hardware_Delivery_Status__c,
             Delivery_Tracking_Number__c,
             Delivery_Tracking_Number_Timestamp__c,
             Hardware_Installation_Status__c,
             Installation_Date__c,
             Actual_Installation_Date__c,
             Installation_ST_Ticket_No__c,
             Training_Status__c,
             Training_Date__c,
             Planned_Go_Live_Date__c,
             First_Revised_EGLD__c,
             Account_Name__r.POS_QR_Delivery_Tnx_Count_Past_30_Days__c,
             Welcome_Call_Status__c,
             First_Call_Timestamp__c,
             Video_Proof_Link__c,
             Menu_Collection_Submission_Timestamp__c
      FROM Onboarding_Trainer__c
      WHERE Id IN (${merchantIdsForQuery})
    `

    console.log('[Admin Merchant Stages] Querying Salesforce for', merchantIds.length, 'merchants')
    const result = await conn.query(query)
    console.log('[Admin Merchant Stages] Found', result.totalSize, 'records')

    // Transform the data
    const merchants = result.records.map((record: any) => {
      // Calculate stage statuses similar to OnboardingTimeline component
      const hasFirstCall = !!record.First_Call_Timestamp__c
      const hasMenuSubmission = !!record.Menu_Collection_Submission_Timestamp__c
      const hasCompletedProductSetup = record.Completed_product_setup__c === 'Yes'
      const hasVideoProof = !!record.Video_Proof_Link__c
      const hasTrackingNumber = !!record.Delivery_Tracking_Number__c
      const hasActualInstallation = !!record.Actual_Installation_Date__c
      const posQrCount = record.Account_Name__r?.POS_QR_Delivery_Tnx_Count_Past_30_Days__c || 0
      const isLive = posQrCount > 30

      // Calculate preparation completion
      let preparationCompleted = 0
      let preparationTotal = 3
      if (hasMenuSubmission) preparationCompleted++
      if (hasCompletedProductSetup) preparationCompleted++
      if (hasVideoProof) preparationCompleted++

      return {
        id: record.Id,
        name: record.Name,
        onboardingStage: record.Onboarding_Trainer_Stage__c,
        
        // Welcome phase
        welcomeStatus: hasFirstCall ? 'completed' : 'pending',
        firstCallTimestamp: record.First_Call_Timestamp__c,
        
        // Preparation phase
        preparationStatus: `${preparationCompleted}/${preparationTotal}`,
        productSetupStatus: record.Product_Setup_Status__c,
        completedProductSetup: record.Completed_product_setup__c,
        menuSubmissionTimestamp: record.Menu_Collection_Submission_Timestamp__c,
        videoProofLink: record.Video_Proof_Link__c,
        
        // Hardware Delivery phase
        hardwareDeliveryStatus: record.Hardware_Delivery_Status__c,
        trackingNumber: record.Delivery_Tracking_Number__c,
        trackingNumberTimestamp: record.Delivery_Tracking_Number_Timestamp__c,
        
        // Installation phase
        installationStatus: hasActualInstallation ? 'completed' : 'pending',
        hardwareInstallationStatus: record.Hardware_Installation_Status__c,
        installationDate: record.Installation_Date__c,
        actualInstallationDate: record.Actual_Installation_Date__c,
        installationTicket: record.Installation_ST_Ticket_No__c,
        
        // Training phase
        trainingStatus: record.Training_Status__c,
        trainingDate: record.Training_Date__c,
        
        // Go Live phase
        goLiveStatus: isLive ? 'live' : 'pending',
        plannedGoLiveDate: record.Planned_Go_Live_Date__c,
        firstRevisedEGLD: record.First_Revised_EGLD__c,
        posQrDeliveryCount: posQrCount,
        
        // Overall status
        isLive: isLive
      }
    })

    return NextResponse.json({
      success: true,
      merchants: merchants,
      count: merchants.length
    })

  } catch (error) {
    console.error('[Admin Merchant Stages API] Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch merchant stages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

