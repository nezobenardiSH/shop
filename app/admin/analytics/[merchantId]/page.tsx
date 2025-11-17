'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

// Helper function to extract stage from page field
const extractStage = (page: string): string | null => {
  if (!page || !page.includes('?stage=')) return null
  const match = page.match(/\?stage=([\w-]+)/)
  return match ? match[1] : null
}

interface SummaryStats {
  totalPageViews: number
  uniqueSessions: number
  avgPagesPerSession: number
}

interface TimeSeriesDataPoint {
  date: string
  pageViews: number
  uniqueSessions: number
  merchantPageViews: number
  internalPageViews: number
}

interface PageBreakdown {
  page: string
  count: number
  percentage: number
}

interface StageBreakdown {
  stage: string
  count: number
  percentage: number
}

interface RecentActivity {
  id: string
  merchantId: string | null
  merchantName: string | null
  page: string
  action: string | null
  deviceType: string | null
  timestamp: string
  isInternalUser: boolean
  userType: string | null
}

interface StageEvent {
  timestamp: string
  actor: 'merchant' | 'internal_team' | 'unknown'
  changeType: string
  metadata: any
}

interface StageProgressionEvent {
  stage: string
  status: string
  events: StageEvent[]
  latestTimestamp: string | null
  latestActor: 'merchant' | 'internal_team' | 'unknown'
  // Deprecated fields for backward compatibility
  timestamp?: string | null
  actor?: 'merchant' | 'internal_team' | 'unknown'
}

interface AnalyticsData {
  success: boolean
  filters: {
    startDate: string
    endDate: string
    merchantId?: string
    page?: string
    action?: string
    isInternalUser?: boolean
    userType?: string
    groupBy: string
    limit: number
  }
  summary: SummaryStats
  timeSeriesData: TimeSeriesDataPoint[]
  pageBreakdown: PageBreakdown[]
  recentActivity: RecentActivity[]
}

export default function MerchantAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const merchantId = params.merchantId as string

  const [isLoading, setIsLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [merchantName, setMerchantName] = useState<string>('')
  const [stageProgression, setStageProgression] = useState<StageProgressionEvent[]>([])
  const [loadingProgression, setLoadingProgression] = useState(true)
  const [progressionError, setProgressionError] = useState<string | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())

  // Filters
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'merchant' | 'internal_team'>('all')
  const [pageFilter, setPageFilter] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

  useEffect(() => {
    fetchAnalytics()
  }, [merchantId, dateRange, startDate, endDate, userTypeFilter, pageFilter, groupBy])

  useEffect(() => {
    fetchStageProgression()
  }, [merchantId])

  const fetchStageProgression = async () => {
    setLoadingProgression(true)
    setProgressionError(null)
    try {
      const response = await fetch(`/api/admin/analytics/stage-progression?merchantId=${merchantId}`)

      // Get response text first to debug
      const responseText = await response.text()
      console.log('[Stage Progression] Response status:', response.status)
      console.log('[Stage Progression] Response text:', responseText)

      if (!response.ok) {
        let errorData
        try {
          errorData = JSON.parse(responseText)
        } catch (e) {
          console.error('[Stage Progression] Failed to parse error response:', responseText)
          throw new Error(`API error (${response.status}): ${responseText || 'Unknown error'}`)
        }
        console.error('[Stage Progression] API error:', errorData)
        throw new Error(errorData.details || errorData.error || `Failed to fetch stage progression (${response.status})`)
      }

      const data = JSON.parse(responseText)
      if (data.success) {
        setStageProgression(data.progression || [])
      }
    } catch (err) {
      console.error('[Stage Progression] Error:', err)
      setProgressionError(err instanceof Error ? err.message : 'Failed to fetch stage progression')
    } finally {
      setLoadingProgression(false)
    }
  }

  const fetchAnalytics = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Build query parameters
      const params = new URLSearchParams()

      // Date range
      const now = new Date()
      let start: Date
      let end: Date = now

      if (dateRange === 'custom' && startDate && endDate) {
        start = new Date(startDate)
        end = new Date(endDate)
      } else if (dateRange === '7d') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else if (dateRange === '90d') {
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      } else {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }

      params.append('startDate', start.toISOString())
      params.append('endDate', end.toISOString())

      // Merchant filter
      params.append('merchantId', merchantId)

      // User type filter
      if (userTypeFilter !== 'all') {
        params.append('isInternalUser', userTypeFilter === 'internal_team' ? 'true' : 'false')
      }

      // Page filter
      if (pageFilter !== 'all') {
        params.append('page', pageFilter)
      }

      // Group by
      params.append('groupBy', groupBy)

      // Limit
      params.append('limit', '1000')

      const response = await fetch(`/api/admin/analytics?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const data = await response.json()
      if (data.success) {
        setAnalyticsData(data)
        // Get merchant name from first activity
        if (data.recentActivity && data.recentActivity.length > 0) {
          setMerchantName(data.recentActivity[0].merchantName || merchantId)
        }
      } else {
        throw new Error(data.error || 'Failed to fetch analytics')
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate stage breakdown from activities
  const getStageBreakdown = (): StageBreakdown[] => {
    if (!analyticsData?.recentActivity) return []

    const stageCounts: Record<string, number> = {}
    let total = 0

    analyticsData.recentActivity.forEach(activity => {
      const stage = extractStage(activity.page)
      if (stage) {
        stageCounts[stage] = (stageCounts[stage] || 0) + 1
        total++
      }
    })

    return Object.entries(stageCounts)
      .map(([stage, count]) => ({
        stage,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
  }

  const stageBreakdown = getStageBreakdown()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin/analytics')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Back to Analytics
          </button>
        </div>
      </div>
    )
  }

  if (!analyticsData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin/analytics')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Analytics
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Analytics: {merchantName}
          </h1>
          <p className="text-gray-500 mt-1">Merchant ID: {merchantId}</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* User Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">User Type</label>
              <select
                value={userTypeFilter}
                onChange={(e) => setUserTypeFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Users</option>
                <option value="merchant">Merchants</option>
                <option value="internal_team">Internal Team</option>
              </select>
            </div>

            {/* Page Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Page</label>
              <select
                value={pageFilter}
                onChange={(e) => setPageFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Pages</option>
                {analyticsData.pageBreakdown.map(page => (
                  <option key={page.page} value={page.page}>{page.page}</option>
                ))}
              </select>
            </div>

            {/* Group By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Group By</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Page Views</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{analyticsData.summary.totalPageViews}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unique Sessions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{analyticsData.summary.uniqueSessions}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Pages / Session</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{analyticsData.summary.avgPagesPerSession.toFixed(1)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Page Views Over Time */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Page Views Over Time</h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Merchants</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span className="text-gray-600">Internal Team</span>
              </div>
            </div>
          </div>
          {analyticsData.timeSeriesData.length > 0 ? (
            <div className="space-y-2">
              {analyticsData.timeSeriesData.map((dataPoint, index) => {
                const maxViews = Math.max(...analyticsData.timeSeriesData.map(d => d.pageViews))
                const totalBarWidth = maxViews > 0 ? (dataPoint.pageViews / maxViews) * 100 : 0
                const merchantBarWidth = maxViews > 0 ? (dataPoint.merchantPageViews / maxViews) * 100 : 0
                const internalBarWidth = maxViews > 0 ? (dataPoint.internalPageViews / maxViews) * 100 : 0

                return (
                  <div key={index} className="flex items-center gap-4 group">
                    <div className="w-32 text-sm text-gray-600 flex-shrink-0">
                      {new Date(dataPoint.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: groupBy === 'month' ? 'numeric' : undefined
                      })}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        {/* Stacked horizontal bars */}
                        <div className="flex h-full">
                          {/* Merchant views (left/first) */}
                          {dataPoint.merchantPageViews > 0 && (
                            <div
                              className="bg-blue-500 h-full flex items-center justify-center transition-all duration-300"
                              style={{ width: `${merchantBarWidth}%` }}
                              title={`Merchants: ${dataPoint.merchantPageViews}`}
                            >
                              {merchantBarWidth > 10 && (
                                <span className="text-xs font-semibold text-white px-2">{dataPoint.merchantPageViews}</span>
                              )}
                            </div>
                          )}
                          {/* Internal views (right/second) */}
                          {dataPoint.internalPageViews > 0 && (
                            <div
                              className="bg-purple-500 h-full flex items-center justify-center transition-all duration-300"
                              style={{ width: `${internalBarWidth}%` }}
                              title={`Internal: ${dataPoint.internalPageViews}`}
                            >
                              {internalBarWidth > 10 && (
                                <span className="text-xs font-semibold text-white px-2">{dataPoint.internalPageViews}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {totalBarWidth <= 15 && (
                        <span className="text-sm font-semibold text-gray-700 w-8">{dataPoint.pageViews}</span>
                      )}
                    </div>
                    <div className="w-32 text-sm text-gray-500 text-right">
                      <div>{dataPoint.uniqueSessions} sessions</div>
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block text-xs mt-1">
                        <span className="text-blue-600">M:{dataPoint.merchantPageViews}</span>
                        {' / '}
                        <span className="text-purple-600">I:{dataPoint.internalPageViews}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No time series data available</p>
          )}
        </div>

        {/* Stage Progression Timeline */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stage Progression Timeline</h2>
          {loadingProgression ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : progressionError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">Error loading stage progression</p>
              <p className="text-red-700 text-xs mt-1">{progressionError}</p>
            </div>
          ) : stageProgression.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stageProgression.map((stage, index) => {
                    const isExpanded = expandedStages.has(stage.stage)
                    const eventCount = stage.events?.length || 0
                    const hasHistory = eventCount > 1

                    return (
                      <React.Fragment key={index}>
                        {/* Main Row */}
                        <tr
                          className={`hover:bg-gray-50 ${hasHistory ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (hasHistory) {
                              setExpandedStages(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(stage.stage)) {
                                  newSet.delete(stage.stage)
                                } else {
                                  newSet.add(stage.stage)
                                }
                                return newSet
                              })
                            }
                          }}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {hasHistory && (
                                <svg
                                  className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                              <div className="text-sm font-medium text-gray-900">
                                {stage.stage}
                              </div>
                              {hasHistory && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ({eventCount} changes)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {stage.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {stage.latestTimestamp ? (
                                <>
                                  {new Date(stage.latestTimestamp).toLocaleDateString('en-US', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}{' '}
                                  {new Date(stage.latestTimestamp).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {stage.latestActor === 'internal_team' ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                Internal Team
                              </span>
                            ) : stage.latestActor === 'merchant' ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Merchant
                              </span>
                            ) : (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                Unknown
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Expanded History Rows */}
                        {isExpanded && stage.events && stage.events.length > 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-2 bg-gray-50">
                              <div className="pl-8">
                                <div className="text-xs font-semibold text-gray-700 mb-2">Change History</div>
                                <div className="space-y-2">
                                  {stage.events.map((event, eventIndex) => (
                                    <div key={eventIndex} className="flex items-center gap-4 text-sm py-1">
                                      <div className="text-gray-900 w-40">
                                        {new Date(event.timestamp).toLocaleDateString('en-US', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric'
                                        })}{' '}
                                        {new Date(event.timestamp).toLocaleTimeString('en-US', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </div>
                                      <div className="flex-shrink-0">
                                        {event.actor === 'internal_team' ? (
                                          <span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                            Internal Team
                                          </span>
                                        ) : event.actor === 'merchant' ? (
                                          <span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                            Merchant
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                            Unknown
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-gray-600 flex-1">
                                        {event.changeType}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No stage progression data available</p>
          )}
        </div>

        {/* Stage Breakdown */}
        {stageBreakdown.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Stage Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stageBreakdown.map((stage) => (
                    <tr key={stage.stage} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {stage.stage.replace(/-/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{stage.count}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                            <div
                              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${stage.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12 text-right">
                            {stage.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Activities */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Activities</h2>
          {analyticsData.recentActivity.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Page URL
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Type
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analyticsData.recentActivity.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(activity.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs font-mono text-gray-700 break-all">
                          {activity.page}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 capitalize">
                          {activity.action || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {activity.deviceType ? (
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                            activity.deviceType === 'mobile' ? 'bg-purple-100 text-purple-800' :
                            activity.deviceType === 'tablet' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {activity.deviceType === 'mobile' ? '📱 ' :
                             activity.deviceType === 'tablet' ? '📋 ' :
                             '💻 '}{activity.deviceType}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {activity.isInternalUser ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                            Internal Team
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Merchant
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No activity data available</p>
          )}
        </div>
      </div>
    </div>
  )
}

