import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface AnalyticsFilters {
  startDate?: Date
  endDate?: Date
  merchantId?: string
  page?: string
  action?: string
  isInternalUser?: boolean
  userType?: string
}

export interface SummaryStats {
  totalPageViews: number
  uniqueMerchants: number
  uniqueSessions: number
  avgPagesPerSession: number
  totalLogins: number
  successfulLogins: number
  failedLogins: number
}

export interface TimeSeriesDataPoint {
  date: string
  pageViews: number
  uniqueSessions: number
  uniqueMerchants: number
  merchantPageViews: number
  internalPageViews: number
}

export interface TopMerchant {
  merchantId: string
  merchantName: string
  totalViews: number
  lastVisit: Date
  uniqueSessions: number
}

export interface PageBreakdown {
  page: string
  count: number
  percentage: number
}

export interface RecentActivity {
  id: string
  merchantId: string | null
  merchantName: string | null
  page: string
  action: string | null
  deviceType: string | null
  timestamp: Date
  isInternalUser: boolean
  userType: string | null
}

/**
 * Get summary statistics
 */
export async function getSummaryStats(filters: AnalyticsFilters): Promise<SummaryStats> {
  const whereClause: any = {}

  if (filters.startDate || filters.endDate) {
    whereClause.timestamp = {}
    if (filters.startDate) whereClause.timestamp.gte = filters.startDate
    if (filters.endDate) whereClause.timestamp.lte = filters.endDate
  }

  if (filters.merchantId) whereClause.merchantId = filters.merchantId
  if (filters.page) whereClause.page = filters.page
  if (filters.action) whereClause.action = filters.action
  if (filters.isInternalUser !== undefined) whereClause.isInternalUser = filters.isInternalUser
  if (filters.userType) whereClause.userType = filters.userType

  // Total page views
  const totalPageViews = await prisma.pageView.count({ where: whereClause })

  // Unique merchants
  const uniqueMerchants = await prisma.pageView.findMany({
    where: whereClause,
    select: { merchantId: true },
    distinct: ['merchantId']
  })

  // Unique sessions
  const uniqueSessions = await prisma.pageView.findMany({
    where: whereClause,
    select: { sessionId: true },
    distinct: ['sessionId']
  })

  // Average pages per session
  const avgPagesPerSession = uniqueSessions.length > 0
    ? totalPageViews / uniqueSessions.length
    : 0

  // Login stats
  const loginWhereClause = { ...whereClause, page: 'login' }
  const totalLogins = await prisma.pageView.count({ where: loginWhereClause })

  const successfulLogins = await prisma.pageView.count({
    where: { ...loginWhereClause, action: 'login_success' }
  })

  const failedLogins = await prisma.pageView.count({
    where: { ...loginWhereClause, action: 'login_failed' }
  })

  return {
    totalPageViews,
    uniqueMerchants: uniqueMerchants.length,
    uniqueSessions: uniqueSessions.length,
    avgPagesPerSession: Math.round(avgPagesPerSession * 10) / 10,
    totalLogins,
    successfulLogins,
    failedLogins
  }
}

/**
 * Get time series data grouped by day/week/month
 */
export async function getTimeSeriesData(
  filters: AnalyticsFilters,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<TimeSeriesDataPoint[]> {
  const whereClause: any = {}
  
  if (filters.startDate || filters.endDate) {
    whereClause.timestamp = {}
    if (filters.startDate) whereClause.timestamp.gte = filters.startDate
    if (filters.endDate) whereClause.timestamp.lte = filters.endDate
  }
  
  if (filters.merchantId) whereClause.merchantId = filters.merchantId
  if (filters.page) whereClause.page = filters.page
  if (filters.action) whereClause.action = filters.action
  if (filters.isInternalUser !== undefined) whereClause.isInternalUser = filters.isInternalUser
  if (filters.userType) whereClause.userType = filters.userType

  // Get all page views
  const pageViews = await prisma.pageView.findMany({
    where: whereClause,
    select: {
      timestamp: true,
      sessionId: true,
      merchantId: true,
      isInternalUser: true
    },
    orderBy: { timestamp: 'asc' }
  })

  // Group by date
  const grouped = new Map<string, {
    pageViews: number
    sessions: Set<string>
    merchants: Set<string>
    merchantPageViews: number
    internalPageViews: number
  }>()

  pageViews.forEach(pv => {
    const date = new Date(pv.timestamp)
    let key: string

    if (groupBy === 'day') {
      key = date.toISOString().split('T')[0]
    } else if (groupBy === 'week') {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      key = weekStart.toISOString().split('T')[0]
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        pageViews: 0,
        sessions: new Set(),
        merchants: new Set(),
        merchantPageViews: 0,
        internalPageViews: 0
      })
    }

    const group = grouped.get(key)!
    group.pageViews++
    group.sessions.add(pv.sessionId)
    if (pv.merchantId) group.merchants.add(pv.merchantId)

    // Track merchant vs internal page views
    if (pv.isInternalUser) {
      group.internalPageViews++
    } else {
      group.merchantPageViews++
    }
  })

  // Convert to array
  return Array.from(grouped.entries()).map(([date, data]) => ({
    date,
    pageViews: data.pageViews,
    uniqueSessions: data.sessions.size,
    uniqueMerchants: data.merchants.size,
    merchantPageViews: data.merchantPageViews,
    internalPageViews: data.internalPageViews
  }))
}

/**
 * Get top merchants by page views
 */
export async function getTopMerchants(
  filters: AnalyticsFilters,
  limit: number = 10
): Promise<TopMerchant[]> {
  const whereClause: any = {}
  
  if (filters.startDate || filters.endDate) {
    whereClause.timestamp = {}
    if (filters.startDate) whereClause.timestamp.gte = filters.startDate
    if (filters.endDate) whereClause.timestamp.lte = filters.endDate
  }
  
  if (filters.page) whereClause.page = filters.page
  if (filters.action) whereClause.action = filters.action
  if (filters.isInternalUser !== undefined) whereClause.isInternalUser = filters.isInternalUser
  if (filters.userType) whereClause.userType = filters.userType

  // Get all page views grouped by merchant
  const pageViews = await prisma.pageView.findMany({
    where: {
      ...whereClause,
      merchantId: { not: null }
    },
    select: {
      merchantId: true,
      merchantName: true,
      timestamp: true,
      sessionId: true
    }
  })

  // Group by merchant
  const merchantMap = new Map<string, {
    merchantName: string
    totalViews: number
    lastVisit: Date
    sessions: Set<string>
  }>()

  pageViews.forEach(pv => {
    if (!pv.merchantId) return

    if (!merchantMap.has(pv.merchantId)) {
      merchantMap.set(pv.merchantId, {
        merchantName: pv.merchantName || 'Unknown',
        totalViews: 0,
        lastVisit: pv.timestamp,
        sessions: new Set()
      })
    }

    const merchant = merchantMap.get(pv.merchantId)!
    merchant.totalViews++
    merchant.sessions.add(pv.sessionId)
    if (pv.timestamp > merchant.lastVisit) {
      merchant.lastVisit = pv.timestamp
    }
  })

  // Convert to array and sort
  return Array.from(merchantMap.entries())
    .map(([merchantId, data]) => ({
      merchantId,
      merchantName: data.merchantName,
      totalViews: data.totalViews,
      lastVisit: data.lastVisit,
      uniqueSessions: data.sessions.size
    }))
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, limit)
}

/**
 * Get page breakdown
 */
export async function getPageBreakdown(filters: AnalyticsFilters): Promise<PageBreakdown[]> {
  const whereClause: any = {}
  
  if (filters.startDate || filters.endDate) {
    whereClause.timestamp = {}
    if (filters.startDate) whereClause.timestamp.gte = filters.startDate
    if (filters.endDate) whereClause.timestamp.lte = filters.endDate
  }
  
  if (filters.merchantId) whereClause.merchantId = filters.merchantId
  if (filters.action) whereClause.action = filters.action
  if (filters.isInternalUser !== undefined) whereClause.isInternalUser = filters.isInternalUser
  if (filters.userType) whereClause.userType = filters.userType

  // Get total count
  const total = await prisma.pageView.count({ where: whereClause })

  // Group by page
  const pageViews = await prisma.pageView.groupBy({
    by: ['page'],
    where: whereClause,
    _count: { page: true }
  })

  return pageViews.map(pv => ({
    page: pv.page,
    count: pv._count.page,
    percentage: total > 0 ? Math.round((pv._count.page / total) * 100 * 10) / 10 : 0
  })).sort((a, b) => b.count - a.count)
}

/**
 * Get recent activity
 */
export async function getRecentActivity(
  filters: AnalyticsFilters,
  limit: number = 20
): Promise<RecentActivity[]> {
  const whereClause: any = {}
  
  if (filters.startDate || filters.endDate) {
    whereClause.timestamp = {}
    if (filters.startDate) whereClause.timestamp.gte = filters.startDate
    if (filters.endDate) whereClause.timestamp.lte = filters.endDate
  }
  
  if (filters.merchantId) whereClause.merchantId = filters.merchantId
  if (filters.page) whereClause.page = filters.page
  if (filters.action) whereClause.action = filters.action
  if (filters.isInternalUser !== undefined) whereClause.isInternalUser = filters.isInternalUser
  if (filters.userType) whereClause.userType = filters.userType

  const activities = await prisma.pageView.findMany({
    where: whereClause,
    select: {
      id: true,
      merchantId: true,
      merchantName: true,
      page: true,
      action: true,
      deviceType: true,
      timestamp: true,
      isInternalUser: true,
      userType: true
    },
    orderBy: { timestamp: 'desc' },
    take: limit
  })

  return activities
}

