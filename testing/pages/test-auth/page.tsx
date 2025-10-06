'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TestAuthPage() {
  const [merchantId, setMerchantId] = useState('Nasi-Lemak')
  const [pin, setPin] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const testLogin = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/auth/merchant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, pin })
      })
      
      const data = await response.json()
      setResult({ status: response.status, data })
      
      if (response.ok) {
        setTimeout(() => {
          router.push(`/merchant/${merchantId}`)
        }, 2000)
      }
    } catch (error: any) {
      setResult({ error: error?.message || 'An error occurred' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication Test Page</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Available Test Credentials</h2>
          <div className="space-y-2 text-sm font-mono bg-gray-100 p-4 rounded">
            <p>Merchant: Nasi-Lemak (or Nasi Lemak)</p>
            <p className="text-green-600">✅ PIN 5678 - from +6012345678 (Merchant PIC)</p>
            <p className="text-green-600">✅ PIN 5001 - from +60149245001 (Business Owner)</p>
            <p className="text-green-600">✅ PIN 7765 - from +6019887765 (Operation Manager)</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test Login</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Merchant ID</label>
              <input
                type="text"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter merchant ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">PIN</label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter 4-digit PIN"
                maxLength={4}
              />
            </div>
            
            <button
              onClick={testLogin}
              disabled={loading || !merchantId || pin.length !== 4}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 
                       text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Testing...' : 'Test Login'}
            </button>
          </div>
          
          {result && (
            <div className={`mt-4 p-4 rounded-lg ${
              result.status === 200 ? 'bg-green-50 border border-green-200' : 
              'bg-red-50 border border-red-200'
            }`}>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
              {result.status === 200 && (
                <p className="text-green-700 mt-2">
                  ✅ Login successful! Redirecting to merchant portal...
                </p>
              )}
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center">
          <a 
            href="/merchant/Nasi-Lemak" 
            className="text-blue-600 hover:underline mr-4"
          >
            Try accessing protected route →
          </a>
          <a 
            href="/login/Nasi-Lemak" 
            className="text-blue-600 hover:underline"
          >
            Go to login page →
          </a>
        </div>
      </div>
    </div>
  )
}