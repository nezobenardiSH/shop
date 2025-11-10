import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/auth-utils'
import {
  getSummaryStats,
  getTimeSeriesData,
  getTopMerchants,
  getPageBreakdown,
  getRecentActivity,
  getMenuSubmissionMetrics,
  getTrainingSchedulingMetrics,
  getInstallationSchedulingMetrics,
  AnalyticsFilters
} from '@/lib/analytics-queries'

/**
 * GET /api/admin/analytics
 * Query analytics data with filters
 * 
 * Query Parameters:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - merchantId: Filter by specific merchant
 * - page: Filter by page type
 * - action: Filter by action type
 * - isInternalUser: Filter by internal user (true/false)
 * - userType: Filter by user type ('merchant', 'internal_team', 'admin')
 * - groupBy: Time series grouping ('day', 'week', 'month')
 * - limit: Limit for top merchants and recent activity (default: 10)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    
    // Date filters (default: last 30 days)
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!)
      : new Date()
    
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    // Other filters
    const merchantId = searchParams.get('merchantId') || undefined
    const page = searchParams.get('page') || undefined
    const action = searchParams.get('action') || undefined
    const userType = searchParams.get('userType') || undefined
    
    const isInternalUserParam = searchParams.get('isInternalUser')
    const isInternalUser = isInternalUserParam 
      ? isInternalUserParam === 'true' 
      : undefined

    // Options
    const groupBy = (searchParams.get('groupBy') || 'day') as 'day' | 'week' | 'month'
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build filters object
    const filters: AnalyticsFilters = {
      startDate,
      endDate,
      merchantId,
      page,
      action,
      isInternalUser,
      userType
    }

    // Execute all queries in parallel
    const [
      summary,
      timeSeriesData,
      topMerchants,
      pageBreakdown,
      recentActivity,
      menuSubmissionMetrics,
      trainingSchedulingMetrics,
      installationSchedulingMetrics
    ] = await Promise.all([
      getSummaryStats(filters),
      getTimeSeriesData(filters, groupBy),
      getTopMerchants(filters, limit),
      getPageBreakdown(filters),
      getRecentActivity(filters, limit),
      getMenuSubmissionMetrics(filters),
      getTrainingSchedulingMetrics(filters),
      getInstallationSchedulingMetrics(filters)
    ]).catch((error) => {
      // Check if it's a "table does not exist" error
      if (error.message?.includes('does not exist')) {
        console.error('[Analytics API] PageView table does not exist. Migration may not have run.')
        throw new Error('Analytics database not initialized. Please contact support.')
      }
      throw error
    })

    // Return combined response
    return NextResponse.json({
      success: true,
      filters: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        merchantId,
        page,
        action,
        isInternalUser,
        userType,
        groupBy,
        limit
      },
      summary,
      timeSeriesData,
      topMerchants,
      pageBreakdown,
      recentActivity,
      menuSubmissionMetrics,
      trainingSchedulingMetrics,
      installationSchedulingMetrics
    })

  } catch (error) {
    console.error('[Analytics API] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

