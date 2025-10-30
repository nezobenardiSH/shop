import { test, expect } from '@playwright/test'

test('Installation booking flow for activate175', async ({ page }) => {
  const merchantId = 'a0yQ9000003aAvBIAU'
  
  // Enable console logging
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]:`, msg.text())
  })
  
  // Enable request/response logging
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log(`[REQUEST] ${request.method()} ${request.url()}`)
    }
  })
  
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`)
      if (response.url().includes('/book')) {
        try {
          const body = await response.json()
          console.log('[RESPONSE BODY]:', JSON.stringify(body, null, 2))
        } catch (e) {
          console.log('[RESPONSE BODY]: Could not parse JSON')
        }
      }
    }
  })
  
  // Navigate to merchant page
  console.log(`\n🔍 Navigating to merchant page: ${merchantId}`)
  await page.goto(`https://onboarding-portal-5fhi.onrender.com/merchant/${merchantId}`)

  // Wait for page to load
  await page.waitForLoadState('networkidle')

  // Take screenshot of initial state
  await page.screenshot({ path: 'tests/screenshots/01-initial-page.png', fullPage: true })
  console.log('📸 Screenshot saved: 01-initial-page.png')

  // Check if there's a PIN login page
  const pinText = page.locator('text=/Enter 4-Digit PIN|PIN/i')
  const isPinLoginPage = await pinText.isVisible({ timeout: 2000 }).catch(() => false)

  if (isPinLoginPage) {
    console.log('🔐 PIN login page detected - entering PIN...')

    // Find the input field (try multiple selectors)
    const pinInput = page.locator('input[type="password"]').or(page.locator('input[type="text"]')).first()

    // Enter PIN: 8063
    await pinInput.fill('8063')
    console.log('✅ PIN entered: 8063')

    await page.waitForTimeout(500)

    // Click login button
    const loginButton = page.locator('button:has-text("Log in")')
    await loginButton.click()
    console.log('✅ Login button clicked')

    // Wait for navigation to merchant dashboard
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'tests/screenshots/02-after-login.png', fullPage: true })
    console.log('📸 Screenshot saved: 02-after-login.png')
  } else {
    console.log('ℹ️ No PIN login page - already authenticated or direct access')
  }

  // Wait for the page to fully hydrate
  console.log('⏳ Waiting for page to fully render...')
  await page.waitForTimeout(3000)

  // Check if installation section exists
  const installationSection = page.getByRole('heading', { name: 'Installation' })
  const isInstallationVisible = await installationSection.isVisible({ timeout: 5000 }).catch(() => false)

  if (!isInstallationVisible) {
    console.log('❌ Installation section NOT found')
    console.log('🔍 Looking for alternative selectors...')

    // List all visible text on the page
    const allText = await page.locator('body').textContent()
    console.log('\n📝 Page text content (first 500 chars):', allText?.substring(0, 500))

    // Try to find any buttons or sections
    const allButtons = await page.locator('button').count()
    console.log(`Found ${allButtons} buttons on page`)

    const allHeadings = await page.locator('h1, h2, h3, h4').allTextContents()
    console.log('Headings on page:', allHeadings)

    throw new Error('Installation section not found on page')
  }

  console.log('✅ Installation section found')
  
  // Look for the Schedule button
  const scheduleButton = page.locator('button:has-text("Schedule")').first()
  await expect(scheduleButton).toBeVisible()
  console.log('✅ Schedule button found')
  
  // Click Schedule button
  console.log('\n📅 Clicking Schedule button...')
  await scheduleButton.click()
  
  // Wait for modal/dialog to appear
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'tests/screenshots/03-schedule-modal.png', fullPage: true })
  console.log('📸 Screenshot saved: 03-schedule-modal.png')
  
  // Look for date picker or calendar
  const dateInput = page.locator('input[type="date"]').first()
  if (await dateInput.isVisible()) {
    console.log('✅ Date input found')
    
    // Select a future date (tomorrow)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateString = tomorrow.toISOString().split('T')[0]
    
    console.log(`📅 Setting date to: ${dateString}`)
    await dateInput.fill(dateString)
    await page.waitForTimeout(500)
    
    await page.screenshot({ path: 'tests/screenshots/04-date-selected.png', fullPage: true })
    console.log('📸 Screenshot saved: 04-date-selected.png')
  }
  
  // Look for time slot selection
  console.log('\n🕐 Looking for time slots...')
  await page.waitForTimeout(1000)
  
  // Try to find any available time slot button
  const timeSlotButtons = page.locator('button:has-text("AM"), button:has-text("PM")')
  const count = await timeSlotButtons.count()
  console.log(`Found ${count} time slot buttons`)
  
  if (count > 0) {
    console.log('✅ Clicking first available time slot...')
    await timeSlotButtons.first().click()
    await page.waitForTimeout(500)
    
    await page.screenshot({ path: 'tests/screenshots/05-timeslot-selected.png', fullPage: true })
    console.log('📸 Screenshot saved: 05-timeslot-selected.png')
  }
  
  // Look for Confirm/Book button
  const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Book")')
  if (await confirmButton.isVisible()) {
    console.log('\n✅ Confirm button found')
    console.log('📝 Clicking Confirm to book installation...')
    
    // Click confirm and wait for API response
    await confirmButton.click()
    
    // Wait for booking to complete
    await page.waitForTimeout(3000)
    
    await page.screenshot({ path: 'tests/screenshots/06-after-booking.png', fullPage: true })
    console.log('📸 Screenshot saved: 06-after-booking.png')
  }
  
  // Check if installation date is now displayed
  console.log('\n🔍 Checking if installation date was saved...')
  await page.waitForTimeout(2000)
  
  const installationDateText = page.locator('text=/Scheduled Installation Date|Installation Date/')
  if (await installationDateText.isVisible()) {
    const dateValue = await page.locator('text=/\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2}\\/\\d{4}/').first().textContent()
    console.log(`✅ Installation date found: ${dateValue}`)
  } else {
    console.log('❌ Installation date NOT found')
  }
  
  const installerText = page.locator('text=/Assigned Installer|Installer/')
  if (await installerText.isVisible()) {
    const installerValue = await page.textContent('text=/Assigned Installer|Installer/')
    console.log(`✅ Assigned installer found: ${installerValue}`)
  } else {
    console.log('❌ Assigned installer NOT found')
  }
  
  await page.screenshot({ path: 'tests/screenshots/07-final-state.png', fullPage: true })
  console.log('📸 Screenshot saved: 07-final-state.png')
  
  console.log('\n✅ Test completed!')
})

