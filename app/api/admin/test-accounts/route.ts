import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/auth-utils'
import { getSalesforceConnection } from '@/lib/salesforce'

/**
 * GET /api/admin/test-accounts
 * Get list of test account merchant IDs from Salesforce
 */
export async function GET() {
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

    // Query Salesforce for test accounts
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json({
        success: true,
        merchantIds: []
      })
    }

    try {
      const result = await conn.query(`
        SELECT Onboarding_Trainer_Record__c
        FROM Onboarding_Portal__c
        WHERE Is_test_account__c = true
      `)

      const merchantIds = result.records
        ? result.records
            .map((record: any) => record.Onboarding_Trainer_Record__c)
            .filter((id: any) => id != null)
        : []

      return NextResponse.json({
        success: true,
        merchantIds
      })
    } catch (error) {
      console.error('[Test Accounts API] Error querying Salesforce:', error)
      return NextResponse.json({
        success: true,
        merchantIds: []
      })
    }
  } catch (error) {
    console.error('[Test Accounts API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch test accounts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
