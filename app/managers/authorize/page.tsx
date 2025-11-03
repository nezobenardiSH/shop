'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Bell, RefreshCw, LogIn } from 'lucide-react'

interface AuthorizedManager {
  email: string
  name: string
  authorized: boolean
  expiresAt?: Date
}

function ManagerAuthorizeContent() {
  const searchParams = useSearchParams()
  const [managers, setManagers] = useState<AuthorizedManager[]>([])
  const [loading, setLoading] = useState(true)
  const [authorizing, setAuthorizing] = useState(false)

  // Check for OAuth callback
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const [authStatus, setAuthStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [authError, setAuthError] = useState<string>('')

  useEffect(() => {
    if (code && state) {
      setAuthStatus('processing')
      handleAuthCallback(code, state)
    }
    fetchManagerStatus()
  }, [code, state])

  const handleAuthCallback = async (code: string, state: string) => {
    try {
      const response = await fetch('/api/managers/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      })
      
      if (response.ok) {
        setAuthStatus('success')
        setTimeout(() => {
          window.history.replaceState({}, '', '/managers/authorize')
          setAuthStatus('idle')
          fetchManagerStatus()
        }, 3000)
      } else {
        const data = await response.json()
        setAuthError(data.error || 'Authorization failed')
        setAuthStatus('error')
        setTimeout(() => {
          window.history.replaceState({}, '', '/managers/authorize')
          setAuthStatus('idle')
        }, 5000)
      }
    } catch (error) {
      console.error('Auth callback failed:', error)
      setAuthError('Connection failed')
      setAuthStatus('error')
    }
  }

  const fetchManagerStatus = async () => {
    try {
      const response = await fetch('/api/managers/authorization-status')
      const data = await response.json()
      setManagers(data.managers || [])
    } catch (error) {
      console.error('Failed to fetch manager status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAuthorize = () => {
    setAuthorizing(true)
    window.location.href = '/api/managers/auth'
  }

  const handleRevoke = async (email: string) => {
    if (!confirm(`Revoke authorization for ${email}?`)) return

    try {
      const response = await fetch('/api/managers/revoke-authorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (response.ok) {
        fetchManagerStatus()
      }
    } catch (error) {
      console.error('Failed to revoke authorization:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="h-8 w-8 text-orange-500" />
              Onboarding Manager Notifications
            </h1>
            <p className="mt-2 text-gray-600">
              Authorize managers to receive Lark notifications for external vendor installations
            </p>
          </div>

          {/* Status Messages */}
          {authStatus === 'processing' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5 animate-spin" />
              <div>
                <p className="font-semibold text-blue-800">Processing Authorization...</p>
                <p className="text-sm text-blue-700">
                  Connecting to Lark and setting up notifications. This may take a moment...
                </p>
              </div>
            </div>
          )}

          {authStatus === 'success' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800">Authorization Successful!</p>
                <p className="text-sm text-green-700">
                  You will now receive notifications for external vendor assignments
                </p>
              </div>
            </div>
          )}

          {authStatus === 'error' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Authorization Failed</p>
                <p className="text-sm text-red-700">{authError}</p>
              </div>
            </div>
          )}

          {/* How It Works */}
          <div className="mb-8 p-6 bg-orange-50 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">How It Works</h2>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <span className="font-semibold text-orange-600">1.</span>
                Click "Authorize with Lark" below
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-orange-600">2.</span>
                Log in with your Lark account
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-orange-600">3.</span>
                Approve notification permissions
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-orange-600">4.</span>
                Receive notifications when external vendors are assigned to your merchants
              </li>
            </ol>
          </div>

          {/* Authorization Button */}
          <div className="mb-8">
            <button
              onClick={handleAuthorize}
              disabled={authorizing || authStatus === 'processing'}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {authorizing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Redirecting to Lark...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  Authorize with Lark
                </>
              )}
            </button>
          </div>

          {/* Authorized Managers List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Authorized Managers ({managers.filter(m => m.authorized).length})
              </h2>

              {managers.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  No managers authorized yet
                </p>
              ) : (
                <div className="space-y-3">
                  {managers.map(manager => (
                    <div
                      key={manager.email}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        {manager.authorized ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {manager.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {manager.email}
                          </p>
                        </div>
                      </div>

                      {manager.authorized && (
                        <button
                          onClick={() => handleRevoke(manager.email)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* What Notifications You'll Receive */}
          <div className="mt-8 p-4 bg-blue-50 rounded-xl">
            <h3 className="font-semibold text-blue-900 mb-2">What notifications you'll receive:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• When a merchant is assigned to an external vendor for installation</li>
              <li>• Merchant details including name, contact, and preferred date/time</li>
              <li>• External vendor information and response time</li>
            </ul>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-gray-100 rounded-xl">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> Each onboarding manager must authorize individually using their own Lark account.
              Share this page URL with other managers who need to receive notifications.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function ManagerAuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-8 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    }>
      <ManagerAuthorizeContent />
    </Suspense>
  )
}