'use client'

import { useState, useEffect } from 'react'

interface Merchant {
  id: string
  slug: string
  companyName: string
  email: string
  address: string | null
  phone: string | null
  onboardingStage: string
  installationDate: string | null
  trainingDate: string | null
  updatedAt: string
}

export default function MerchantDashboard({
  params
}: {
  params: Promise<{ merchant: string }>
}) {
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [merchantSlug, setMerchantSlug] = useState<string>('')

  useEffect(() => {
    params.then(({ merchant }) => {
      setMerchantSlug(merchant)
    })
  }, [params])

  useEffect(() => {
    if (merchantSlug) {
      fetchMerchant()
    }
  }, [merchantSlug])

  async function fetchMerchant() {
    if (!merchantSlug) return

    try {
      setLoading(true)
      const res = await fetch(`/api/merchant/${merchantSlug}`)

      if (!res.ok) {
        throw new Error('Merchant not found')
      }

      const data = await res.json()
      setMerchant(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load merchant')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(field: string, value: string | null) {
    if (!merchant) return

    try {
      setSyncStatus('Syncing...')
      setLoading(true)

      const res = await fetch(`/api/merchant/${merchant.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })

      if (!res.ok) {
        throw new Error('Update failed')
      }

      const updated = await res.json()
      setMerchant(updated)
      setSyncStatus('Synced with Salesforce!')

      // Clear sync status after 3 seconds
      setTimeout(() => setSyncStatus(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
      setSyncStatus(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !merchant) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-red-800 mb-2">Error</h1>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchMerchant}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!merchant) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-yellow-800 mb-2">Merchant Not Found</h1>
          <p className="text-yellow-600">The merchant "{merchantSlug}" could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {merchant.companyName}
          </h1>
          <p className="text-lg text-gray-600">
            Manage your onboarding information and track your progress
          </p>
        </div>

        {/* Onboarding Status */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Onboarding Status</h2>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-500 mb-1">Current Stage</div>
              <div className="text-lg font-bold capitalize text-blue-600">
                {merchant.onboardingStage.replace('_', ' ')}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-500 mb-1">Last Updated</div>
              <div className="text-sm text-gray-700">
                {new Date(merchant.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Business Information */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={merchant.companyName}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Contact support to change company name</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={merchant.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Contact support to change email</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Address
              </label>
              <textarea
                rows={3}
                value={merchant.address || ''}
                onChange={(e) => handleUpdate('address', e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                placeholder="Enter your business address..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={merchant.phone || ''}
                onChange={(e) => handleUpdate('phone', e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </div>

        {/* Important Dates */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Important Dates</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Installation Date
              </label>
              <input
                type="date"
                value={merchant.installationDate ? merchant.installationDate.split('T')[0] : ''}
                onChange={(e) => handleUpdate('installationDate', e.target.value || null)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">When should we install your system?</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Training Date
              </label>
              <input
                type="date"
                value={merchant.trainingDate ? merchant.trainingDate.split('T')[0] : ''}
                onChange={(e) => handleUpdate('trainingDate', e.target.value || null)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">When would you like training?</p>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        {syncStatus && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{syncStatus}</span>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Updating...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}