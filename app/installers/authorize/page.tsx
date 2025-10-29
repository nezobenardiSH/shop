'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Calendar, RefreshCw, LogIn } from 'lucide-react'

interface AuthorizedInstaller {
  email: string
  name: string
  calendarId: string
  authorized: boolean
}

function InstallerAuthorizeContent() {
  const searchParams = useSearchParams()
  const [installers, setInstallers] = useState<AuthorizedInstaller[]>([])
  const [loading, setLoading] = useState(true)
  const [authorizing, setAuthorizing] = useState(false)

  // Check for success/error messages from OAuth callback
  const success = searchParams.get('success')
  const error = searchParams.get('error')
  const authorizedEmail = searchParams.get('email')
  const processing = searchParams.get('processing')
  const code = searchParams.get('code')

  useEffect(() => {
    fetchInstallerStatus()
  }, [success])

  // Clean up URL after processing
  useEffect(() => {
    if (processing && code) {
      // Remove the processing params from URL after a moment
      setTimeout(() => {
        window.history.replaceState({}, '', '/installers/authorize')
      }, 1000)
    }
  }, [processing, code])

  const fetchInstallerStatus = async () => {
    try {
      const response = await fetch('/api/installers/authorization-status')
      const data = await response.json()
      setInstallers(data.installers || [])
    } catch (error) {
      console.error('Failed to fetch installer status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAuthorize = () => {
    setAuthorizing(true)
    window.location.href = '/api/lark/auth/authorize?type=installer'
  }

  const handleRevoke = async (email: string) => {
    if (!confirm(`Revoke authorization for ${email}?`)) return

    try {
      const response = await fetch('/api/installers/revoke-authorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (response.ok) {
        fetchInstallerStatus()
      }
    } catch (error) {
      console.error('Failed to revoke authorization:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf5] to-[#fff4ed] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#0b0707] flex items-center gap-3">
              <Calendar className="h-8 w-8 text-[#ff630f]" />
              Installer Calendar Authorization
            </h1>
            <p className="mt-2 text-[#6b6a6a]">
              Authorize installers to connect their Lark calendars for automatic scheduling
            </p>
          </div>

          {/* Success/Error Messages */}
          {processing && code && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5 animate-spin" />
              <div>
                <p className="font-semibold text-blue-800">Processing Authorization...</p>
                <p className="text-sm text-blue-700">
                  Exchanging authorization code for access token. This may take a moment...
                </p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800">Authorization Successful!</p>
                <p className="text-sm text-green-700">
                  {authorizedEmail} can now use calendar scheduling
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Authorization Failed</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* How It Works */}
          <div className="mb-8 p-6 bg-[#fff4ed] rounded-xl">
            <h2 className="text-lg font-semibold text-[#0b0707] mb-3">How It Works</h2>
            <ol className="space-y-2 text-sm text-[#6b6a6a]">
              <li className="flex gap-2">
                <span className="font-semibold text-[#ff630f]">1.</span>
                Click "Authorize with Lark" below
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#ff630f]">2.</span>
                Log in with your Lark account
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#ff630f]">3.</span>
                Approve calendar access permissions
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#ff630f]">4.</span>
                System can now check your availability and create events
              </li>
            </ol>
          </div>

          {/* Authorization Button */}
          <div className="mb-8">
            <button
              onClick={handleAuthorize}
              disabled={authorizing}
              className="w-full bg-[#ff630f] hover:bg-[#fe5b25] text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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

          {/* Authorized Installers List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 text-[#ff630f] animate-spin" />
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-[#0b0707] mb-4">
                Authorized Installers ({installers.filter(i => i.authorized).length})
              </h2>

              {installers.length === 0 ? (
                <p className="text-[#6b6a6a] text-center py-8">
                  No installers authorized yet
                </p>
              ) : (
                <div className="space-y-3">
                  {installers.map(installer => (
                    <div
                      key={installer.email}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        {installer.authorized ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        )}
                        <div>
                          <p className="font-medium text-[#0b0707]">
                            {installer.name}
                          </p>
                          <p className="text-sm text-[#6b6a6a]">
                            {installer.email}
                          </p>
                          {installer.calendarId && installer.calendarId !== 'primary' && (
                            <p className="text-xs text-[#6b6a6a] mt-1">
                              Calendar: {installer.calendarId}
                            </p>
                          )}
                        </div>
                      </div>

                      {installer.authorized && (
                        <button
                          onClick={() => handleRevoke(installer.email)}
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

          {/* Instructions */}
          <div className="mt-8 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Each installer must authorize individually using their own Lark account.
              Share this page URL with installers who need to connect their calendars.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InstallerAuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#fffaf5] to-[#fff4ed] p-8 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-[#ff630f] animate-spin" />
      </div>
    }>
      <InstallerAuthorizeContent />
    </Suspense>
  )
}