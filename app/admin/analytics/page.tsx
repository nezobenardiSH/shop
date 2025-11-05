'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  timestamp: string
  isInternalUser: boolean
  userType: string | null
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
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange, startDate, endDate, userTypeFilter, pageFilter, groupBy])

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Page Views Over Time</h2>
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
                        {/* Bar chart */}
                        <div className="relative h-64 border-l border-b border-gray-300 pl-2 pb-2">
                          <div className="absolute inset-0 flex items-end justify-between gap-1 pl-2 pb-2">
                            {analyticsData.timeSeriesData.map((point, index) => {
                              const maxViews = Math.max(...analyticsData.timeSeriesData.map(p => p.pageViews))
                              const heightPercent = maxViews > 0 ? (point.pageViews / maxViews) * 100 : 0

                              return (
                                <div key={index} className="flex-1 group relative" style={{ height: `${heightPercent}%` }}>
                                  <div
                                    className="bg-orange-500 hover:bg-orange-600 transition-all cursor-pointer rounded-t w-full h-full"
                                    title={`${formatDate(point.date)}: ${point.pageViews} views`}
                                  >
                                    <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                      <div>{formatDate(point.date)}: {point.pageViews} views</div>
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

            {/* Two Column Layout for Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Top Merchants */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Merchants</h2>
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
                          <tr key={merchant.merchantId} className="hover:bg-gray-50">
                            <td className="px-3 py-4">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mr-2">
                                  <span className="text-xs font-semibold text-orange-600">{index + 1}</span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
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

              {/* Page Breakdown */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Page Breakdown</h2>
                {analyticsData.pageBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {analyticsData.pageBreakdown.map((page) => (
                      <div key={page.page}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-900 capitalize">
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

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
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
                          Page
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
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
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                              {activity.page}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500 capitalize">
                              {activity.action || '-'}
                            </span>
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
          </>
        )}
      </div>
    </div>
  )
}

