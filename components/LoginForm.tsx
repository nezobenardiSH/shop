'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import WhatsAppButton from '@/components/WhatsAppButton'

interface LoginFormProps {
  merchantId: string
}

export default function LoginForm({ merchantId }: LoginFormProps) {
  const [pin, setPIN] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [isInternalMode, setIsInternalMode] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if session expired
    if (searchParams.get('expired') === 'true') {
      setError('Your session has expired. Please log in again.')
    }

    // Fetch merchant name from API since merchantId is now a Salesforce ID
    const fetchMerchantName = async () => {
      try {
        const response = await fetch(`/api/salesforce/merchant/${merchantId}`)
        const data = await response.json()
        console.log('Login page - API response:', data)
        if (data.success && (data.name || data.trainerName)) {
          const merchantName = data.name || data.trainerName
          setDisplayName(merchantName)
          // Update page title with merchant name
          document.title = `${merchantName} - Onboarding Portal`
        } else {
          console.log('No merchant name found in response')
          setDisplayName('Merchant Portal')
        }
      } catch (error) {
        console.error('Failed to fetch merchant name:', error)
        setDisplayName('Merchant Portal')
      }
    }

    fetchMerchantName()
  }, [searchParams, merchantId])

  // Keyboard shortcut to toggle internal mode (Ctrl+Shift+I)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        setIsInternalMode(prev => !prev)
        setPIN('')
        setPassphrase('')
        setError('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setRemainingAttempts(null)
    
    try {
      const response = await fetch('/api/auth/merchant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, pin: isInternalMode ? passphrase : pin })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Get redirect URL or default to merchant page
        const redirectUrl = searchParams.get('redirect') || `/merchant/${merchantId}`
        console.log('Login successful, redirecting to:', redirectUrl)
        console.log('Response data:', data)
        
        // Use window.location for a hard redirect to ensure cookies are picked up
        window.location.href = redirectUrl
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
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f6]">
      <div className="max-w-md w-full mx-4">
        <div className="p-8">
          <div className="text-center mb-8">
            {/* StoreHub Logo */}
            <div className="flex justify-center mb-6">
              <img
                src="/SH_logo.avif"
                alt="StoreHub"
                className="h-8 w-auto"
              />
            </div>

            <h2 className="text-2xl font-bold text-[#0b0707] mb-2">
              Onboarding Portal
            </h2>
            <p className="text-lg text-[#6b6a6a]">
              {displayName}
            </p>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-[#0b0707] mb-2">
                {isInternalMode ? 'Enter Passphrase' : 'Enter 4-Digit PIN'}
              </label>
              {isInternalMode ? (
                <input
                  id="passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="block w-full text-center text-xl
                           px-4 py-3 border-2 border-[#e5e7eb] rounded-lg
                           focus:outline-none focus:border-[#ff630f]
                           disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Enter passphrase"
                  required
                  disabled={loading}
                  autoComplete="off"
                />
              ) : (
                <input
                  id="pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={pin}
                  onChange={handlePINChange}
                  className="block w-full text-center text-3xl tracking-[1em] font-mono
                           px-4 py-3 border-2 border-[#e5e7eb] rounded-lg
                           focus:outline-none focus:border-[#ff630f]
                           disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="••••"
                  required
                  disabled={loading}
                  autoComplete="off"
                />
              )}
              {isInternalMode && (
                <p className="text-xs text-orange-500 mt-2 text-center">Internal Team Mode</p>
              )}
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
              disabled={loading || (isInternalMode ? passphrase.length < 8 : pin.length !== 4)}
              className="w-full flex items-center justify-center py-3 px-4
                       border border-transparent rounded-full text-white font-medium
                       bg-[#ff630f] hover:bg-[#fe5b25] focus:outline-none focus:ring-2
                       focus:ring-offset-2 focus:ring-[#ff630f]
                       disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-all duration-200 transform hover:scale-105 disabled:transform-none"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </>
              ) : (
                'Log in'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#6b6a6a]">
              Having trouble? Contact your onboarding manager.
            </p>
          </div>
        </div>
      </div>

      {/* WhatsApp Floating Button */}
      <WhatsAppButton />
    </div>
  )
}