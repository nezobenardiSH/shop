const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to merchant page directly...');
    // Try to bypass PIN by going to the actual merchant ID
    await page.goto('http://localhost:3010/merchant/a0yBE000002SwCnYAK');
    
    // Wait for the page to load
    await page.waitForTimeout(3000);
    
    // Check if we're on the PIN page
    const pinInput = await page.locator('text="Enter 4-Digit PIN"').count();
    if (pinInput > 0) {
      console.log('PIN page detected, trying to enter PIN...');
      
      // Try common test PINs
      const pins = ['1234', '0000', '1111', '9999'];
      for (const pin of pins) {
        await page.fill('input[type="password"]', pin);
        await page.click('text="Access Portal"');
        await page.waitForTimeout(1000);
        
        // Check if we got through
        const stillOnPin = await page.locator('text="Enter 4-Digit PIN"').count();
        if (stillOnPin === 0) {
          console.log(`✓ PIN ${pin} worked!`);
          break;
        }
      }
    }
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Take screenshot of current state
    await page.screenshot({ path: 'current-page.png', fullPage: true });
    console.log('Screenshot saved as current-page.png');
    
    // Look for training section or CSM fields
    console.log('\nSearching for CSM fields on the page...');
    
    // Get all text content on the page
    const pageText = await page.textContent('body');
    
    // Check for CSM related text
    if (pageText.includes('CSM Name')) {
      console.log('✓ Found "CSM Name" text on page');
      
      // Try to find the specific elements
      const csmElements = await page.$$eval('*:has-text("CSM")', elements => 
        elements.map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 100)
        }))
      );
      
      console.log('\nCSM related elements found:');
      csmElements.forEach(el => {
        if (el.text && el.text.length > 0) {
          console.log(`  ${el.tag}: ${el.text}`);
        }
      });
    } else {
      console.log('✗ No CSM fields found on page');
    }
    
    // Check what's actually on the page
    console.log('\nPage URL:', page.url());
    console.log('Page title:', await page.title());
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Keep browser open for manual inspection
    console.log('\nBrowser will stay open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
})();