import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/auth-utils'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * GET /api/admin/merchants
 * Get list of all unique merchants from analytics data
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

    // Format the response
    const merchantList = merchants.map(m => ({
      id: m.merchantId,
      name: m.merchantName || 'Unknown'
    }))

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

