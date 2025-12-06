import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/auth-utils'
import { PrismaClient } from '@prisma/client'
import { getSalesforceConnection } from '@/lib/salesforce'

const prisma = new PrismaClient()

/**
 * GET /api/admin/merchants
 * Get list of all unique merchants from analytics data with Salesforce portal access flag
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

    // Get all unique merchants from page views
    const merchants = await prisma.pageView.findMany({
      where: {
        merchantId: { not: null }
      },
      select: {
        merchantId: true,
        merchantName: true
      },
      distinct: ['merchantId'],
      orderBy: {
        merchantName: 'asc'
      }
    })

    // Normalize Salesforce IDs to 18-character format and deduplicate
    const merchantMap = new Map<string, { id: string; name: string }>()

    merchants.forEach(m => {
      if (!m.merchantId) return

      // Use the longer ID (18-char) as the canonical ID
      // If we have both 15 and 18 char versions, keep the 18-char one
      const baseId = m.merchantId.substring(0, 15)
      const existingMerchant = merchantMap.get(baseId)

      if (!existingMerchant || m.merchantId.length > existingMerchant.id.length) {
        merchantMap.set(baseId, {
          id: m.merchantId,
          name: m.merchantName || 'Unknown'
        })
      }
    })

    // Get merchant IDs to query Salesforce
    const merchantIds = Array.from(merchantMap.values()).map(m => m.id)

    // Query Salesforce for Onboarding_Portal_Access__c
    const conn = await getSalesforceConnection()
    if (!conn) {
      console.error('[Admin Merchants API] Failed to connect to Salesforce')
      // Return merchants without portal access flag
      const merchantList = Array.from(merchantMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      return NextResponse.json({
        success: true,
        merchants: merchantList.map(m => ({ ...m, hasPortalAccess: false })),
        count: merchantList.length
      })
    }

    // Query Salesforce for portal access via Onboarding_Portal__c
    // Onboarding_Portal_Access__c is on Onboarding_Portal__c, linked via Onboarding_Trainer_Record__c
    const batchSize = 50
    const portalAccessMap = new Map<string, boolean>()

    for (let i = 0; i < merchantIds.length; i += batchSize) {
      const batch = merchantIds.slice(i, i + batchSize)
      const idList = batch.map(id => `'${id}'`).join(',')

      try {
        const result = await conn.query(`
          SELECT Onboarding_Trainer_Record__c, Onboarding_Portal_Access__c
          FROM Onboarding_Portal__c
          WHERE Onboarding_Trainer_Record__c IN (${idList})
        `)

        if (result.records) {
          result.records.forEach((record: any) => {
            portalAccessMap.set(record.Onboarding_Trainer_Record__c, record.Onboarding_Portal_Access__c === true)
          })
        }
      } catch (error) {
        console.error('[Admin Merchants API] Error querying Salesforce batch:', error)
      }
    }

    // Convert to array with portal access flag and sort by name
    const merchantList = Array.from(merchantMap.values()).map(m => ({
      ...m,
      hasPortalAccess: portalAccessMap.get(m.id) || false
    })).sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      success: true,
      merchants: merchantList,
      count: merchantList.length
    })

  } catch (error) {
    console.error('[Admin Merchants API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch merchants',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

