/**
 * Test script to trigger installation booking and see logs
 */
require('dotenv').config({ path: '.env.local' })

async function testInstallationBooking() {
  const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  console.log('🔍 Testing Installation Booking')
  console.log('API URL:', API_URL)
  console.log('=====================================\n')
  
  // Test data for activate175
  const bookingData = {
    merchantId: 'a0yQ9000003aAvBIAU',
    merchantName: 'activate175',
    date: '2025-11-14', // A future date
    timeSlot: {
      start: '14:00',
      end: '15:00'
    },
    availableInstallers: ['Mohamad Fairul Ismail'],
    onboardingTrainerName: 'activate175'
  }
  
  try {
    console.log('📤 Sending booking request...')
    console.log('Request data:', JSON.stringify(bookingData, null, 2))
    
    const response = await fetch(`${API_URL}/api/installation/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData)
    })
    
    const result = await response.json()
    
    console.log('\n📥 Response:')
    console.log('Status:', response.status)
    console.log('Result:', JSON.stringify(result, null, 2))
    
    if (result.eventId) {
      console.log('\n✅ Installation event created successfully!')
      console.log('Event ID:', result.eventId)
      console.log('\n⚠️ Check your server logs to see the debug output:')
      console.log('- Event description being sent')
      console.log('- Full event object')
      console.log('- Lark API response')
    } else {
      console.log('\n❌ Failed to create installation event')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testInstallationBooking().catch(console.error)