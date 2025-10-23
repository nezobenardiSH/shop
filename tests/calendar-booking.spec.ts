import { test, expect } from '@playwright/test'

test.describe('Calendar Booking Flow', () => {
  test('should successfully book a training session', async ({ page, request }) => {
    console.log('\n🧪 Starting Calendar Booking Test\n')
    console.log('=' .repeat(60))

    // Step 1: Check OAuth tokens
    console.log('\n📋 Step 1: Checking OAuth tokens...')
    const tokensResponse = await request.get('http://localhost:3010/api/lark/auth/check-tokens')
    const tokensData = await tokensResponse.json()
    
    console.log(`   Found ${tokensData.tokens?.length || 0} OAuth token(s)`)
    if (tokensData.tokens && tokensData.tokens.length > 0) {
      tokensData.tokens.forEach((token: any) => {
        console.log(`   - ${token.userName} (${token.userEmail})`)
      })
    }

    // Step 2: Navigate to merchant page
    console.log('\n🌐 Step 2: Navigating to merchant page...')
    await page.goto('http://localhost:3010/merchant/Nasi-Lemak?booking=pos-training')
    await page.waitForLoadState('networkidle')
    console.log('   ✅ Page loaded')

    // Step 3: Check if booking modal is visible
    console.log('\n👀 Step 3: Checking booking modal...')
    const modalVisible = await page.locator('[role="dialog"]').isVisible()
    console.log(`   Modal visible: ${modalVisible}`)

    if (!modalVisible) {
      console.log('   ⚠️  Modal not visible, trying to open it...')
      // Try to click a button that might open the modal
      const bookButton = page.locator('button:has-text("Book Training")')
      if (await bookButton.isVisible()) {
        await bookButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Step 4: Get available time slots
    console.log('\n📅 Step 4: Checking available time slots...')
    await page.waitForTimeout(2000) // Wait for availability to load
    
    const timeSlots = await page.locator('[data-testid="time-slot"], button:has-text("AM"), button:has-text("PM")').all()
    console.log(`   Found ${timeSlots.length} time slot elements`)

    // Step 5: Select a time slot
    console.log('\n⏰ Step 5: Selecting a time slot...')
    let selectedSlot = null
    
    for (const slot of timeSlots) {
      const isDisabled = await slot.isDisabled().catch(() => false)
      const text = await slot.textContent()
      
      if (!isDisabled && text) {
        console.log(`   Trying to select slot: ${text.trim()}`)
        await slot.click()
        selectedSlot = text.trim()
        break
      }
    }

    if (!selectedSlot) {
      console.log('   ⚠️  No available slots found, trying alternative approach...')
      // Try to find any clickable button with time
      const anySlot = page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first()
      if (await anySlot.isVisible()) {
        await anySlot.click()
        selectedSlot = await anySlot.textContent()
        console.log(`   Selected: ${selectedSlot}`)
      }
    }

    await page.waitForTimeout(1000)

    // Step 6: Submit the booking
    console.log('\n📤 Step 6: Submitting booking...')
    
    // Listen for the API call
    const bookingPromise = page.waitForResponse(
      response => response.url().includes('/api/lark/book-training') && response.request().method() === 'POST',
      { timeout: 30000 }
    )

    // Find and click the confirm/book button
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Book"), button:has-text("Submit")').first()
    
    if (await confirmButton.isVisible()) {
      console.log('   Clicking confirm button...')
      await confirmButton.click()
      
      // Wait for the booking API response
      console.log('   Waiting for booking API response...')
      const bookingResponse = await bookingPromise
      const bookingStatus = bookingResponse.status()
      
      console.log(`   API Response Status: ${bookingStatus}`)
      
      if (bookingStatus === 200) {
        const bookingData = await bookingResponse.json()
        console.log('   ✅ Booking successful!')
        console.log('   Response:', JSON.stringify(bookingData, null, 2))
        
        // Verify the response contains expected data
        expect(bookingData).toHaveProperty('success')
        expect(bookingData.success).toBe(true)
        
      } else {
        const errorText = await bookingResponse.text()
        console.log('   ❌ Booking failed!')
        console.log('   Error:', errorText)
        
        // Fail the test with detailed error
        throw new Error(`Booking failed with status ${bookingStatus}: ${errorText}`)
      }
    } else {
      console.log('   ⚠️  Confirm button not found')
      throw new Error('Could not find confirm button')
    }

    // Step 7: Verify success message
    console.log('\n✅ Step 7: Verifying success message...')
    await page.waitForTimeout(2000)
    
    const successMessage = page.locator('text=/success|booked|confirmed/i').first()
    const hasSuccessMessage = await successMessage.isVisible().catch(() => false)
    
    if (hasSuccessMessage) {
      const message = await successMessage.textContent()
      console.log(`   Success message: ${message}`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Test completed successfully!\n')
  })

  test('should display calendar details in server logs', async ({ request }) => {
    console.log('\n🔍 Testing Calendar Resolution\n')
    console.log('=' .repeat(60))

    // Get token info
    const tokensResponse = await request.get('http://localhost:3010/api/lark/auth/check-tokens')
    const tokensData = await tokensResponse.json()

    if (!tokensData.tokens || tokensData.tokens.length === 0) {
      console.log('❌ No OAuth tokens found. Please authorize first.')
      return
    }

    const token = tokensData.tokens[0]
    console.log(`\n📋 Testing with user: ${token.userName} (${token.userEmail})`)
    console.log(`   Calendar ID in DB: ${token.calendarId}`)

    // Make a test booking request to trigger calendar resolution
    console.log('\n🧪 Making test booking request...')
    console.log('   (Check server logs for calendar resolution details)')
    
    const bookingResponse = await request.post('http://localhost:3010/api/lark/book-training', {
      data: {
        merchantId: 'Nasi-Lemak',
        date: '2025-10-30',
        startTime: '14:00',
        endTime: '16:00',
        bookingType: 'pos-training',
        trainerName: token.userName
      }
    })

    const status = bookingResponse.status()
    console.log(`\n📊 Response Status: ${status}`)

    if (status === 200) {
      const data = await bookingResponse.json()
      console.log('✅ Booking Response:', JSON.stringify(data, null, 2))
    } else {
      const errorText = await bookingResponse.text()
      console.log('❌ Error Response:', errorText)
    }

    console.log('\n💡 Check the dev server terminal for detailed logs about:')
    console.log('   - Calendar list retrieval')
    console.log('   - Writable calendar selection')
    console.log('   - Calendar permissions')
    console.log('   - Event creation attempt')
    
    console.log('\n' + '='.repeat(60))
  })

  test('should verify OAuth token exists', async ({ request }) => {
    console.log('\n🔐 Verifying OAuth Setup\n')
    console.log('=' .repeat(60))

    const response = await request.get('http://localhost:3010/api/lark/auth/check-tokens')
    const data = await response.json()

    console.log(`\n📊 OAuth Tokens Found: ${data.tokens?.length || 0}`)

    if (data.tokens && data.tokens.length > 0) {
      data.tokens.forEach((token: any, index: number) => {
        console.log(`\n   Token ${index + 1}:`)
        console.log(`   - Name: ${token.userName}`)
        console.log(`   - Email: ${token.userEmail}`)
        console.log(`   - Lark User ID: ${token.larkUserId}`)
        console.log(`   - Calendar ID: ${token.calendarId}`)
        console.log(`   - Has Access Token: ${token.hasAccessToken ? '✅' : '❌'}`)
        console.log(`   - Has Refresh Token: ${token.hasRefreshToken ? '✅' : '❌'}`)
      })

      // Verify at least one token is valid
      expect(data.tokens.length).toBeGreaterThan(0)
      expect(data.tokens[0].hasAccessToken).toBe(true)
      
      console.log('\n✅ OAuth tokens are properly configured')
    } else {
      console.log('\n❌ No OAuth tokens found!')
      console.log('   Please authorize at: http://localhost:3010/trainers/authorize')
      throw new Error('No OAuth tokens found. Authorization required.')
    }

    console.log('\n' + '='.repeat(60))
  })
})

