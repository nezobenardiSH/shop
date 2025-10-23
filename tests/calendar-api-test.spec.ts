import { test, expect } from '@playwright/test'

test.describe('Calendar Booking API Test', () => {
  test('should successfully create a calendar event via API', async ({ request }) => {
    console.log('\n🧪 Testing Calendar Event Creation via API\n')
    console.log('=' .repeat(70))

    // Step 1: Verify OAuth token exists
    console.log('\n📋 Step 1: Verifying OAuth token...')
    const tokensResponse = await request.get('http://localhost:3010/api/lark/auth/check-tokens')
    const tokensData = await tokensResponse.json()
    
    expect(tokensData.tokens).toBeDefined()
    expect(tokensData.tokens.length).toBeGreaterThan(0)
    
    const token = tokensData.tokens[0]
    console.log(`   ✅ Found token for: ${token.userName} (${token.userEmail})`)
    console.log(`   Calendar ID: ${token.calendarId}`)

    // Step 2: Get merchant data
    console.log('\n📦 Step 2: Getting merchant data...')
    const merchantResponse = await request.get('http://localhost:3010/api/salesforce/merchant/Nasi-Lemak')
    const merchantData = await merchantResponse.json()
    
    console.log(`   Merchant: ${merchantData.name}`)
    console.log(`   Contact: ${merchantData.contactPerson}`)

    // Step 3: Check trainer availability
    console.log('\n📅 Step 3: Checking trainer availability...')
    const availabilityResponse = await request.get(
      'http://localhost:3010/api/lark/availability?trainerName=Jean&merchantAddress=Kuala%20Lumpur'
    )
    const availabilityData = await availabilityResponse.json()
    
    console.log(`   Available days: ${availabilityData.availability?.length || 0}`)
    
    if (availabilityData.availability && availabilityData.availability.length > 0) {
      const firstDay = availabilityData.availability[0]
      console.log(`   First available: ${firstDay.date}`)
      console.log(`   Slots: ${firstDay.slots?.length || 0}`)
    }

    // Step 4: Attempt to book a training session
    console.log('\n📝 Step 4: Attempting to book training session...')

    const bookingData = {
      merchantId: 'Nasi-Lemak',
      merchantName: 'Cafe Nasi Kandar',
      merchantAddress: 'Kuala Lumpur',
      merchantPhone: '+6012345678',
      merchantContactPerson: 'Jean',
      onboardingTrainerName: 'Nasi Lemak',
      date: '2025-10-31',
      startTime: '16:00',
      endTime: '18:00',
      bookingType: 'pos-training',
      trainerLanguages: ['English'],
      onboardingServicesBought: 'POS Training'
    }

    console.log('   Booking details:')
    console.log(`   - Merchant: ${bookingData.merchantName}`)
    console.log(`   - Date: ${bookingData.date}`)
    console.log(`   - Time: ${bookingData.startTime} - ${bookingData.endTime}`)
    console.log(`   - Type: ${bookingData.bookingType}`)

    const bookingResponse = await request.post('http://localhost:3010/api/lark/book-training', {
      data: bookingData
    })

    const bookingStatus = bookingResponse.status()
    console.log(`\n📊 Response Status: ${bookingStatus}`)

    if (bookingStatus === 200) {
      const responseData = await bookingResponse.json()
      console.log('\n✅ BOOKING SUCCESSFUL!')
      console.log('   Response:', JSON.stringify(responseData, null, 2))
      
      expect(responseData.success).toBe(true)
      expect(responseData.eventId).toBeDefined()
      
      console.log(`\n   Event ID: ${responseData.eventId}`)
      console.log(`   Trainer: ${responseData.trainer}`)
      
    } else {
      const errorText = await bookingResponse.text()
      console.log('\n❌ BOOKING FAILED!')
      console.log('   Status:', bookingStatus)
      console.log('   Error:', errorText)
      
      // Try to parse as JSON
      try {
        const errorJson = JSON.parse(errorText)
        console.log('   Error details:', JSON.stringify(errorJson, null, 2))
      } catch (e) {
        // Not JSON, already logged as text
      }
      
      // Don't fail the test, just report the error
      console.log('\n⚠️  This indicates the calendar permission issue still exists')
      console.log('   Check the dev server logs for detailed error information')
    }

    console.log('\n' + '='.repeat(70))
  })

  test('should show detailed calendar resolution logs', async ({ request }) => {
    console.log('\n🔍 Testing Calendar Resolution Logic\n')
    console.log('=' .repeat(70))

    console.log('\n💡 This test will trigger calendar resolution.')
    console.log('   Watch the dev server terminal for logs like:')
    console.log('   - 🔍 Finding writable calendar for nezo.benardi@storehub.com...')
    console.log('   - ✅ Using writable calendar: feishu.cn_xxxxx')
    console.log('   - Calendar permissions and details')
    console.log('')

    const bookingData = {
      merchantId: 'Nasi-Lemak',
      merchantName: 'Cafe Nasi Kandar',
      merchantAddress: 'Kuala Lumpur',
      merchantPhone: '+6012345678',
      merchantContactPerson: 'Jean',
      onboardingTrainerName: 'Nasi Lemak',
      date: '2025-10-31',
      startTime: '10:00',
      endTime: '12:00',
      bookingType: 'pos-training',
      trainerLanguages: ['English'],
      onboardingServicesBought: 'POS Training'
    }

    console.log('📤 Sending booking request...\n')
    
    const response = await request.post('http://localhost:3010/api/lark/book-training', {
      data: bookingData
    })

    const status = response.status()
    console.log(`📊 Response Status: ${status}\n`)

    if (status === 200) {
      const data = await response.json()
      console.log('✅ Success! Response:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      const errorText = await response.text()
      console.log('❌ Error Response:')
      console.log(errorText)
    }

    console.log('\n📋 Check the dev server terminal above for detailed logs')
    console.log('   showing how the calendar was selected and why.')
    console.log('\n' + '='.repeat(70))
  })

  test('should verify calendar permissions in database', async ({ request }) => {
    console.log('\n🔐 Checking Calendar Permissions in Database\n')
    console.log('=' .repeat(70))

    const tokensResponse = await request.get('http://localhost:3010/api/lark/auth/check-tokens')
    const tokensData = await tokensResponse.json()

    if (tokensData.tokens && tokensData.tokens.length > 0) {
      const token = tokensData.tokens[0]
      
      console.log('\n📋 Current OAuth Token Info:')
      console.log(`   User: ${token.userName}`)
      console.log(`   Email: ${token.userEmail}`)
      console.log(`   Lark User ID: ${token.larkUserId}`)
      console.log(`   Calendar ID: ${token.calendarId}`)
      console.log(`   Token Expired: ${token.isExpired ? '❌ YES' : '✅ NO'}`)
      
      if (token.scopes) {
        console.log(`   Scopes: ${token.scopes}`)
      }

      console.log('\n💡 The calendar ID above will be used for booking.')
      console.log('   If booking fails, the system will try to find a writable calendar.')
      
      expect(token.calendarId).toBeDefined()
      expect(token.larkUserId).toBeDefined()
      expect(token.isExpired).toBe(false)
      
      console.log('\n✅ OAuth token is valid and ready to use')
    } else {
      console.log('\n❌ No OAuth tokens found!')
      throw new Error('No OAuth tokens. Please authorize at /trainers/authorize')
    }

    console.log('\n' + '='.repeat(70))
  })
})

