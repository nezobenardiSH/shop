'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function InstallersAuthorizePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [authStatus, setAuthStatus] = useState<{
    authorized: boolean
    email?: string
    error?: string
  } | null>(null)

  // Check auth status on mount and after redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const email = urlParams.get('email')
    const error = urlParams.get('error')
    const processing = urlParams.get('processing')
    const code = urlParams.get('code')

    if (success && email) {
      setAuthStatus({
        authorized: true,
        email: decodeURIComponent(email)
      })
    } else if (error) {
      setAuthStatus({
        authorized: false,
        error: decodeURIComponent(error)
      })
    } else if (processing && code) {
      // OAuth callback is processing - show loading state
      setIsLoading(true)
      // Clean up URL and refresh status after processing
      setTimeout(() => {
        window.history.replaceState({}, '', '/installers/authorize')
        checkAuthStatus()
        setIsLoading(false)
      }, 2000)
    } else {
      // Check current auth status
      checkAuthStatus()
    }
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/installers/authorization-status')
      const data = await response.json()
      
      if (data.authorized && data.userEmail) {
        setAuthStatus({
          authorized: true,
          email: data.userEmail
        })
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
    }
  }

  const handleAuthorize = async () => {
    setIsLoading(true)
    try {
      // Redirect to Lark OAuth with installer type
      const response = await fetch('/api/lark/auth/authorize?type=installer', {
        headers: {
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        setAuthStatus({
          authorized: false,
          error: 'Failed to generate authorization URL'
        })
      }
    } catch (error) {
      console.error('Authorization error:', error)
      setAuthStatus({
        authorized: false,
        error: 'Failed to initiate authorization'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke Lark authorization?')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/installers/revoke-authorization', {
        method: 'POST'
      })
      
      if (response.ok) {
        setAuthStatus(null)
        checkAuthStatus()
      } else {
        const error = await response.text()
        setAuthStatus({
          authorized: false,
          error: `Failed to revoke authorization: ${error}`
        })
      }
    } catch (error) {
      console.error('Revoke error:', error)
      setAuthStatus({
        authorized: false,
        error: 'Failed to revoke authorization'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Installer Lark Authorization</h1>
          <Link 
            href="/"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <div className="space-y-6">
          {/* Authorization Status */}
          {authStatus?.authorized && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-green-900">
                    Lark Calendar Connected
                  </h3>
                  <p className="text-sm text-green-700 mt-1">
                    Authorized as: {authStatus.email}
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    Your Lark calendar is connected and installation bookings will be automatically added to your calendar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Status */}
          {authStatus?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-900">
                    Authorization Error
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    {authStatus.error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Processing Status */}
          {isLoading && !authStatus?.authorized && !authStatus?.error && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Loader2 className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0 animate-spin" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900">
                    Processing Authorization...
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Connecting to Lark and exchanging authorization tokens. This may take a moment...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Not Authorized */}
          {!authStatus?.authorized && !authStatus?.error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-yellow-900">
                    Lark Calendar Not Connected
                  </h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Connect your Lark calendar to automatically receive installation bookings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              Why Connect Lark?
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Installation bookings automatically added to your calendar</li>
              <li>• Real-time availability checking</li>
              <li>• Automatic conflict detection</li>
              <li>• Instant notifications for new installations</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {authStatus?.authorized ? (
              <>
                <button
                  onClick={handleRevoke}
                  disabled={isLoading}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Revoke Authorization'
                  )}
                </button>
                <button
                  onClick={handleAuthorize}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Re-authorize'
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleAuthorize}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Connect Lark Calendar'
                )}
              </button>
            )}
          </div>

          {/* Privacy Note */}
          <p className="text-xs text-gray-500 text-center">
            We only access your calendar to manage installation bookings. 
            Your data is secure and never shared.
          </p>
        </div>
      </div>
    </div>
  )
}