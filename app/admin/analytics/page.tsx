'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Helper function to extract stage from page field
const extractStage = (page: string): string | null => {
  if (!page || !page.includes('?stage=')) return null
  const match = page.match(/\?stage=([\w-]+)/)
  return match ? match[1] : null
}

interface SummaryStats {
  totalPageViews: number
  uniqueMerchants: number
  uniqueSessions: number
  avgPagesPerSession: number
  totalLogins: number
  successfulLogins: number
  failedLogins: number
}

interface TimeSeriesDataPoint {
  date: string
  pageViews: number
  uniqueSessions: number
  uniqueMerchants: number
  merchantPageViews: number
  internalPageViews: number
}

interface TopMerchant {
  merchantId: string
  merchantName: string
  totalViews: number
  lastVisit: string
  uniqueSessions: number
}

interface PageBreakdown {
  page: string
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

interface ActorMetrics {
  totalSubmissions?: number
  totalBookings?: number
  internalSubmissions?: number
  merchantSubmissions?: number
  internalBookings?: number
  merchantBookings?: number
  internalPercentage: number
  merchantPercentage: number
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
  topMerchants: TopMerchant[]
  pageBreakdown: PageBreakdown[]
  recentActivity: RecentActivity[]
  menuSubmissionMetrics?: ActorMetrics
  trainingSchedulingMetrics?: ActorMetrics
  installationSchedulingMetrics?: ActorMetrics
}

interface Merchant {
  id: string
  name: string
  hasPortalAccess: boolean
}

interface MerchantStage {
  id: string
  name: string
  onboardingStage: string | null
  welcomeStatus: string
  preparationStatus: string
  hardwareDeliveryStatus: string | null
  installationStatus: string
  trainingStatus: string | null
  goLiveStatus: string
  isLive: boolean
  productSetupStatus: string | null
  hardwareInstallationStatus: string | null
  actualInstallationDate: string | null
  trainingDate: string | null
  plannedGoLiveDate: string | null
  posQrDeliveryCount: number
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'merchant' | 'internal_team'>('all')
  const [pageFilter, setPageFilter] = useState<string>('all')
  const [merchantFilter, setMerchantFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [portalAccessFilter, setPortalAccessFilter] = useState<'all' | 'yes' | 'no'>('all')

  // Merchant list
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loadingMerchants, setLoadingMerchants] = useState(true)

  // Merchant stages
  const [merchantStages, setMerchantStages] = useState<MerchantStage[]>([])
  const [loadingStages, setLoadingStages] = useState(false)

  useEffect(() => {
    fetchMerchants()
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange, startDate, endDate, userTypeFilter, pageFilter, merchantFilter, stageFilter, groupBy])

  // Fetch merchant stages when analytics data changes
  useEffect(() => {
    if (analyticsData?.topMerchants && analyticsData.topMerchants.length > 0) {
      fetchMerchantStages(analyticsData.topMerchants.map(m => m.merchantId))
    }
  }, [analyticsData?.topMerchants])

  const fetchMerchants = async () => {
    setLoadingMerchants(true)
    try {
      const response = await fetch('/api/admin/merchants')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin')
          return
        }
        throw new Error('Failed to fetch merchants')
      }
      const data = await response.json()
      if (data.success) {
        setMerchants(data.merchants || [])
      }
    } catch (err) {
      console.error('Error fetching merchants:', err)
    } finally {
      setLoadingMerchants(false)
    }
  }

  const fetchMerchantStages = async (merchantIds: string[]) => {
    if (merchantIds.length === 0) {
      setMerchantStages([])
      return
    }

    setLoadingStages(true)
    try {
      const response = await fetch(`/api/admin/merchant-stages?merchantIds=${merchantIds.join(',')}`)
      if (!response.ok) {
        throw new Error('Failed to fetch merchant stages')
      }
      const data = await response.json()
      if (data.success) {
        setMerchantStages(data.merchants || [])
      }
    } catch (err) {
      console.error('Error fetching merchant stages:', err)
    } finally {
      setLoadingStages(false)
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

      // User type filter
      if (userTypeFilter !== 'all') {
        params.append('userType', userTypeFilter)
      }

      // Page filter
      if (pageFilter !== 'all') {
        params.append('page', pageFilter)
      }

      // Merchant filter
      if (merchantFilter !== 'all') {
        params.append('merchantId', merchantFilter)
      }

      // Stage filter - filter by page with stage parameter
      if (stageFilter !== 'all') {
        params.append('page', `progress?stage=${stageFilter}`)
      }

      // Group by
      params.append('groupBy', groupBy)

      const response = await fetch(`/api/admin/analytics?${params.toString()}`)

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin')
          return
        }
        const errorData = await response.json().catch(() => ({}))
        console.error('[Analytics] API Error:', errorData)
        throw new Error(errorData.details || errorData.error || 'Failed to fetch analytics data')
      }

      const data = await response.json()
      console.log('[Analytics] Data received:', {
        summary: data.summary,
        timeSeriesCount: data.timeSeriesData?.length,
        topMerchantsCount: data.topMerchants?.length,
        pageBreakdownCount: data.pageBreakdown?.length,
        recentActivityCount: data.recentActivity?.length
      })
      setAnalyticsData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading && !analyticsData) {
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
          <p className="text-red-600 font-semibold">Error: {error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Merchant onboarding portal usage statistics
              </p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              ← Back to Admin
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* User Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Type
              </label>
              <select
                value={userTypeFilter}
                onChange={(e) => setUserTypeFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Users</option>
                <option value="merchant">Merchants Only</option>
                <option value="internal_team">Internal Team Only</option>
              </select>
            </div>

            {/* Page Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Page
              </label>
              <select
                value={pageFilter}
                onChange={(e) => setPageFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Pages</option>
                <option value="login">Login</option>
                <option value="progress">Progress</option>
                <option value="details">Details</option>
              </select>
            </div>

            {/* Merchant Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Merchant
              </label>
              <select
                value={merchantFilter}
                onChange={(e) => setMerchantFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                disabled={loadingMerchants}
              >
                <option value="all">All Merchants</option>
                {merchants.map(merchant => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stage Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stage
              </label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Stages</option>
                <option value="welcome">Welcome</option>
                <option value="preparation">Preparation</option>
                <option value="hardware">Hardware</option>
                <option value="installation">Installation</option>
                <option value="training">Training</option>
                <option value="ready-go-live">Ready to Go Live</option>
                <option value="live">Live</option>
              </select>
            </div>

            {/* Group By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>

            {/* Portal Access */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Portal Access
              </label>
              <select
                value={portalAccessFilter}
                onChange={(e) => setPortalAccessFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          )}
        </div>

        {analyticsData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Total Page Views */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Page Views</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {analyticsData.summary.totalPageViews.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Unique Merchants */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Unique Merchants</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {analyticsData.summary.uniqueMerchants.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Unique Sessions */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Unique Sessions</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {analyticsData.summary.uniqueSessions.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Avg Pages/Session */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Pages/Session</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {analyticsData.summary.avgPagesPerSession.toFixed(1)}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-full">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Login Stats */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Login Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Logins</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {analyticsData.summary.totalLogins.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {analyticsData.summary.successfulLogins.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {analyticsData.summary.failedLogins.toLocaleString()}
                  </p>
                </div>
              </div>
              {analyticsData.summary.totalLogins > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Success Rate</span>
                    <span className="font-semibold">
                      {((analyticsData.summary.successfulLogins / analyticsData.summary.totalLogins) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(analyticsData.summary.successfulLogins / analyticsData.summary.totalLogins) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Time Series Chart */}
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
                <div className="overflow-x-auto">
                  <div className="min-w-full">
                    {/* Chart with axes */}
                    <div className="flex gap-4">
                      {/* Y-axis */}
                      <div className="flex flex-col justify-between h-64 py-2">
                        {(() => {
                          const maxViews = Math.max(...analyticsData.timeSeriesData.map(p => p.pageViews))
                          const yAxisSteps = 5
                          const stepValue = Math.ceil(maxViews / yAxisSteps)
                          const yAxisValues = Array.from({ length: yAxisSteps + 1 }, (_, i) => stepValue * (yAxisSteps - i))

                          return yAxisValues.map((value, i) => (
                            <div key={i} className="text-xs text-gray-500 text-right pr-2">
                              {value}
                            </div>
                          ))
                        })()}
                      </div>

                      {/* Chart area */}
                      <div className="flex-1">
                        {/* Stacked Bar chart */}
                        <div className="relative h-64 border-l border-b border-gray-300 pl-2 pb-2">
                          <div className="absolute inset-0 flex items-end justify-between gap-1 pl-2 pb-2">
                            {analyticsData.timeSeriesData.map((point, index) => {
                              const maxViews = Math.max(...analyticsData.timeSeriesData.map(p => p.pageViews))
                              const totalHeightPercent = maxViews > 0 ? (point.pageViews / maxViews) * 100 : 0
                              const merchantHeightPercent = maxViews > 0 ? (point.merchantPageViews / maxViews) * 100 : 0
                              const internalHeightPercent = maxViews > 0 ? (point.internalPageViews / maxViews) * 100 : 0

                              return (
                                <div key={index} className="flex-1 group relative flex flex-col justify-end" style={{ height: '100%' }}>
                                  {/* Stacked bars */}
                                  <div className="flex flex-col justify-end w-full" style={{ height: `${totalHeightPercent}%` }}>
                                    {/* Internal Team (top) */}
                                    {point.internalPageViews > 0 && (
                                      <div
                                        className="bg-purple-500 hover:bg-purple-600 transition-all cursor-pointer w-full"
                                        style={{ height: `${(internalHeightPercent / totalHeightPercent) * 100}%` }}
                                        title={`Internal: ${point.internalPageViews}`}
                                      />
                                    )}
                                    {/* Merchants (bottom) */}
                                    {point.merchantPageViews > 0 && (
                                      <div
                                        className="bg-blue-500 hover:bg-blue-600 transition-all cursor-pointer rounded-t w-full"
                                        style={{ height: `${(merchantHeightPercent / totalHeightPercent) * 100}%` }}
                                        title={`Merchants: ${point.merchantPageViews}`}
                                      />
                                    )}
                                  </div>
                                  {/* Tooltip */}
                                  <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10">
                                    <div className="font-semibold mb-1">{formatDate(point.date)}</div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-blue-500 rounded"></div>
                                      <span>Merchants: {point.merchantPageViews}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-purple-500 rounded"></div>
                                      <span>Internal: {point.internalPageViews}</span>
                                    </div>
                                    <div className="border-t border-gray-700 mt-1 pt-1">
                                      Total: {point.pageViews}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* X-axis labels */}
                        <div className="flex justify-between mt-2 pl-2">
                          {analyticsData.timeSeriesData.map((point, index) => {
                            // Show labels based on data length
                            const showLabel = analyticsData.timeSeriesData.length <= 7
                              || index === 0
                              || index === analyticsData.timeSeriesData.length - 1
                              || index % Math.ceil(analyticsData.timeSeriesData.length / 7) === 0

                            return (
                              <div key={index} className="flex-1 text-center">
                                {showLabel && (
                                  <div className="text-xs text-gray-500">
                                    {new Date(point.date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No data available for the selected period</p>
              )}
            </div>

            {/* Stage Breakdown */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Stage Breakdown</h2>
              {analyticsData.recentActivity.length > 0 ? (
                (() => {
                  // Calculate stage breakdown from recent activity
                  const stageBreakdown: { [key: string]: { count: number, merchants: Set<string> } } = {
                    'welcome': { count: 0, merchants: new Set() },
                    'preparation': { count: 0, merchants: new Set() },
                    'hardware': { count: 0, merchants: new Set() },
                    'installation': { count: 0, merchants: new Set() },
                    'training': { count: 0, merchants: new Set() },
                    'ready-go-live': { count: 0, merchants: new Set() },
                    'live': { count: 0, merchants: new Set() }
                  }

                  analyticsData.recentActivity.forEach(activity => {
                    const stage = extractStage(activity.page)
                    if (stage && stageBreakdown[stage]) {
                      stageBreakdown[stage].count++
                      if (activity.merchantId) {
                        stageBreakdown[stage].merchants.add(activity.merchantId)
                      }
                    }
                  })

                  const stageLabels: { [key: string]: string } = {
                    'welcome': 'Welcome',
                    'preparation': 'Preparation',
                    'hardware': 'Hardware',
                    'installation': 'Installation',
                    'training': 'Training',
                    'ready-go-live': 'Ready to Go Live',
                    'live': 'Live'
                  }

                  const stages = Object.entries(stageBreakdown)
                    .filter(([_, data]) => data.count > 0)
                    .sort((a, b) => b[1].count - a[1].count)

                  return stages.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Stage
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Views
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Unique Merchants
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Percentage
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {stages.map(([stage, data]) => {
                            const totalViews = Object.values(stageBreakdown).reduce((sum, s) => sum + s.count, 0)
                            const percentage = totalViews > 0 ? ((data.count / totalViews) * 100).toFixed(1) : '0'

                            return (
                              <tr key={stage} className="hover:bg-gray-50">
                                <td className="px-4 py-4">
                                  <div className="text-sm font-medium text-gray-900">{stageLabels[stage]}</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm font-semibold text-gray-900">{data.count}</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-500">{data.merchants.size}</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                      <div
                                        className="bg-orange-500 h-2 rounded-full"
                                        style={{ width: `${percentage}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm text-gray-600">{percentage}%</span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No stage data available</p>
                  )
                })()
              ) : (
                <p className="text-gray-500 text-center py-8">No stage data available</p>
              )}
            </div>

            {/* Two Column Layout for Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Top Merchants */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Top Merchants</h2>
                  <a
                    href="#all-merchants"
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    See all →
                  </a>
                </div>
                {analyticsData.topMerchants.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Merchant
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Views
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sessions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {analyticsData.topMerchants.map((merchant, index) => (
                          <tr
                            key={merchant.merchantId}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => router.push(`/admin/analytics/${merchant.merchantId}`)}
                          >
                            <td className="px-3 py-4">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mr-2">
                                  <span className="text-xs font-semibold text-orange-600">{index + 1}</span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate max-w-[150px]">
                                    {merchant.merchantName}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate max-w-[150px]">
                                    {merchant.merchantId}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-900">{merchant.totalViews}</div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{merchant.uniqueSessions}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No merchant data available</p>
                )}
              </div>

              {/* Merchant Stages */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Merchant Onboarding Stages</h2>
                {loadingStages ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </div>
                ) : merchantStages.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Merchant
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Stage
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {merchantStages.map((merchant) => {
                          // Determine overall status badge
                          let statusBadge = { text: 'In Progress', color: 'bg-blue-100 text-blue-800' }
                          if (merchant.isLive) {
                            statusBadge = { text: 'Live', color: 'bg-green-100 text-green-800' }
                          } else if (merchant.installationStatus === 'completed') {
                            statusBadge = { text: 'Post-Installation', color: 'bg-purple-100 text-purple-800' }
                          } else if (merchant.welcomeStatus === 'pending') {
                            statusBadge = { text: 'New', color: 'bg-gray-100 text-gray-800' }
                          }

                          return (
                            <tr key={merchant.id} className="hover:bg-gray-50">
                              <td className="px-3 py-4">
                                <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                                  {merchant.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate max-w-[150px]">
                                  {merchant.id}
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                <div className="text-xs text-gray-600">
                                  {merchant.onboardingStage || 'Not Set'}
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadge.color}`}>
                                  {statusBadge.text}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No stage data available</p>
                )}
              </div>
            </div>

            {/* Merchant Stages Detail - Full Width */}
            {merchantStages.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Detailed Onboarding Status</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Merchant
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Welcome
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Preparation
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Hardware
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Installation
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Training
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Go Live
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {merchantStages.map((merchant) => (
                        <tr key={merchant.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {merchant.name}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`text-xs ${merchant.welcomeStatus === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                              {merchant.welcomeStatus === 'completed' ? '✓ Done' : '○ Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-600">{merchant.preparationStatus}</div>
                            <div className="text-xs text-gray-400">{merchant.productSetupStatus || '-'}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-600">{merchant.hardwareDeliveryStatus || 'Not Started'}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-600">{merchant.hardwareInstallationStatus || 'Not Started'}</div>
                            {merchant.actualInstallationDate && (
                              <div className="text-xs text-gray-400">
                                {new Date(merchant.actualInstallationDate).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-600">{merchant.trainingStatus || 'Not Started'}</div>
                            {merchant.trainingDate && (
                              <div className="text-xs text-gray-400">
                                {new Date(merchant.trainingDate).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {merchant.isLive ? (
                              <div>
                                <span className="text-xs text-green-600 font-semibold">✓ Live</span>
                                <div className="text-xs text-gray-400">{merchant.posQrDeliveryCount} txns</div>
                              </div>
                            ) : (
                              <div>
                                <span className="text-xs text-gray-400">Pending</span>
                                {merchant.plannedGoLiveDate && (
                                  <div className="text-xs text-gray-400">
                                    {new Date(merchant.plannedGoLiveDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Page Breakdown - Move to single column below */}
            <div className="grid grid-cols-1 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Page Breakdown</h2>
                {analyticsData.pageBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {analyticsData.pageBreakdown.map((page) => (
                      <div key={page.page}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center flex-1 min-w-0 mr-4">
                            <span className="text-sm font-mono text-gray-700 truncate" title={page.page}>
                              {page.page}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                              {page.count.toLocaleString()} views
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {page.percentage}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full transition-all"
                            style={{ width: `${page.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No page data available</p>
                )}
              </div>
            </div>

            {/* Feature Engagement Metrics - Menu Submissions, Training, Installation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Menu Submissions */}
              {analyticsData.menuSubmissionMetrics && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Menu Submissions</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Total Submissions</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {analyticsData.menuSubmissionMetrics.totalSubmissions || 0}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">By Actor</p>

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">Internal Team</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {analyticsData.menuSubmissionMetrics.internalSubmissions || 0}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-500 h-2 rounded-full"
                              style={{ width: `${analyticsData.menuSubmissionMetrics.internalPercentage}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {analyticsData.menuSubmissionMetrics.internalPercentage}%
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">Merchant</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {analyticsData.menuSubmissionMetrics.merchantSubmissions || 0}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${analyticsData.menuSubmissionMetrics.merchantPercentage}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {analyticsData.menuSubmissionMetrics.merchantPercentage}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Training Scheduling */}
              {analyticsData.trainingSchedulingMetrics && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Scheduling</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Total Bookings</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {analyticsData.trainingSchedulingMetrics.totalBookings || 0}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">By Actor</p>

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">Internal Team</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {analyticsData.trainingSchedulingMetrics.internalBookings || 0}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-500 h-2 rounded-full"
                              style={{ width: `${analyticsData.trainingSchedulingMetrics.internalPercentage}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {analyticsData.trainingSchedulingMetrics.internalPercentage}%
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">Merchant</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {analyticsData.trainingSchedulingMetrics.merchantBookings || 0}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${analyticsData.trainingSchedulingMetrics.merchantPercentage}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {analyticsData.trainingSchedulingMetrics.merchantPercentage}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Installation Scheduling */}
              {analyticsData.installationSchedulingMetrics && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Installation Scheduling</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Total Bookings</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {analyticsData.installationSchedulingMetrics.totalBookings || 0}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">By Actor</p>

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">Internal Team</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {analyticsData.installationSchedulingMetrics.internalBookings || 0}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-500 h-2 rounded-full"
                              style={{ width: `${analyticsData.installationSchedulingMetrics.internalPercentage}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {analyticsData.installationSchedulingMetrics.internalPercentage}%
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">Merchant</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {analyticsData.installationSchedulingMetrics.merchantBookings || 0}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${analyticsData.installationSchedulingMetrics.merchantPercentage}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {analyticsData.installationSchedulingMetrics.merchantPercentage}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Merchant Activity Timeline - Only show when a specific merchant is selected */}
            {merchantFilter !== 'all' && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Activity Timeline for {merchants.find(m => m.id === merchantFilter)?.name || 'Selected Merchant'}
                </h2>
                {analyticsData.recentActivity.length > 0 ? (
                  <div className="space-y-6">
                    {(() => {
                      // Group activities by date
                      const groupedActivities = analyticsData.recentActivity.reduce((acc, activity) => {
                        const date = new Date(activity.timestamp)
                        const dateKey = groupBy === 'day'
                          ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : groupBy === 'week'
                          ? `Week of ${new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

                        if (!acc[dateKey]) {
                          acc[dateKey] = []
                        }
                        acc[dateKey].push(activity)
                        return acc
                      }, {} as Record<string, typeof analyticsData.recentActivity>)

                      return Object.entries(groupedActivities)
                        .sort(([dateA], [dateB]) => {
                          // Sort by date descending (most recent first)
                          const timeA = groupedActivities[dateA][0].timestamp
                          const timeB = groupedActivities[dateB][0].timestamp
                          return new Date(timeB).getTime() - new Date(timeA).getTime()
                        })
                        .map(([dateKey, activities]) => (
                          <div key={dateKey} className="border-l-4 border-orange-500 pl-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-md font-semibold text-gray-900">{dateKey}</h3>
                              <span className="text-sm text-gray-500">{activities.length} activities</span>
                            </div>
                            <div className="space-y-2">
                              {activities.map((activity) => (
                                <div key={activity.id} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-gray-500">
                                          {new Date(activity.timestamp).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                        <span className="text-xs font-mono text-blue-800 break-all">
                                          {activity.page}
                                        </span>
                                        {activity.action && (
                                          <span className="text-xs text-gray-600 capitalize">
                                            • {activity.action}
                                          </span>
                                        )}
                                      </div>
                                      {activity.isInternalUser && (
                                        <div className="text-xs text-orange-600 font-medium">
                                          Internal Team Access
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                    })()}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No activity data available for this merchant</p>
                )}
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              {analyticsData.recentActivity.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Merchant
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
                            <div className="text-sm text-gray-900">{formatDateTime(activity.timestamp)}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900 truncate max-w-[200px]">
                              {activity.merchantName || '-'}
                            </div>
                            {activity.merchantId && (
                              <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                {activity.merchantId}
                              </div>
                            )}
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
                <p className="text-gray-500 text-center py-8">No recent activity</p>
              )}
            </div>

            {/* All Merchants List */}
            <div id="all-merchants" className="bg-white rounded-lg shadow p-6">
              {(() => {
                // Filter merchants based on portal access
                const filteredMerchants = merchants.filter(m => {
                  if (portalAccessFilter === 'yes') return m.hasPortalAccess
                  if (portalAccessFilter === 'no') return !m.hasPortalAccess
                  return true
                })

                // Separate pilot merchants (those with portal access)
                const pilotMerchants = filteredMerchants.filter(m => m.hasPortalAccess)
                const regularMerchants = filteredMerchants.filter(m => !m.hasPortalAccess)

                return (
                  <>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      All Merchants ({filteredMerchants.length})
                    </h2>

                    {loadingMerchants ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                      </div>
                    ) : filteredMerchants.length > 0 ? (
                      <div className="space-y-6">
                        {/* Pilot Merchants Section */}
                        {pilotMerchants.length > 0 && portalAccessFilter !== 'no' && (
                          <div>
                            <h3 className="text-md font-semibold text-orange-600 mb-3 flex items-center gap-2">
                              <span className="px-3 py-1 bg-orange-100 rounded-full text-sm">
                                Pilot Merchants ({pilotMerchants.length})
                              </span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {pilotMerchants
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((merchant) => (
                                  <button
                                    key={merchant.id}
                                    onClick={() => router.push(`/admin/analytics/${merchant.id}`)}
                                    className="flex items-center justify-between p-4 border-2 border-orange-300 bg-orange-50 rounded-lg hover:border-orange-500 hover:bg-orange-100 transition-all text-left group"
                                  >
                                    <div className="flex-1 min-w-0 mr-3">
                                      <div className="text-sm font-medium text-gray-900 group-hover:text-orange-700 truncate">
                                        {merchant.name}
                                      </div>
                                      <div className="text-xs text-gray-500 truncate mt-1">
                                        {merchant.id}
                                      </div>
                                      <div className="text-xs text-orange-600 font-semibold mt-1">
                                        Pilot Access
                                      </div>
                                    </div>
                                    <svg
                                      className="w-5 h-5 text-orange-500 group-hover:text-orange-600 flex-shrink-0"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                      />
                                    </svg>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Regular Merchants Section */}
                        {regularMerchants.length > 0 && portalAccessFilter !== 'yes' && (
                          <div>
                            {pilotMerchants.length > 0 && portalAccessFilter === 'all' && (
                              <h3 className="text-md font-semibold text-gray-700 mb-3">
                                Other Merchants ({regularMerchants.length})
                              </h3>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {regularMerchants
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((merchant) => (
                                  <button
                                    key={merchant.id}
                                    onClick={() => router.push(`/admin/analytics/${merchant.id}`)}
                                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                                  >
                                    <div className="flex-1 min-w-0 mr-3">
                                      <div className="text-sm font-medium text-gray-900 group-hover:text-orange-700 truncate">
                                        {merchant.name}
                                      </div>
                                      <div className="text-xs text-gray-500 truncate mt-1">
                                        {merchant.id}
                                      </div>
                                    </div>
                                    <svg
                                      className="w-5 h-5 text-gray-400 group-hover:text-orange-500 flex-shrink-0"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                      />
                                    </svg>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No merchants found</p>
                    )}
                  </>
                )
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

