const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting Merchant Portal test...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the merchant page
    await page.goto('http://localhost:3010/merchant/Nasi-Lemak');
    console.log('✅ Navigated to /merchant/Nasi-Lemak');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check page title
    const title = await page.locator('h1').textContent();
    console.log(`📋 Page title: ${title}`);
    
    // Check trainer name display
    const trainerInfo = await page.locator('p:has-text("Trainer:")').textContent();
    console.log(`👤 Trainer info: ${trainerInfo}`);
    
    // Click Load Trainer Data button
    console.log('\n🔄 Loading trainer data...');
    const loadButton = page.locator('button:has-text("Load Trainer Data")');
    await loadButton.click();
    
    // Wait for data to load
    await page.waitForTimeout(3000);
    
    // Check for success or error message
    const messageBox = await page.locator('.bg-green-50, .bg-red-50').first();
    const hasMessage = await messageBox.count();
    
    if (hasMessage > 0) {
      const message = await messageBox.textContent();
      console.log(`📨 Response message: ${message?.substring(0, 100)}...`);
    }
    
    // Check if trainer data loaded
    const trainerDataSection = await page.locator('text=/Onboarding Trainer/i').count();
    
    if (trainerDataSection > 0) {
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
            const availableDays = await calendarDays.all();
            for (let i = 0; i < Math.min(5, availableDays.length); i++) {
              const dayButton = availableDays[i];
              const isDisabled = await dayButton.isDisabled();
              if (!isDisabled) {
                await dayButton.click();
                console.log('✅ Selected an available date in the calendar');
                break;
              }
            }
            
            // Check for time slots
            await page.waitForTimeout(500);
            const timeSlots = page.locator('button:has-text("AM"), button:has-text("PM")');
            const slotCount = await timeSlots.count();
            console.log(`⏰ Found ${slotCount} time slot(s)`);
            
            if (slotCount > 0) {
              console.log('✅ Time slots are displayed');
              
              // Select first available time slot
              const slots = await timeSlots.all();
              for (const slot of slots) {
                const isDisabled = await slot.isDisabled();
                if (!isDisabled) {
                  await slot.click();
                  console.log('✅ Selected an available time slot');
                  break;
                }
              }
              
              // Check for booking summary
              await page.waitForTimeout(500);
              const summarySection = await page.locator('text=/Booking Summary/i').count();
              
              if (summarySection > 0) {
                console.log('✅ Booking summary displayed');
                
                // Check for confirm button
                const confirmButton = await page.locator('button:has-text("Confirm Booking")').count();
                
                if (confirmButton > 0) {
                  console.log('✅ Confirm Booking button is available');
                  console.log('\n🎉 All booking UI elements are working correctly!');
                } else {
                  console.log('❌ Confirm Booking button not found');
                }
              }
            }
          } else {
            console.log('⚠️ No calendar days found - checking for error message...');
            const errorMessage = await page.locator('.text-red-800').textContent();
            if (errorMessage) {
              console.log(`❌ Error in modal: ${errorMessage}`);
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
        console.log('⚠️ No Book Training buttons found - checking trainer data...');
        
        // Check what's actually on the page
        const pageContent = await page.locator('.bg-green-50, .bg-yellow-50, .bg-red-50').allTextContents();
        console.log('Page messages:', pageContent.slice(0, 3));
      }
    } else {
      console.log('⚠️ No trainer data loaded - checking for error messages...');
      const errorContent = await page.locator('.bg-red-50').textContent();
      if (errorContent) {
        console.log(`Error message: ${errorContent}`);
      }
    }
    
    // Take a screenshot for reference
    await page.screenshot({ path: 'merchant-portal-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved as merchant-portal-test.png');
    
    console.log('\n✅ Test completed!');
    
    // Keep browser open for 5 seconds to see the result
    console.log('Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    await page.screenshot({ path: 'merchant-portal-error.png', fullPage: true });
    console.log('📸 Error screenshot saved as merchant-portal-error.png');
  } finally {
    await browser.close();
  }
})();