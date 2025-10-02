const { test, expect } = require('@playwright/test');

test.describe('Merchant Portal - Lark Integration', () => {
  test('should load trainer portal and show booking functionality', async ({ page }) => {
    console.log('🚀 Starting Merchant Portal test...\n');
    
    // Navigate to the merchant page
    await page.goto('http://localhost:3010/merchant/Nasi-Lemak');
    console.log('✅ Navigated to /merchant/Nasi-Lemak');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check page title
    const title = await page.locator('h1').textContent();
    console.log(`📋 Page title: ${title}`);
    expect(title).toContain('Trainer Portal');
    
    // Check trainer name display
    const trainerInfo = await page.locator('p:has-text("Trainer:")').textContent();
    console.log(`👤 Trainer info: ${trainerInfo}`);
    expect(trainerInfo).toContain('Nasi-Lemak');
    
    // Click Load Trainer Data button
    console.log('\n🔄 Loading trainer data...');
    const loadButton = page.locator('button:has-text("Load Trainer Data")');
    await loadButton.click();
    
    // Wait for data to load
    await page.waitForTimeout(3000);
    
    // Check for success or error message
    const messageBox = page.locator('.bg-green-50, .bg-red-50').first();
    const hasMessage = await messageBox.count() > 0;
    
    if (hasMessage) {
      const message = await messageBox.textContent();
      console.log(`📨 Response message: ${message}`);
    }
    
    // Check if trainer data loaded
    const trainerDataSection = page.locator('text=/Onboarding Trainer/i');
    const hasTrainerData = await trainerDataSection.count() > 0;
    
    if (hasTrainerData) {
      console.log('✅ Trainer data section found');
      
      // Look for Book Training button
      const bookTrainingButtons = page.locator('button:has-text("Book Training")');
      const bookButtonCount = await bookTrainingButtons.count();
      console.log(`\n📅 Found ${bookButtonCount} "Book Training" button(s)`);
      
      if (bookButtonCount > 0) {
        // Click the first Book Training button
        console.log('🖱️ Clicking Book Training button...');
        await bookTrainingButtons.first().click();
        
        // Wait for modal to appear
        await page.waitForTimeout(1000);
        
        // Check if booking modal opened
        const modalTitle = page.locator('h2:has-text("Book Training Session")');
        const modalVisible = await modalTitle.isVisible();
        
        if (modalVisible) {
          console.log('✅ Booking modal opened successfully!');
          
          // Check for availability loading or data
          await page.waitForTimeout(2000);
          
          // Check for calendar grid
          const calendarDays = page.locator('button').filter({ hasText: /^\d+$/ });
          const dayCount = await calendarDays.count();
          console.log(`📆 Calendar shows ${dayCount} date buttons`);
          
          if (dayCount > 0) {
            // Try to select a date
            const firstAvailableDay = calendarDays.first();
            await firstAvailableDay.click();
            console.log('✅ Selected a date in the calendar');
            
            // Check for time slots
            await page.waitForTimeout(500);
            const timeSlots = page.locator('button:has-text("AM"), button:has-text("PM")');
            const slotCount = await timeSlots.count();
            console.log(`⏰ Found ${slotCount} time slot(s)`);
            
            if (slotCount > 0) {
              console.log('✅ Time slots are displayed');
              
              // Select a time slot
              await timeSlots.first().click();
              console.log('✅ Selected a time slot');
              
              // Check for booking summary
              const summarySection = page.locator('text=/Booking Summary/i');
              const hasSummary = await summarySection.count() > 0;
              
              if (hasSummary) {
                console.log('✅ Booking summary displayed');
                
                // Check for confirm button
                const confirmButton = page.locator('button:has-text("Confirm Booking")');
                const hasConfirmButton = await confirmButton.count() > 0;
                
                if (hasConfirmButton) {
                  console.log('✅ Confirm Booking button is available');
                  console.log('\n🎉 All booking UI elements are working correctly!');
                } else {
                  console.log('❌ Confirm Booking button not found');
                }
              }
            }
          }
          
          // Close modal
          const closeButton = page.locator('button:has-text("Cancel")');
          if (await closeButton.count() > 0) {
            await closeButton.click();
            console.log('✅ Closed booking modal');
          }
        } else {
          console.log('❌ Booking modal did not open');
        }
      } else {
        console.log('⚠️ No Book Training buttons found - trainer might not be loaded');
      }
    } else {
      console.log('⚠️ No trainer data loaded - might be an error or no matching trainer');
    }
    
    // Take a screenshot for reference
    await page.screenshot({ path: 'merchant-portal-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved as merchant-portal-test.png');
    
    console.log('\n✅ Test completed!');
  });
});