import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Helper function to apply test account filter to where clause
 */
function applyTestAccountFilter(whereClause: any, filters: AnalyticsFilters) {
  if (filters.testAccountFilter && filters.testAccountMerchantIds && filters.testAccountMerchantIds.length > 0) {
    const baseIds = filters.testAccountMerchantIds.map(id => id.substring(0, 15))

    if (filters.testAccountFilter === 'only') {
      // Only include test accounts
      whereClause.AND.push({
        OR: baseIds.map(baseId => ({
          merchantId: { startsWith: baseId }
        }))
      })
    } else if (filters.testAccountFilter === 'exclude') {
      // Exclude test accounts
      whereClause.AND.push({
        NOT: {
          OR: baseIds.map(baseId => ({
            merchantId: { startsWith: baseId }
          }))
        }
      })
    }
  }
}

export interface AnalyticsFilters {
  startDate?: Date
  endDate?: Date
  merchantId?: string
  page?: string
  action?: string
  isInternalUser?: boolean
  userType?: string
  testAccountFilter?: string
  testAccountMerchantIds?: string[]
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
  const whereClause: any = {
    AND: []
  }

  if (filters.startDate || filters.endDate) {
    const timestamp: any = {}
    if (filters.startDate) timestamp.gte = filters.startDate
    if (filters.endDate) timestamp.lte = filters.endDate
    whereClause.AND.push({ timestamp })
  }

  // Handle merchant ID - match both 15-char and 18-char versions
  if (filters.merchantId) {
    const baseId = filters.merchantId.substring(0, 15)
    whereClause.AND.push({
      OR: [
        { merchantId: baseId },
        { merchantId: { startsWith: baseId } }
      ]
    })
  }

  if (filters.page) whereClause.AND.push({ page: filters.page })
  if (filters.action) whereClause.AND.push({ action: filters.action })
  if (filters.isInternalUser !== undefined) whereClause.AND.push({ isInternalUser: filters.isInternalUser })
  if (filters.userType) whereClause.AND.push({ userType: filters.userType })

  // Apply test account filter
  applyTestAccountFilter(whereClause, filters)

  // If no AND conditions, use empty object
  const finalWhereClause = whereClause.AND.length > 0 ? whereClause : {}

  // Total page views
  const totalPageViews = await prisma.pageView.count({ where: finalWhereClause })

  // Unique merchants - get all distinct merchant IDs
  const merchantIds = await prisma.pageView.findMany({
    where: finalWhereClause,
    select: { merchantId: true },
    distinct: ['merchantId']
  })

  // Deduplicate Salesforce IDs (15-char vs 18-char versions)
  const uniqueMerchantBaseIds = new Set<string>()
  merchantIds.forEach(m => {
    if (m.merchantId) {
      // Use first 15 characters as the base ID
      uniqueMerchantBaseIds.add(m.merchantId.substring(0, 15))
    }
  })

  const uniqueMerchants = { length: uniqueMerchantBaseIds.size }

  // Unique sessions
  const uniqueSessions = await prisma.pageView.findMany({
    where: finalWhereClause,
    select: { sessionId: true },
    distinct: ['sessionId']
  })

  // Average pages per session
  const avgPagesPerSession = uniqueSessions.length > 0
    ? totalPageViews / uniqueSessions.length
    : 0

  // Login stats
  const loginWhereClause = { ...finalWhereClause }
  if (loginWhereClause.AND) {
    loginWhereClause.AND.push({ page: 'login' })
  } else {
    loginWhereClause.page = 'login'
  }
  const totalLogins = await prisma.pageView.count({ where: loginWhereClause })

  const successLoginWhereClause = { ...loginWhereClause }
  if (successLoginWhereClause.AND) {
    successLoginWhereClause.AND.push({ action: 'login_success' })
  } else {
    successLoginWhereClause.action = 'login_success'
  }
  const successfulLogins = await prisma.pageView.count({ where: successLoginWhereClause })

  const failedLoginWhereClause = { ...loginWhereClause }
  if (failedLoginWhereClause.AND) {
    failedLoginWhereClause.AND.push({ action: 'login_failed' })
  } else {
    failedLoginWhereClause.action = 'login_failed'
  }
  const failedLogins = await prisma.pageView.count({ where: failedLoginWhereClause })

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
  const whereClause: any = {
    AND: []
  }

  if (filters.startDate || filters.endDate) {
    const timestamp: any = {}
    if (filters.startDate) timestamp.gte = filters.startDate
    if (filters.endDate) timestamp.lte = filters.endDate
    whereClause.AND.push({ timestamp })
  }

  // Handle merchant ID - match both 15-char and 18-char versions
  if (filters.merchantId) {
    const baseId = filters.merchantId.substring(0, 15)
    whereClause.AND.push({
      OR: [
        { merchantId: baseId },
        { merchantId: { startsWith: baseId } }
      ]
    })
  }

  if (filters.page) whereClause.AND.push({ page: filters.page })
  if (filters.action) whereClause.AND.push({ action: filters.action })
  if (filters.isInternalUser !== undefined) whereClause.AND.push({ isInternalUser: filters.isInternalUser })
  if (filters.userType) whereClause.AND.push({ userType: filters.userType })

  // Apply test account filter
  applyTestAccountFilter(whereClause, filters)

  const finalWhereClause = whereClause.AND.length > 0 ? whereClause : {}

  // Get all page views
  const pageViews = await prisma.pageView.findMany({
    where: finalWhereClause,
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

    // Normalize merchant ID to 15-char base to avoid duplicates
    if (pv.merchantId) {
      group.merchants.add(pv.merchantId.substring(0, 15))
    }

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
  const whereClause: any = {
    AND: [{ merchantId: { not: null } }]
  }

  if (filters.startDate || filters.endDate) {
    const timestamp: any = {}
    if (filters.startDate) timestamp.gte = filters.startDate
    if (filters.endDate) timestamp.lte = filters.endDate
    whereClause.AND.push({ timestamp })
  }

  if (filters.page) whereClause.AND.push({ page: filters.page })
  if (filters.action) whereClause.AND.push({ action: filters.action })
  if (filters.isInternalUser !== undefined) whereClause.AND.push({ isInternalUser: filters.isInternalUser })
  if (filters.userType) whereClause.AND.push({ userType: filters.userType })

  // Apply test account filter
  applyTestAccountFilter(whereClause, filters)

  const finalWhereClause = whereClause.AND.length > 0 ? whereClause : { merchantId: { not: null } }

  // Get all page views grouped by merchant
  const pageViews = await prisma.pageView.findMany({
    where: finalWhereClause,
    select: {
      merchantId: true,
      merchantName: true,
      timestamp: true,
      sessionId: true
    }
  })

  // Group by merchant, normalizing Salesforce IDs
  const merchantMap = new Map<string, {
    merchantId: string
    merchantName: string
    totalViews: number
    lastVisit: Date
    sessions: Set<string>
  }>()

  pageViews.forEach(pv => {
    if (!pv.merchantId) return

    // Normalize to 15-character base ID to group duplicates
    const baseId = pv.merchantId.substring(0, 15)

    if (!merchantMap.has(baseId)) {
      merchantMap.set(baseId, {
        merchantId: pv.merchantId.length >= 18 ? pv.merchantId : baseId,
        merchantName: pv.merchantName || 'Unknown',
        totalViews: 0,
        lastVisit: pv.timestamp,
        sessions: new Set()
      })
    }

    const merchant = merchantMap.get(baseId)!

    // Prefer the 18-character ID if available
    if (pv.merchantId.length > merchant.merchantId.length) {
      merchant.merchantId = pv.merchantId
    }

    merchant.totalViews++
    merchant.sessions.add(pv.sessionId)
    if (pv.timestamp > merchant.lastVisit) {
      merchant.lastVisit = pv.timestamp
    }
  })

  // Convert to array and sort
  return Array.from(merchantMap.values())
    .map(data => ({
      merchantId: data.merchantId,
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
  const whereClause: any = {
    AND: []
  }

  if (filters.startDate || filters.endDate) {
    const timestamp: any = {}
    if (filters.startDate) timestamp.gte = filters.startDate
    if (filters.endDate) timestamp.lte = filters.endDate
    whereClause.AND.push({ timestamp })
  }

  // Handle merchant ID - match both 15-char and 18-char versions
  if (filters.merchantId) {
    const baseId = filters.merchantId.substring(0, 15)
    whereClause.AND.push({
      OR: [
        { merchantId: baseId },
        { merchantId: { startsWith: baseId } }
      ]
    })
  }

  if (filters.action) whereClause.AND.push({ action: filters.action })
  if (filters.isInternalUser !== undefined) whereClause.AND.push({ isInternalUser: filters.isInternalUser })
  if (filters.userType) whereClause.AND.push({ userType: filters.userType })

  // Apply test account filter
  applyTestAccountFilter(whereClause, filters)

  const finalWhereClause = whereClause.AND.length > 0 ? whereClause : {}

  // Get total count
  const total = await prisma.pageView.count({ where: finalWhereClause })

  // Group by page
  const pageViews = await prisma.pageView.groupBy({
    by: ['page'],
    where: finalWhereClause,
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
  const whereClause: any = {
    AND: []
  }

  if (filters.startDate || filters.endDate) {
    const timestamp: any = {}
    if (filters.startDate) timestamp.gte = filters.startDate
    if (filters.endDate) timestamp.lte = filters.endDate
    whereClause.AND.push({ timestamp })
  }

  // Handle merchant ID - match both 15-char and 18-char versions
  if (filters.merchantId) {
    const baseId = filters.merchantId.substring(0, 15)
    whereClause.AND.push({
      OR: [
        { merchantId: baseId },
        { merchantId: { startsWith: baseId } }
      ]
    })
  }

  if (filters.page) whereClause.AND.push({ page: filters.page })
  if (filters.action) whereClause.AND.push({ action: filters.action })
  if (filters.isInternalUser !== undefined) whereClause.AND.push({ isInternalUser: filters.isInternalUser })
  if (filters.userType) whereClause.AND.push({ userType: filters.userType })

  // Apply test account filter
  applyTestAccountFilter(whereClause, filters)

  const finalWhereClause = whereClause.AND.length > 0 ? whereClause : {}

  let activities: any[] = []

  try {
    // Try with deviceType first
    activities = await prisma.pageView.findMany({
      where: finalWhereClause,
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
  } catch (error: any) {
    // If deviceType column doesn't exist yet, query without it
    if (error.message?.includes('deviceType') || error.message?.includes('column')) {
      console.warn('[Analytics] deviceType column not found, querying without it')
      const activitiesWithoutDevice = await prisma.pageView.findMany({
        where: finalWhereClause,
        select: {
          id: true,
          merchantId: true,
          merchantName: true,
          page: true,
          action: true,
          timestamp: true,
          isInternalUser: true,
          userType: true
        },
        orderBy: { timestamp: 'desc' },
        take: limit
      })

      // Add null deviceType to match interface
      activities = activitiesWithoutDevice.map(a => ({ ...a, deviceType: null }))
    } else {
      throw error
    }
  }

  return activities
}

/**
 * Get menu submission metrics with actor breakdown
 */
export async function getMenuSubmissionMetrics(filters: AnalyticsFilters) {
  const whereClause: any = {
    AND: [{ action: 'menu_submitted' }]
  }

  if (filters.startDate || filters.endDate) {
    const timestamp: any = {}
    if (filters.startDate) timestamp.gte = filters.startDate
    if (filters.endDate) timestamp.lte = filters.endDate
    whereClause.AND.push({ timestamp })
  }

  // Handle merchant ID - match both 15-char and 18-char versions
  if (filters.merchantId) {
    const baseId = filters.merchantId.substring(0, 15)
    whereClause.AND.push({
      OR: [
        { merchantId: baseId },
        { merchantId: { startsWith: baseId } }
      ]
    })
  }

  // Apply test account filter
  applyTestAccountFilter(whereClause, filters)

  const finalWhereClause = whereClause.AND.length > 0 ? whereClause : { action: 'menu_submitted' }

  // Total menu submissions
  const totalSubmissions = await prisma.pageView.count({ where: finalWhereClause })

  // Submissions by actor type
  const byActor = await prisma.pageView.groupBy({
    by: ['isInternalUser'],
    where: finalWhereClause,
    _count: { id: true }
  })

  const internalCount = byActor.find(a => a.isInternalUser === true)?._count.id || 0
  const merchantCount = byActor.find(a => a.isInternalUser === false)?._count.id || 0

  return {
    totalSubmissions,
    internalSubmissions: internalCount,
    merchantSubmissions: merchantCount,
    internalPercentage: totalSubmissions > 0 ? Math.round((internalCount / totalSubmissions) * 100) : 0,
    merchantPercentage: totalSubmissions > 0 ? Math.round((merchantCount / totalSubmissions) * 100) : 0
  }
}

/**
 * Get training scheduling metrics with actor breakdown
 */
export async function getTrainingSchedulingMetrics(filters: AnalyticsFilters) {
  const whereClause: any = {
    AND: [{ action: 'training_scheduled' }]
  }

  if (filters.startDate || filters.endDate) {
    const timestamp: any = {}
    if (filters.startDate) timestamp.gte = filters.startDate
    if (filters.endDate) timestamp.lte = filters.endDate
    whereClause.AND.push({ timestamp })
  }

  // Handle merchant ID - match both 15-char and 18-char versions
  if (filters.merchantId) {
    const baseId = filters.merchantId.substring(0, 15)
    whereClause.AND.push({
      OR: [
        { merchantId: baseId },
        { merchantId: { startsWith: baseId } }
      ]
    })
  }

  // Apply test account filter
  applyTestAccountFilter(whereClause, filters)

  const finalWhereClause = whereClause.AND.length > 0 ? whereClause : { action: 'training_scheduled' }

  // Total training bookings
  const totalBookings = await prisma.pageView.count({ where: finalWhereClause })

  // Bookings by actor type
  const byActor = await prisma.pageView.groupBy({
    by: ['isInternalUser'],
    where: finalWhereClause,
    _count: { id: true }
  })

  const internalCount = byActor.find(a => a.isInternalUser === true)?._count.id || 0
  const merchantCount = byActor.find(a => a.isInternalUser === false)?._count.id || 0

  return {
    totalBookings,
    internalBookings: internalCount,
    merchantBookings: merchantCount,
    internalPercentage: totalBookings > 0 ? Math.round((internalCount / totalBookings) * 100) : 0,
    merchantPercentage: totalBookings > 0 ? Math.round((merchantCount / totalBookings) * 100) : 0
  }
}

/**
 * Get installation scheduling metrics with actor breakdown
 */
export async function getInstallationSchedulingMetrics(filters: AnalyticsFilters) {
  const whereClause: any = {
    AND: [{ action: 'installation_scheduled' }]
  }

  if (filters.startDate || filters.endDate) {
    const timestamp: any = {}
    if (filters.startDate) timestamp.gte = filters.startDate
    if (filters.endDate) timestamp.lte = filters.endDate
    whereClause.AND.push({ timestamp })
  }

  // Handle merchant ID - match both 15-char and 18-char versions
  if (filters.merchantId) {
    const baseId = filters.merchantId.substring(0, 15)
    whereClause.AND.push({
      OR: [
        { merchantId: baseId },
        { merchantId: { startsWith: baseId } }
      ]
    })
  }

  // Apply test account filter
  applyTestAccountFilter(whereClause, filters)

  const finalWhereClause = whereClause.AND.length > 0 ? whereClause : { action: 'installation_scheduled' }

  // Total installation bookings
  const totalBookings = await prisma.pageView.count({ where: finalWhereClause })

  // Bookings by actor type
  const byActor = await prisma.pageView.groupBy({
    by: ['isInternalUser'],
    where: finalWhereClause,
    _count: { id: true }
  })

  const internalCount = byActor.find(a => a.isInternalUser === true)?._count.id || 0
  const merchantCount = byActor.find(a => a.isInternalUser === false)?._count.id || 0

  return {
    totalBookings,
    internalBookings: internalCount,
    merchantBookings: merchantCount,
    internalPercentage: totalBookings > 0 ? Math.round((internalCount / totalBookings) * 100) : 0,
    merchantPercentage: totalBookings > 0 ? Math.round((merchantCount / totalBookings) * 100) : 0
  }
}

/**
 * Get stage progression timeline for a merchant
 * Combines Salesforce status with analytics tracking
 */
// Individual event within a stage's history
export interface StageEvent {
  timestamp: Date
  actor: 'merchant' | 'internal_team' | 'unknown'
  changeType: string  // Human-readable label like "Initial upload by merchant"
  metadata: any       // Original event metadata for additional context
}

// Stage progression with full history
export interface StageProgressionEvent {
  stage: string
  status: string
  events: StageEvent[]  // Array of all changes for this stage
  latestTimestamp: Date | null
  latestActor: 'merchant' | 'internal_team' | 'unknown'

  // Deprecated fields (kept for backward compatibility)
  timestamp?: Date | null
  actor?: 'merchant' | 'internal_team' | 'unknown'
}

export async function getStageProgression(
  merchantId: string,
  salesforceData: any
): Promise<StageProgressionEvent[]> {
  const baseId = merchantId.substring(0, 15)

  // Get ALL actions for this merchant to find who did what and when
  const activities = await prisma.pageView.findMany({
    where: {
      OR: [
        { merchantId: baseId },
        { merchantId: { startsWith: baseId } }
      ]
    },
    select: {
      page: true,
      action: true,
      timestamp: true,
      isInternalUser: true,
      userType: true,
      metadata: true
    },
    orderBy: { timestamp: 'asc' }
  })

  console.log(`[Stage Progression] Found ${activities.length} activities for merchant ${merchantId}`)

  // Log installation and training scheduling events specifically
  const installationEvents = activities.filter(a => a.action === 'installation_scheduled')
  const trainingEvents = activities.filter(a => a.action === 'training_scheduled')
  const menuEvents = activities.filter(a => a.action === 'menu_submitted')

  console.log('[Stage Progression] Installation scheduling events:', installationEvents.map(e => ({
    timestamp: e.timestamp,
    isInternalUser: e.isInternalUser,
    userType: e.userType,
    page: e.page
  })))

  console.log('[Stage Progression] Training scheduling events:', trainingEvents.map(e => ({
    timestamp: e.timestamp,
    isInternalUser: e.isInternalUser,
    userType: e.userType,
    page: e.page
  })))

  console.log('[Stage Progression] Menu submission events:', menuEvents.map(e => ({
    timestamp: e.timestamp,
    isInternalUser: e.isInternalUser,
    userType: e.userType,
    page: e.page
  })))

  // Build a map of ALL events for each stage (not just latest)
  const activityMap = new Map<string, Array<{
    timestamp: Date,
    actor: 'merchant' | 'internal_team',
    action: string,
    metadata: any
  }>>()

  activities.forEach(activity => {
    let stage = ''

    // Map analytics actions to onboarding stages
    if (activity.action === 'menu_submitted') {
      stage = 'Product Setup'
    } else if (activity.action === 'video_uploaded' || activity.action === 'form_submitted') {
      stage = 'Store Setup'
    } else if (activity.action === 'installation_scheduled') {
      stage = 'Installation'
    } else if (activity.action === 'training_scheduled') {
      stage = 'Training'
    }

    if (stage && activity.action) {
      const actor = activity.isInternalUser ? 'internal_team' : 'merchant'
      const existing = activityMap.get(stage) || []

      existing.push({
        timestamp: activity.timestamp,
        actor: actor,
        action: activity.action,
        metadata: activity.metadata
      })

      activityMap.set(stage, existing)
      console.log(`[Stage Progression] Added event to ${stage}: isInternalUser=${activity.isInternalUser}, actor=${actor}, timestamp=${activity.timestamp}`)
    }
  })

  // Sort events within each stage by timestamp (newest first)
  activityMap.forEach((events, stage) => {
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  })

  // Helper function to generate human-readable change type labels
  const generateChangeType = (
    stage: string,
    index: number,
    totalEvents: number,
    actor: 'merchant' | 'internal_team',
    metadata: any
  ): string => {
    const isFirst = index === totalEvents - 1  // Last in array (oldest) = first chronologically
    const actorLabel = actor === 'internal_team' ? 'internal team' : 'merchant'

    // Product Setup (menu submissions)
    if (stage === 'Product Setup') {
      return isFirst
        ? `Initial submission by ${actorLabel}`
        : `Re-submitted by ${actorLabel}`
    }

    // Store Setup (video uploads)
    if (stage === 'Store Setup') {
      if (metadata?.isReplacement) {
        return `Replaced by ${actorLabel}`
      }
      return isFirst
        ? `Initial upload by ${actorLabel}`
        : `Replaced by ${actorLabel}`
    }

    // Installation scheduling
    if (stage === 'Installation') {
      if (metadata?.isRescheduling) {
        return `Rescheduled by ${actorLabel}`
      }
      return isFirst
        ? `Initially scheduled by ${actorLabel}`
        : `Rescheduled by ${actorLabel}`
    }

    // Training scheduling
    if (stage === 'Training') {
      if (metadata?.isRescheduling) {
        return `Rescheduled by ${actorLabel}`
      }
      return isFirst
        ? `Initially scheduled by ${actorLabel}`
        : `Rescheduled by ${actorLabel}`
    }

    // Fallback
    return `Updated by ${actorLabel}`
  }

  // Log Salesforce data for debugging
  console.log('[Stage Progression] Salesforce data:', {
    productSetupStatus: salesforceData.Product_Setup_Status__c,
    menuSubmissionTimestamp: salesforceData.Menu_Collection_Submission_Timestamp__c,
    videoProofLink: salesforceData.Video_Proof_Link__c,
    videoProofTimestamp: salesforceData.Timestamp_Pre_Installation_Proof_Link__c,
    installationStatus: salesforceData.Hardware_Installation_Status__c,
    trainingStatus: salesforceData.Training_Status__c,
    installationDate: salesforceData.Installation_Date__c,
    trainingDate: salesforceData.Training_Date__c
  })

  // Now build the progression based on Salesforce data + analytics
  const progression: StageProgressionEvent[] = []

  // Product Setup - check if menu has been submitted
  const menuSubmissionTimestamp = salesforceData.Menu_Collection_Submission_Timestamp__c
  const productSetupStatus = salesforceData.Product_Setup_Status__c
  const hasMenuSubmitted = menuSubmissionTimestamp != null && menuSubmissionTimestamp !== ''

  console.log('[Stage Progression] Product Setup check:', {
    menuSubmissionTimestamp,
    productSetupStatus,
    hasMenuSubmitted
  })

  if (hasMenuSubmitted) {
    const activityEvents = activityMap.get('Product Setup') || []
    // Determine status from Product_Setup_Status__c field
    let status = 'Done'
    if (productSetupStatus) {
      const isDone = productSetupStatus.toLowerCase().includes('complete') ||
                     productSetupStatus.toLowerCase().includes('done') ||
                     productSetupStatus === 'Yes'
      status = isDone ? 'Done' : productSetupStatus
    }

    // Build events array with change type labels
    const events: StageEvent[] = activityEvents.map((event, index) => ({
      timestamp: event.timestamp,
      actor: event.actor,
      changeType: generateChangeType('Product Setup', index, activityEvents.length, event.actor, event.metadata),
      metadata: event.metadata
    }))

    // If no analytics events, create fallback from Salesforce timestamp
    if (events.length === 0 && menuSubmissionTimestamp) {
      events.push({
        timestamp: new Date(menuSubmissionTimestamp),
        actor: 'merchant',  // Menu submissions are always done by merchants via external form
        changeType: 'Submitted by merchant',
        metadata: {}
      })
    }

    progression.push({
      stage: 'Product Setup',
      status: status,
      events: events,
      latestTimestamp: events[0]?.timestamp || null,
      latestActor: events[0]?.actor || 'merchant',
      // Deprecated fields for backward compatibility
      timestamp: events[0]?.timestamp || null,
      actor: events[0]?.actor || 'merchant'
    })
    console.log('[Stage Progression] Added Product Setup to progression:', {
      eventCount: events.length,
      latestTimestamp: events[0]?.timestamp,
      latestActor: events[0]?.actor || 'merchant (default)'
    })
  }

  // Store Setup - check if video has been uploaded
  const hasVideoProof = salesforceData.Video_Proof_Link__c != null &&
                        salesforceData.Video_Proof_Link__c !== '' &&
                        salesforceData.Video_Proof_Link__c.trim() !== ''
  const videoUploadTimestamp = salesforceData.Timestamp_Pre_Installation_Proof_Link__c

  console.log('[Stage Progression] Store Setup check:', {
    videoProofLink: salesforceData.Video_Proof_Link__c,
    videoUploadTimestamp,
    hasVideoProof
  })

  if (hasVideoProof) {
    const activityEvents = activityMap.get('Store Setup') || []

    // Build events array with change type labels
    const events: StageEvent[] = activityEvents.map((event, index) => ({
      timestamp: event.timestamp,
      actor: event.actor,
      changeType: generateChangeType('Store Setup', index, activityEvents.length, event.actor, event.metadata),
      metadata: event.metadata
    }))

    // If no analytics events, create fallback from Salesforce timestamp
    if (events.length === 0 && videoUploadTimestamp) {
      events.push({
        timestamp: new Date(videoUploadTimestamp),
        actor: 'unknown',
        changeType: 'Completed via Salesforce',
        metadata: {}
      })
    }

    progression.push({
      stage: 'Store Setup',
      status: 'Done',
      events: events,
      latestTimestamp: events[0]?.timestamp || null,
      latestActor: events[0]?.actor || 'merchant',
      // Deprecated fields for backward compatibility
      timestamp: events[0]?.timestamp || null,
      actor: events[0]?.actor || 'merchant'
    })
    console.log('[Stage Progression] Added Store Setup to progression:', {
      eventCount: events.length,
      latestTimestamp: events[0]?.timestamp,
      latestActor: events[0]?.actor || 'merchant (default)'
    })
  }

  // Installation - check status and date
  const installationStatus = salesforceData.Hardware_Installation_Status__c
  const installationDate = salesforceData.Installation_Date__c
  const hasInstallation = (installationStatus && installationStatus !== 'Not Started') || installationDate

  console.log('[Stage Progression] Installation check:', {
    installationStatus,
    installationDate,
    hasInstallation
  })

  if (hasInstallation) {
    const activityEvents = activityMap.get('Installation') || []

    // Build events array with change type labels
    const events: StageEvent[] = activityEvents.map((event, index) => ({
      timestamp: event.timestamp,
      actor: event.actor,
      changeType: generateChangeType('Installation', index, activityEvents.length, event.actor, event.metadata),
      metadata: event.metadata
    }))

    // If no analytics events, show stage but indicate data is not available
    if (events.length === 0) {
      events.push({
        timestamp: new Date(), // Use current time as placeholder
        actor: 'unknown',
        changeType: 'Booking data not tracked',
        metadata: { noTrackingData: true }
      })
    }

    progression.push({
      stage: 'Installation',
      status: installationStatus || 'Scheduled',
      events: events,
      latestTimestamp: events.length > 0 && !events[0].metadata?.noTrackingData ? events[0].timestamp : null,
      latestActor: events[0]?.actor || 'unknown',
      // Deprecated fields for backward compatibility
      timestamp: events.length > 0 && !events[0].metadata?.noTrackingData ? events[0].timestamp : null,
      actor: events[0]?.actor || 'unknown'
    })
    console.log('[Stage Progression] Added Installation to progression:', {
      eventCount: events.length,
      hasTrackingData: !events[0]?.metadata?.noTrackingData
    })
  }

  // Training - check status and date
  const trainingStatus = salesforceData.Training_Status__c
  const trainingDate = salesforceData.Training_Date__c
  const hasTraining = (trainingStatus && trainingStatus !== 'Not Started') || trainingDate

  console.log('[Stage Progression] Training check:', {
    trainingStatus,
    trainingDate,
    hasTraining
  })

  if (hasTraining) {
    const activityEvents = activityMap.get('Training') || []

    // Build events array with change type labels
    const events: StageEvent[] = activityEvents.map((event, index) => ({
      timestamp: event.timestamp,
      actor: event.actor,
      changeType: generateChangeType('Training', index, activityEvents.length, event.actor, event.metadata),
      metadata: event.metadata
    }))

    // If no analytics events, show stage but indicate data is not available
    if (events.length === 0) {
      events.push({
        timestamp: new Date(), // Use current time as placeholder
        actor: 'unknown',
        changeType: 'Booking data not tracked',
        metadata: { noTrackingData: true }
      })
    }

    progression.push({
      stage: 'Training',
      status: trainingStatus || 'Scheduled',
      events: events,
      latestTimestamp: events.length > 0 && !events[0].metadata?.noTrackingData ? events[0].timestamp : null,
      latestActor: events[0]?.actor || 'unknown',
      // Deprecated fields for backward compatibility
      timestamp: events.length > 0 && !events[0].metadata?.noTrackingData ? events[0].timestamp : null,
      actor: events[0]?.actor || 'unknown'
    })
    console.log('[Stage Progression] Added Training to progression:', {
      eventCount: events.length,
      hasTrackingData: !events[0].metadata?.noTrackingData
    })
  }

  console.log('[Stage Progression] Returning events:', progression)

  return progression
}

