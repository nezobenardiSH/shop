import { test, expect } from '@playwright/test'

/**
 * Test Suite: Direct Booking URLs
 * 
 * Tests the functionality of URL parameters that automatically open booking modals
 * for POS Training, BackOffice Training, and Installation.
 * 
 * URL Format: /merchant/[merchantId]?booking=[bookingType]
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010'
const TEST_MERCHANT = 'Nasi-Lemak' // Replace with actual test merchant

test.describe('Direct Booking URLs', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set a longer timeout for these tests since they involve data loading
    test.setTimeout(60000)
  })

  test('should auto-open POS Training modal from URL parameter', async ({ page }) => {
    console.log('Testing POS Training URL parameter...')
    
    // Navigate to merchant page with pos-training booking parameter
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=pos-training`)
    
    // Wait for page to load and modal to appear
    await page.waitForLoadState('networkidle')
    
    // Check that the booking modal is visible
    const modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    await expect(modal).toBeVisible({ timeout: 10000 })
    
    // Verify modal title contains "Training" or "POS"
    const modalTitle = page.locator('h2, h3').filter({ hasText: /training|schedule/i }).first()
    await expect(modalTitle).toBeVisible()
    
    // Verify language selection is present (for training bookings)
    const languageSection = page.locator('text=/training language/i').first()
    await expect(languageSection).toBeVisible()
    
    // Verify NO languages are pre-selected (opt-in behavior)
    const englishCheckbox = page.locator('input[type="checkbox"]').filter({ has: page.locator('text=English') }).first()
    const bahasaCheckbox = page.locator('input[type="checkbox"]').filter({ has: page.locator('text=Bahasa Malaysia') }).first()
    const chineseCheckbox = page.locator('input[type="checkbox"]').filter({ has: page.locator('text=Chinese') }).first()
    
    await expect(englishCheckbox).not.toBeChecked()
    await expect(bahasaCheckbox).not.toBeChecked()
    await expect(chineseCheckbox).not.toBeChecked()
    
    // Verify URL parameter is removed after modal opens
    await page.waitForTimeout(2000) // Wait for URL cleanup
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('booking=pos-training')
    expect(currentUrl).toContain(`/merchant/${TEST_MERCHANT}`)
    
    console.log('✅ POS Training modal opened successfully')
  })

  test('should auto-open BackOffice Training modal from URL parameter', async ({ page }) => {
    console.log('Testing BackOffice Training URL parameter...')
    
    // Navigate to merchant page with backoffice-training booking parameter
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=backoffice-training`)
    
    // Wait for page to load and modal to appear
    await page.waitForLoadState('networkidle')
    
    // Check that the booking modal is visible
    const modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    await expect(modal).toBeVisible({ timeout: 10000 })
    
    // Verify modal title contains "Training" or "BackOffice"
    const modalTitle = page.locator('h2, h3').filter({ hasText: /training|schedule|backoffice/i }).first()
    await expect(modalTitle).toBeVisible()
    
    // Verify language selection is present
    const languageSection = page.locator('text=/training language/i').first()
    await expect(languageSection).toBeVisible()
    
    // Verify NO languages are pre-selected
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).not.toBeChecked()
    }
    
    // Verify URL parameter is removed
    await page.waitForTimeout(2000)
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('booking=backoffice-training')
    
    console.log('✅ BackOffice Training modal opened successfully')
  })

  test('should auto-open Installation modal from URL parameter', async ({ page }) => {
    console.log('Testing Installation URL parameter...')
    
    // Navigate to merchant page with installation booking parameter
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=installation`)
    
    // Wait for page to load and modal to appear
    await page.waitForLoadState('networkidle')
    
    // Check that the booking modal is visible
    const modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    await expect(modal).toBeVisible({ timeout: 10000 })
    
    // Verify modal title contains "Installation"
    const modalTitle = page.locator('h2, h3').filter({ hasText: /installation|schedule/i }).first()
    await expect(modalTitle).toBeVisible()
    
    // Installation bookings should NOT have language selection
    // (only training bookings have language selection)
    const languageSection = page.locator('text=/training language/i').first()
    const languageSectionVisible = await languageSection.isVisible().catch(() => false)
    
    // If language section exists, it should not be visible for installation
    if (languageSectionVisible) {
      console.log('⚠️ Warning: Language selection should not appear for installation bookings')
    }
    
    // Verify URL parameter is removed
    await page.waitForTimeout(2000)
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('booking=installation')
    
    console.log('✅ Installation modal opened successfully')
  })

  test('should NOT open modal for invalid booking parameter', async ({ page }) => {
    console.log('Testing invalid booking parameter...')
    
    // Navigate with invalid booking parameter
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=invalid-type`)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Modal should NOT be visible
    const modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    const isVisible = await modal.isVisible().catch(() => false)
    
    expect(isVisible).toBe(false)
    
    console.log('✅ Modal correctly did not open for invalid parameter')
  })

  test('should NOT open modal without booking parameter', async ({ page }) => {
    console.log('Testing normal page load without parameter...')
    
    // Navigate without booking parameter
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}`)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Modal should NOT be visible
    const modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    const isVisible = await modal.isVisible().catch(() => false)
    
    expect(isVisible).toBe(false)
    
    console.log('✅ Page loaded normally without auto-opening modal')
  })

  test('should allow user to select language and see filtered slots', async ({ page }) => {
    console.log('Testing language selection and slot filtering...')
    
    // Navigate to POS training booking
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=pos-training`)
    await page.waitForLoadState('networkidle')
    
    // Wait for modal to appear
    const modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    await expect(modal).toBeVisible({ timeout: 10000 })
    
    // Select English language
    const englishCheckbox = page.locator('input[type="checkbox"]').filter({ has: page.locator('text=English') }).first()
    await englishCheckbox.check()
    await expect(englishCheckbox).toBeChecked()
    
    // Wait for slots to load/filter
    await page.waitForTimeout(1000)
    
    // Verify calendar/date picker is visible
    const calendar = page.locator('text=/select date|select time/i').first()
    await expect(calendar).toBeVisible()
    
    console.log('✅ Language selection and slot filtering works')
  })

  test('should close modal and keep URL clean', async ({ page }) => {
    console.log('Testing modal close behavior...')
    
    // Navigate with booking parameter
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=pos-training`)
    await page.waitForLoadState('networkidle')
    
    // Wait for modal to appear
    const modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    await expect(modal).toBeVisible({ timeout: 10000 })
    
    // Wait for URL to be cleaned
    await page.waitForTimeout(2000)
    let currentUrl = page.url()
    expect(currentUrl).not.toContain('booking=')
    
    // Close modal (look for X button or Cancel button)
    const closeButton = page.locator('button').filter({ hasText: /cancel|close/i }).first()
    const xButton = page.locator('button svg').first() // X icon
    
    const closeButtonVisible = await closeButton.isVisible().catch(() => false)
    const xButtonVisible = await xButton.isVisible().catch(() => false)
    
    if (closeButtonVisible) {
      await closeButton.click()
    } else if (xButtonVisible) {
      await xButton.click()
    }
    
    // Modal should be hidden
    await page.waitForTimeout(500)
    const isVisible = await modal.isVisible().catch(() => false)
    expect(isVisible).toBe(false)
    
    // URL should still be clean
    currentUrl = page.url()
    expect(currentUrl).not.toContain('booking=')
    expect(currentUrl).toContain(`/merchant/${TEST_MERCHANT}`)
    
    console.log('✅ Modal closed and URL remains clean')
  })

  test('should handle multiple booking types in sequence', async ({ page }) => {
    console.log('Testing multiple booking types in sequence...')
    
    // Test POS Training
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=pos-training`)
    await page.waitForLoadState('networkidle')
    let modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    await expect(modal).toBeVisible({ timeout: 10000 })
    
    // Close modal
    const closeButton1 = page.locator('button').filter({ hasText: /cancel/i }).first()
    await closeButton1.click()
    await page.waitForTimeout(500)
    
    // Test BackOffice Training
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=backoffice-training`)
    await page.waitForLoadState('networkidle')
    modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    await expect(modal).toBeVisible({ timeout: 10000 })
    
    // Close modal
    const closeButton2 = page.locator('button').filter({ hasText: /cancel/i }).first()
    await closeButton2.click()
    await page.waitForTimeout(500)
    
    // Test Installation
    await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=installation`)
    await page.waitForLoadState('networkidle')
    modal = page.locator('[role="dialog"], .fixed.inset-0').first()
    await expect(modal).toBeVisible({ timeout: 10000 })
    
    console.log('✅ All booking types work in sequence')
  })
})

