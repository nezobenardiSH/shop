'use client'

import { useRouter } from 'next/navigation'

export default function UnauthorizedPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          
          <p className="text-gray-600 mb-6">
            You don't have permission to access this merchant portal.
          </p>
          
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center px-4 py-2 
                     border border-transparent rounded-lg text-white
                     bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2
                     focus:ring-offset-2 focus:ring-red-500
                     transition-colors duration-200"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}