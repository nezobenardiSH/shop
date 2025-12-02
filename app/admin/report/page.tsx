'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface MerchantReport {
  id: string
  name: string
  analyticsLink: string
  salesforceLink: string
  onboardingManagers: string
  onboardingStartDate: string
  expectedGoLiveDate: string
  trainingCompletedTimestamp: string
  onboardingServiceBought: string
  firstCallTimestamp: string
  trainingScheduledTimestamp: string
  trainingScheduledActor: string
  installationScheduledTimestamp: string
  installationScheduledActor: string
  productSetupTimestamp: string
  productSetupActor: string
  uniqueSessions: number
  avgPagesPerSession: number
  pageBreakdown: string
}

interface ReportData {
  success: boolean
  merchants: MerchantReport[]
  count: number
}

interface RemarksMap {
  [merchantId: string]: string
}

export default function ReportPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [remarks, setRemarks] = useState<RemarksMap>({})
  const [savingRemark, setSavingRemark] = useState<string | null>(null)

  useEffect(() => {
    fetchReport()
    fetchRemarks()
  }, [])

  const fetchReport = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/report')

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin')
          return
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to fetch report data')
      }

      const data = await response.json()
      setReportData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRemarks = async () => {
    try {
      const response = await fetch('/api/admin/remarks')
      if (response.ok) {
        const data = await response.json()
        setRemarks(data.remarks || {})
      }
    } catch (err) {
      console.error('Failed to fetch remarks:', err)
    }
  }

  const saveRemark = useCallback(async (merchantId: string, remark: string) => {
    setSavingRemark(merchantId)
    try {
      const response = await fetch('/api/admin/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, remark })
      })

      if (!response.ok) {
        throw new Error('Failed to save remark')
      }

      setRemarks(prev => ({ ...prev, [merchantId]: remark }))
    } catch (err) {
      console.error('Failed to save remark:', err)
      alert('Failed to save remark')
    } finally {
      setSavingRemark(null)
    }
  }, [])

  const handleRemarkChange = (merchantId: string, value: string) => {
    setRemarks(prev => ({ ...prev, [merchantId]: value }))
  }

  const handleRemarkBlur = (merchantId: string) => {
    const remark = remarks[merchantId] || ''
    saveRemark(merchantId, remark)
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
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
            onClick={fetchReport}
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
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Merchant Onboarding Report</h1>
              <p className="mt-1 text-sm text-gray-500">
                Test Account = false, Onboarding Portal Access = yes ({reportData?.count || 0} merchants)
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

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                    Merchant Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Links
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Onboarding Managers
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Onboarding Start Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expected Go-Live Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Training Completed TimeStamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Onboarding Service Bought
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Call Time Stamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Training Scheduled Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Training Scheduled Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Installation Scheduled timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Installation Scheduled Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Setup Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Setup Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unique Sessions by Merchant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg pages / sessions by Merchants
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Page breakdown
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                    Remark
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData?.merchants.map((merchant) => (
                  <tr key={merchant.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                      {merchant.name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <a
                          href={merchant.analyticsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                          title="View Analytics"
                        >
                          Analytics
                        </a>
                        <span className="text-gray-300">|</span>
                        <a
                          href={merchant.salesforceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-800 underline"
                          title="View in Salesforce"
                        >
                          Salesforce
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {merchant.onboardingManagers || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(merchant.onboardingStartDate)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(merchant.expectedGoLiveDate)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(merchant.trainingCompletedTimestamp)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {merchant.onboardingServiceBought || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(merchant.firstCallTimestamp)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(merchant.trainingScheduledTimestamp)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {merchant.trainingScheduledActor || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(merchant.installationScheduledTimestamp)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {merchant.installationScheduledActor || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(merchant.productSetupTimestamp)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {merchant.productSetupActor || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {merchant.uniqueSessions}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {merchant.avgPagesPerSession.toFixed(1)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 max-w-xs">
                      <div className="truncate" title={merchant.pageBreakdown}>
                        {merchant.pageBreakdown || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      <div className="relative">
                        <input
                          type="text"
                          value={remarks[merchant.id] || ''}
                          onChange={(e) => handleRemarkChange(merchant.id, e.target.value)}
                          onBlur={() => handleRemarkBlur(merchant.id)}
                          placeholder="Add remark..."
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                        />
                        {savingRemark === merchant.id && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                            Saving...
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {reportData?.merchants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No merchants found with the specified criteria</p>
          </div>
        )}
      </div>
    </div>
  )
}
