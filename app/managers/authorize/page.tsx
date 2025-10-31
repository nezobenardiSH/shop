'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// Force dynamic rendering to prevent build-time prerendering
export const dynamic = 'force-dynamic'

function ManagerAuthorizeContent() {
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [authStatus, setAuthStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [userInfo, setUserInfo] = useState<any>(null)
  const searchParams = useSearchParams()
  
  // Check for auth callback
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    if (code && state) {
      handleAuthCallback(code, state)
    } else {
      checkAuthStatus()
    }
  }, [searchParams])
  
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/managers/authorization-status')
      const data = await response.json()
      
      if (data.isAuthorized) {
        setAuthStatus('success')
        setUserInfo(data.userInfo)
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
    }
  }
  
  const handleAuthCallback = async (code: string, state: string) => {
    try {
      const response = await fetch('/api/managers/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setAuthStatus('success')
        setUserInfo(data.userInfo)
      } else {
        setAuthStatus('error')
      }
    } catch (error) {
      console.error('Auth callback failed:', error)
      setAuthStatus('error')
    }
  }
  
  const startAuthorization = () => {
    setIsAuthorizing(true)
    // Redirect to Lark OAuth
    window.location.href = '/api/managers/auth'
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Onboarding Manager Authorization
          </h1>
          <p className="text-gray-600">
            Authorize with Lark to receive notifications about merchant installations
          </p>
        </div>
        
        {authStatus === 'idle' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Why authorize?</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Receive notifications when external vendors are assigned</li>
                <li>• Get updates on merchant installation status</li>
                <li>• Stay informed about your merchant onboarding progress</li>
              </ul>
            </div>
            
            <button
              onClick={startAuthorization}
              disabled={isAuthorizing}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAuthorizing ? 'Redirecting to Lark...' : 'Authorize with Lark'}
            </button>
          </div>
        )}
        
        {authStatus === 'success' && userInfo && (
          <div className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold text-green-900 mb-1">Authorization Successful!</h3>
              <p className="text-sm text-green-700">
                You're now set up to receive notifications
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-gray-900 mb-2">Your Information:</h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-600">Name:</span> <span className="font-medium">{userInfo.name}</span></p>
                <p><span className="text-gray-600">Email:</span> <span className="font-medium">{userInfo.email}</span></p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600">
              You can close this window. You'll receive Lark notifications for merchant installations assigned to external vendors.
            </p>
          </div>
        )}
        
        {authStatus === 'error' && (
          <div className="text-center space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <svg className="w-12 h-12 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold text-red-900 mb-1">Authorization Failed</h3>
              <p className="text-sm text-red-700">
                Something went wrong during authorization. Please try again.
              </p>
            </div>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ManagerAuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <ManagerAuthorizeContent />
    </Suspense>
  )
}