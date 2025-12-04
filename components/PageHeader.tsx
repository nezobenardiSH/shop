'use client'

import Link from 'next/link'
import { useTranslations, useFormatter } from 'next-intl'

interface PageHeaderProps {
  merchantId: string
  merchantName: string
  lastModifiedDate?: string
  currentPage: 'overview' | 'progress' | 'details'
  isInternalUser?: boolean
  currentOnboardingStage?: string // The merchant's current onboarding stage
  plannedGoLiveDate?: string
  posQrDeliveryTnxCount?: number
}

export default function PageHeader({
  merchantId,
  merchantName,
  lastModifiedDate,
  currentPage,
  isInternalUser = false,
  currentOnboardingStage = 'welcome',
  plannedGoLiveDate,
  posQrDeliveryTnxCount
}: PageHeaderProps) {
  const tNav = useTranslations('navigation')
  const tGoLive = useTranslations('goLive')
  const tCommon = useTranslations('common')
  const format = useFormatter()

  // Calculate days until go-live and status
  const getGoLiveInfo = () => {
    if (!plannedGoLiveDate) return { diffDays: 0, isLive: false, status: tGoLive('notSet') }

    const today = new Date()
    const goLive = new Date(plannedGoLiveDate)
    const diffTime = goLive.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const isLive = (posQrDeliveryTnxCount ?? 0) > 30

    let status: string | number = diffDays
    if (diffDays <= 0) {
      status = isLive ? tGoLive('live') : tGoLive('overdue')
    }

    return { diffDays, isLive, status }
  }

  const goLiveInfo = getGoLiveInfo()

  return (
    <>

      {/* Page Title Section */}
      <div className="mb-6">
        {/* Mobile Layout: Title and timestamp stacked */}
        <div className="block sm:hidden">
          <div className="flex items-center gap-2 mb-1 min-w-0">
            <h1 className="text-2xl font-bold text-[#0b0707] truncate flex-1 min-w-0">
              {merchantName}
            </h1>
            {isInternalUser && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
                {tCommon('storeHubTeam')}
              </span>
            )}
          </div>
          {lastModifiedDate && (
            <p className="text-xs text-[#6b6a6a]">
              {tCommon('lastModified')}: {format.dateTime(new Date(lastModifiedDate), {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </p>
          )}
        </div>

        {/* Desktop Layout: Title and timestamp side by side */}
        <div className="hidden sm:flex sm:justify-between sm:items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[#0b0707]">
              {merchantName}
            </h1>
            {isInternalUser && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 border border-orange-300">
                {tCommon('storeHubTeam')}
              </span>
            )}
          </div>
          {lastModifiedDate && (
            <p className="text-sm text-[#6b6a6a]">
              {tCommon('lastModified')}: {format.dateTime(new Date(lastModifiedDate), {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
            </p>
          )}
        </div>
      </div>

      {/* Expected Go Live Date - Before tabs */}
      {plannedGoLiveDate && (
        <div className="mb-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-lg py-1.5 px-3 sm:p-4">
          {/* Mobile Layout: Title-Value pairs */}
          <div className="block sm:hidden space-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-orange-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                  <span>{tGoLive('expectedDate')}</span>
                  <div className="relative group">
                    <svg
                      className="w-3.5 h-3.5 text-orange-400 cursor-help"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {/* Tooltip - positioned to right on mobile to avoid cutoff */}
                    <div className="absolute right-0 sm:left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded py-2 px-3 z-10 normal-case">
                      {tGoLive('tooltip')}
                      <div className="absolute top-full right-4 sm:left-4 sm:right-auto -mt-1 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-sm font-bold text-gray-900">
                {format.dateTime(new Date(plannedGoLiveDate), {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">{tGoLive('daysUntil')}</div>
              <div className={`text-lg font-bold ${
                goLiveInfo.diffDays <= 0 && goLiveInfo.isLive ? 'text-green-600' : 'text-orange-600'
              }`}>
                {goLiveInfo.status}
              </div>
            </div>
          </div>

          {/* Desktop Layout: Original horizontal layout */}
          <div className="hidden sm:flex sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="text-orange-600 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                  <span>{tGoLive('expectedDate')}</span>
                  <div className="relative group">
                    <svg
                      className="w-3.5 h-3.5 text-orange-400 cursor-help"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {/* Tooltip */}
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded py-2 px-3 z-10 normal-case">
                      {tGoLive('tooltip')}
                      <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 truncate">
                  {format.dateTime(new Date(plannedGoLiveDate), {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm text-gray-600">{tGoLive('daysUntil')}</div>
              <div className={`text-3xl font-bold ${
                goLiveInfo.diffDays <= 0 && goLiveInfo.isLive ? 'text-green-600' : 'text-orange-600'
              }`}>
                {goLiveInfo.status}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <div className="mb-6 border-b border-[#e5e7eb]">
        <nav className="flex space-x-8">
          <Link
            href={`/merchant/${merchantId}/overview`}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              currentPage === 'overview'
                ? 'border-[#ff630f] text-[#ff630f]'
                : 'border-transparent text-[#6b6a6a] hover:text-[#0b0707] hover:border-[#e5e7eb]'
            }`}
          >
            {tNav('overview')}
          </Link>
          <Link
            href={`/merchant/${merchantId}?stage=${currentOnboardingStage}`}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              currentPage === 'progress'
                ? 'border-[#ff630f] text-[#ff630f]'
                : 'border-transparent text-[#6b6a6a] hover:text-[#0b0707] hover:border-[#e5e7eb]'
            }`}
          >
            {tNav('progress')}
          </Link>
          <Link
            href={`/merchant/${merchantId}/details`}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              currentPage === 'details'
                ? 'border-[#ff630f] text-[#ff630f]'
                : 'border-transparent text-[#6b6a6a] hover:text-[#0b0707] hover:border-[#e5e7eb]'
            }`}
          >
            {tNav('details')}
          </Link>
        </nav>
      </div>
    </>
  )
}