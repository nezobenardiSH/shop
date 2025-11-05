'use client'

import Link from 'next/link'

interface PageHeaderProps {
  merchantId: string
  merchantName: string
  lastModifiedDate?: string
  currentPage: 'progress' | 'details'
  isInternalUser?: boolean
}

export default function PageHeader({
  merchantId,
  merchantName,
  lastModifiedDate,
  currentPage,
  isInternalUser = false
}: PageHeaderProps) {
  // merchantName is now the actual name from Salesforce, no need to format
  
  return (
    <>

      {/* Page Title Section */}
      <div className="mb-6">
        {/* Mobile Layout: Title and timestamp stacked */}
        <div className="block sm:hidden">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[#0b0707]">
              {merchantName}
            </h1>
            {isInternalUser && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
                StoreHub Team
              </span>
            )}
          </div>
          {lastModifiedDate && (
            <p className="text-xs text-[#6b6a6a]">
              Last Modified: {new Date(lastModifiedDate).toLocaleString('en-GB', {
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
                StoreHub Team
              </span>
            )}
          </div>
          {lastModifiedDate && (
            <p className="text-sm text-[#6b6a6a]">
              Last Modified: {new Date(lastModifiedDate).toLocaleString('en-GB', {
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
      
      {/* Navigation Menu */}
      <div className="mb-6 border-b border-[#e5e7eb]">
        <nav className="flex space-x-8">
          <Link
            href={`/merchant/${merchantId}`}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              currentPage === 'progress'
                ? 'border-[#ff630f] text-[#ff630f]'
                : 'border-transparent text-[#6b6a6a] hover:text-[#0b0707] hover:border-[#e5e7eb]'
            }`}
          >
            Onboarding Progress
          </Link>
          <Link
            href={`/merchant/${merchantId}/details`}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              currentPage === 'details'
                ? 'border-[#ff630f] text-[#ff630f]'
                : 'border-transparent text-[#6b6a6a] hover:text-[#0b0707] hover:border-[#e5e7eb]'
            }`}
          >
            Merchant Details
          </Link>
        </nav>
      </div>
    </>
  )
}