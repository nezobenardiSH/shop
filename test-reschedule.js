const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.createContext();
  const page = await context.newPage();

  try {
    console.log('🧪 Testing reschedule - checking if old event is deleted...\n');

    // Navigate to the merchant page
    await page.goto('http://localhost:3010/merchant/a0yQ9000003aAvB?stage=training&booking=training', {
      waitUntil: 'networkidle'
    });

    console.log('✅ Page loaded');

    // Wait for the modal to be visible
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    console.log('✅ Modal visible');

    // Get initial calendar events count from Lark
    const getEventsCount = async () => {
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/lark/get-events');
        return res.json();
      });
      return response.events ? response.events.length : 0;
    };

    const initialCount = await getEventsCount();
    console.log(`📊 Initial events count: ${initialCount}`);

    // Select a date (e.g., Nov 12)
    const dateButtons = await page.locator('button').filter({ hasText: /^12$/ });
    if (await dateButtons.count() > 0) {
      await dateButtons.first().click();
      console.log('✅ Selected date: Nov 12');
      await page.waitForTimeout(1000);
    }

    // Select a time slot
    const timeSlots = await page.locator('button').filter({ hasText: /10:00|12:00|14:30|17:00/ });
    if (await timeSlots.count() > 0) {
      await timeSlots.first().click();
      console.log('✅ Selected time slot');
      await page.waitForTimeout(1000);
    }

    // Click Book button
    const bookButton = await page.locator('button').filter({ hasText: /Book|Confirm/ });
    if (await bookButton.count() > 0) {
      await bookButton.first().click();
      console.log('✅ Clicked Book button');
      await page.waitForTimeout(3000);
    }

    const afterFirstBooking = await getEventsCount();
    console.log(`📊 Events after first booking: ${afterFirstBooking}`);

    // Now reschedule - select a different date
    const dateButtons2 = await page.locator('button').filter({ hasText: /^13$/ });
    if (await dateButtons2.count() > 0) {
      await dateButtons2.first().click();
      console.log('✅ Selected new date: Nov 13 (for reschedule)');
      await page.waitForTimeout(1000);
    }

    // Select a time slot
    const timeSlots2 = await page.locator('button').filter({ hasText: /10:00|12:00|14:30|17:00/ });
    if (await timeSlots2.count() > 0) {
      await timeSlots2.first().click();
      console.log('✅ Selected new time slot');
      await page.waitForTimeout(1000);
    }

    // Click Book button again (should reschedule)
    const bookButton2 = await page.locator('button').filter({ hasText: /Book|Confirm/ });
    if (await bookButton2.count() > 0) {
      await bookButton2.first().click();
      console.log('✅ Clicked Book button for reschedule');
      await page.waitForTimeout(3000);
    }

    const afterReschedule = await getEventsCount();
    console.log(`📊 Events after reschedule: ${afterReschedule}`);

    // Check if old event was deleted
    if (afterReschedule === afterFirstBooking) {
      console.log('✅ OLD EVENT WAS DELETED - Event count stayed the same');
    } else if (afterReschedule > afterFirstBooking) {
      console.log('❌ OLD EVENT WAS NOT DELETED - Event count increased (double booking)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();

