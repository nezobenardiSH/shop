'use client'

import Link from 'next/link'

interface PageHeaderProps {
  merchantName: string
  lastModifiedDate?: string
  currentPage: 'progress' | 'details'
}

export default function PageHeader({ 
  merchantName, 
  lastModifiedDate, 
  currentPage
}: PageHeaderProps) {
  const formattedMerchantName = merchantName.replace(/-/g, ' ')
  
  return (
    <>

      {/* Page Title Section */}
      <div className="mb-6">
        {/* Mobile Layout: Title and timestamp stacked */}
        <div className="block sm:hidden">
          <h1 className="text-2xl font-bold text-[#0b0707] mb-1">
            {formattedMerchantName}
          </h1>
          {lastModifiedDate && (
            <p className="text-xs text-[#6b6a6a]">
              Last Modified: {new Date(lastModifiedDate).toLocaleString()}
            </p>
          )}
        </div>

        {/* Desktop Layout: Title and timestamp side by side */}
        <div className="hidden sm:flex sm:justify-between sm:items-center">
          <h1 className="text-3xl font-bold text-[#0b0707]">
            {formattedMerchantName}
          </h1>
          {lastModifiedDate && (
            <p className="text-sm text-[#6b6a6a]">
              Last Modified: {new Date(lastModifiedDate).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      
      {/* Navigation Menu */}
      <div className="mb-6 border-b border-[#e5e7eb]">
        <nav className="flex space-x-8">
          <Link
            href={`/merchant/${merchantName}`}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              currentPage === 'progress' 
                ? 'border-[#ff630f] text-[#ff630f]' 
                : 'border-transparent text-[#6b6a6a] hover:text-[#0b0707] hover:border-[#e5e7eb]'
            }`}
          >
            Onboarding Progress
          </Link>
          <Link
            href={`/merchant/${merchantName}/details`}
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