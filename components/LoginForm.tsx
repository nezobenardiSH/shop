'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface LoginFormProps {
  merchantId: string
}

export default function LoginForm({ merchantId }: LoginFormProps) {
  const [pin, setPIN] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Check if session expired
    if (searchParams.get('expired') === 'true') {
      setError('Your session has expired. Please log in again.')
    }
  }, [searchParams])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setRemainingAttempts(null)
    
    try {
      const response = await fetch('/api/auth/merchant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, pin })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Get redirect URL or default to merchant page
        const redirectUrl = searchParams.get('redirect') || `/merchant/${merchantId}`
        router.push(redirectUrl)
        router.refresh()
      } else {
        setError(data.error || 'Invalid PIN')
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts)
        }
        if (data.lockout) {
          setPIN('') // Clear PIN on lockout
        }
      }
    } catch (error) {
      setError('Connection error. Please try again.')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handlePINChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '') // Only allow digits
    if (value.length <= 4) {
      setPIN(value)
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Merchant Portal Access
            </h2>
            <p className="mt-2 text-gray-600">
              Merchant: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{merchantId}</span>
            </p>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                Enter 4-Digit PIN
              </label>
              <input
                id="pin"
                type="text"
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{4}"
                value={pin}
                onChange={handlePINChange}
                className="block w-full text-center text-3xl tracking-[1em] font-mono
                         px-4 py-3 border-2 border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="••••"
                required
                disabled={loading}
                autoComplete="off"
              />
              <p className="mt-2 text-sm text-gray-500 text-center">
                Use the last 4 digits of your registered phone number
              </p>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p>{error}</p>
                    {remainingAttempts !== null && remainingAttempts > 0 && (
                      <p className="mt-1 text-xs">
                        {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading || pin.length !== 4}
              className="w-full flex items-center justify-center py-3 px-4
                       border border-transparent rounded-lg text-white
                       bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2
                       focus:ring-offset-2 focus:ring-blue-500
                       disabled:bg-gray-300 disabled:cursor-not-allowed
                       transition-colors duration-200"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </>
              ) : (
                'Access Portal'
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Having trouble? Contact your administrator for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}