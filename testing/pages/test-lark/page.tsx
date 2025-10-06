'use client'

import { useState } from 'react'
import BookingModal from '@/components/BookingModal'

export default function TestLarkPage() {
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testAvailability = async () => {
    setLoading(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/lark/availability?trainerName=Nezo')
      const data = await response.json()
      setTestResult({
        type: 'availability',
        success: response.ok,
        data
      })
    } catch (error: any) {
      setTestResult({
        type: 'availability',
        success: false,
        error: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBookingComplete = () => {
    setBookingModalOpen(false)
    setTestResult({
      type: 'booking',
      success: true,
      message: 'Booking completed!'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🧪 Lark Calendar Integration Test
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Test Functions</h2>

          <div className="space-y-4">
            <div>
              <button
                onClick={testAvailability}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors mr-4"
              >
                {loading ? 'Testing...' : '📅 Test Availability API'}
              </button>
              <span className="text-gray-600 text-sm">
                Query Nezo's calendar for available slots
              </span>
            </div>

            <div>
              <button
                onClick={() => setBookingModalOpen(true)}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors mr-4"
              >
                🗓️ Open Booking Modal
              </button>
              <span className="text-gray-600 text-sm">
                Test the booking UI component
              </span>
            </div>
          </div>

          {testResult && (
            <div className={`mt-6 p-4 rounded-lg border ${
              testResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <h3 className="font-semibold mb-2">
                {testResult.success ? '✅ Test Successful' : '❌ Test Failed'}
              </h3>
              
              <div className="text-sm">
                <p className="font-medium">Type: {testResult.type}</p>
                {testResult.message && (
                  <p className="mt-2">{testResult.message}</p>
                )}
                {testResult.error && (
                  <p className="mt-2 text-red-600">Error: {testResult.error}</p>
                )}
                {testResult.data && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      View Response Data
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">📋 Configuration Info</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Trainers configured:</strong> Nezo (nezo.benardi@storehub.com), Jia En (jiaen.chai@storehub.com)</p>
            <p><strong>Lark App ID:</strong> cli_a8549d99f97c502f</p>
            <p><strong>API Domain:</strong> https://open.larksuite.com</p>
            <p><strong>Timezone:</strong> Asia/Singapore</p>
            <p><strong>Time Slots:</strong> 9:00 AM - 11:00 AM, 11:00 AM - 1:00 PM, 1:00 PM - 3:00 PM, 3:00 PM - 5:00 PM, 4:00 PM - 6:00 PM</p>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {bookingModalOpen && (
        <BookingModal
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          merchantId="test-merchant-001"
          merchantName="Test Merchant"
          trainerName="Nezo"
          onBookingComplete={handleBookingComplete}
        />
      )}
    </div>
  )
}