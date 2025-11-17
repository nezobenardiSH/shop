import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/auth-utils'
import { getStageProgression } from '@/lib/analytics-queries'
import { getSalesforceConnection } from '@/lib/salesforce'

/**
 * GET /api/admin/analytics/stage-progression
 * Get stage progression timeline for a merchant
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

    // Get merchant ID from query params
    const { searchParams } = new URL(request.url)
    const merchantId = searchParams.get('merchantId')

    if (!merchantId) {
      return NextResponse.json(
        { error: 'merchantId is required' },
        { status: 400 }
      )
    }

    // Get merchant data from Salesforce
    let merchantData
    try {
      const sfConn = await getSalesforceConnection()

      if (!sfConn) {
        console.error('[Stage Progression API] No Salesforce connection available')
        return NextResponse.json(
          { error: 'Salesforce connection not available' },
          { status: 500 }
        )
      }

      merchantData = await sfConn.sobject('Onboarding_Trainer__c').findOne(
        { Id: merchantId },
        [
          'Id',
          'Product_Setup_Status__c',
          'Menu_Collection_Submission_Timestamp__c',
          'Video_Proof_Link__c',
          'Timestamp_Pre_Installation_Proof_Link__c',
          'Hardware_Installation_Status__c',
          'Training_Status__c',
          'Installation_Date__c',
          'Training_Date__c'
        ]
      )

      if (!merchantData) {
        console.error('[Stage Progression API] Merchant not found:', merchantId)
        return NextResponse.json(
          { error: 'Merchant not found in Salesforce' },
          { status: 404 }
        )
      }

      console.log('[Stage Progression API] Found merchant:', merchantId, {
        productSetupStatus: merchantData.Product_Setup_Status__c,
        menuSubmissionTimestamp: merchantData.Menu_Collection_Submission_Timestamp__c,
        videoProofLink: merchantData.Video_Proof_Link__c,
        videoProofTimestamp: merchantData.Timestamp_Pre_Installation_Proof_Link__c,
        hardwareInstallationStatus: merchantData.Hardware_Installation_Status__c,
        trainingStatus: merchantData.Training_Status__c,
        installationDate: merchantData.Installation_Date__c,
        trainingDate: merchantData.Training_Date__c
      })
    } catch (sfError) {
      console.error('[Stage Progression API] Salesforce error:', sfError)
      return NextResponse.json(
        {
          error: 'Failed to fetch merchant from Salesforce',
          details: sfError instanceof Error ? sfError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Get stage progression from analytics
    const progression = await getStageProgression(merchantId, merchantData)

    return NextResponse.json({
      success: true,
      progression
    })

  } catch (error) {
    console.error('[Stage Progression API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch stage progression',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
