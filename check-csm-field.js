const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to merchant page...');
    await page.goto('http://localhost:3010/merchant/Nasi-Lemak');
    
    // Wait for the page to load
    await page.waitForTimeout(3000);
    
    // Look for CSM Name BO field
    console.log('\nSearching for CSM Name BO field...');
    
    // Try multiple selectors
    const selectors = [
      'text="CSM Name BO"',
      'text="CSM NAME BO"',
      ':has-text("CSM Name BO")',
      'div:has-text("CSM Name BO")'
    ];
    
    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`✓ Found CSM Name BO label using selector: ${selector}`);
          
          // Get the parent container and find the value
          const parent = element.locator('xpath=..');
          const valueElement = parent.locator('div').last();
          const value = await valueElement.textContent();
          
          console.log(`CSM Name BO value: "${value}"`);
          
          // Also try to get the next sibling
          const nextSibling = element.locator('xpath=following-sibling::div').first();
          if (await nextSibling.count() > 0) {
            const siblingValue = await nextSibling.textContent();
            console.log(`Alternative value (sibling): "${siblingValue}"`);
          }
          
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'csm-field-check.png', fullPage: true });
    console.log('\nScreenshot saved as csm-field-check.png');
    
    // Also check the Training section
    console.log('\nChecking Training section...');
    const trainingSection = await page.locator('text="Training"').first();
    if (await trainingSection.isVisible()) {
      console.log('✓ Found Training section');
      
      // Look for all text containing "CSM"
      const csmElements = await page.locator(':has-text("CSM")').all();
      console.log(`Found ${csmElements.length} elements containing "CSM"`);
      
      for (let i = 0; i < csmElements.length; i++) {
        const text = await csmElements[i].textContent();
        console.log(`  Element ${i + 1}: ${text}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();