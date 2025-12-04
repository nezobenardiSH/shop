'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import LanguageSelector from './LanguageSelector'
import { type Locale } from '@/i18n/config'

interface MerchantHeaderProps {
  onRefresh?: () => void
  loading?: boolean
  merchantId?: string
}

export default function MerchantHeader({
  onRefresh,
  loading = false,
  merchantId
}: MerchantHeaderProps) {
  const router = useRouter()
  const t = useTranslations('header')
  const locale = useLocale() as Locale
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const response = await fetch('/api/auth/merchant-logout', {
        method: 'POST'
      })

      if (response.ok) {
        // Redirect to merchant login page using Salesforce ID
        const loginPath = merchantId ? `/login/${merchantId}` : '/login'
        router.push(loginPath)
        router.refresh()
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="py-1.5 sm:py-3">
      {/* Mobile: Single row with 40/60 split */}
      <div className="flex md:hidden justify-between items-center">
        {/* Left side: Logo and Portal Name stacked - 40% */}
        <div className="w-[40%] flex flex-col items-start">
          <img
            src="/SH_logo.avif"
            alt="StoreHub"
            className="h-3.5 w-auto"
          />
          <span className="text-[10px] text-[#6b6a6a]">{t('title')}</span>
        </div>

        {/* Right side: Refresh, Language, Logout - 40% */}
        <div className="w-[40%] flex items-center justify-end gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="bg-white hover:bg-gray-50 text-[#0b0707] font-medium rounded-full p-1.5 border border-[#e5e7eb] transition-all duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          )}
          <LanguageSelector currentLocale={locale} />
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs text-[#ff630f] hover:text-[#fe5b25] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loggingOut ? t('loggingOut') : t('logout')}
          </button>
        </div>
      </div>

      {/* Desktop: Single row layout */}
      <div className="hidden md:flex justify-between items-center">
        {/* Left side - Logo and Portal Name */}
        <div className="flex items-center gap-4">
          <img
            src="/SH_logo.avif"
            alt="StoreHub"
            className="h-5 w-auto"
          />
          <span className="text-sm text-[#6b6a6a]">{t('title')}</span>
        </div>

        {/* Right side - Refresh, Language, Logout */}
        <div className="flex items-center gap-4">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="bg-white hover:bg-gray-50 text-[#0b0707] font-medium rounded-full p-2 border border-[#e5e7eb] transition-all duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          )}

          {/* Language Selector */}
          <LanguageSelector currentLocale={locale} />

          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm text-[#ff630f] hover:text-[#fe5b25] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loggingOut ? t('loggingOut') : t('logout')}
          </button>
        </div>
      </div>
    </div>
  )
}