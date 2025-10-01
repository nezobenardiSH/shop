import { test, expect } from '@playwright/test';

test('Debug trainer loading issue', async ({ page }) => {
  // Navigate to the trainer portal
  await page.goto('http://localhost:3010/merchant/Nasi-Lemak');
  
  // Wait for the page to load
  await expect(page.locator('h1')).toContainText('Trainer Portal');
  
  // Check that the trainer name is displayed correctly
  await expect(page.locator('text=Trainer: Nasi-Lemak')).toBeVisible();
  
  // Click the load button
  await page.click('button:has-text("Load Trainer Data")');
  
  // Wait for the response
  await page.waitForTimeout(3000);
  
  // Check if we get success or error
  const successMessage = page.locator('.bg-green-50');
  const errorMessage = page.locator('.bg-red-50');
  
  if (await successMessage.isVisible()) {
    console.log('✅ SUCCESS: Trainer data loaded successfully');
    
    // Check for account data
    const accountSection = page.locator('text=Account Information');
    if (await accountSection.isVisible()) {
      console.log('✅ Account section is visible');
      
      // Get account name
      const accountName = await page.locator('h4').first().textContent();
      console.log('Account name:', accountName);
    }
    
    // Check for trainer data
    const trainerSection = page.locator('text=Onboarding Trainer');
    if (await trainerSection.isVisible()) {
      console.log('✅ Trainer section is visible');
    }
    
  } else if (await errorMessage.isVisible()) {
    console.log('❌ ERROR: Failed to load trainer data');
    
    // Get the error message
    const errorText = await errorMessage.textContent();
    console.log('Error message:', errorText);
    
    // Check debug information
    const debugSection = page.locator('text=Debug Information');
    if (await debugSection.isVisible()) {
      console.log('🔍 Debug information found');
      
      // Get searched variations
      const searchedFor = await page.locator('text=Searched for:').textContent();
      console.log('Searched for:', searchedFor);
      
      // Get available trainers
      const availableTrainers = page.locator('text=Available trainer names:');
      if (await availableTrainers.isVisible()) {
        const trainerList = await page.locator('.bg-gray-100').textContent();
        console.log('Available trainers:', trainerList);
      }
      
      // Get total count
      const totalCount = await page.locator('text=Total trainers in system:').textContent();
      console.log('Total trainers:', totalCount);
    }
  }
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'debug-trainer-issue.png', fullPage: true });
  console.log('📸 Screenshot saved as debug-trainer-issue.png');
});

test('Test direct API call', async ({ request }) => {
  console.log('🔍 Testing direct API call...');
  
  // Test the API endpoint directly
  const response = await request.get('http://localhost:3010/api/salesforce/merchant/Nasi-Lemak');
  const data = await response.json();
  
  console.log('API Response Status:', response.status());
  console.log('API Response Data:', JSON.stringify(data, null, 2));
  
  if (data.success) {
    console.log('✅ API call successful');
    console.log('Trainer found:', data.onboardingTrainerData?.trainers?.[0]?.name);
    console.log('Account found:', data.account?.name);
  } else {
    console.log('❌ API call failed');
    console.log('Error:', data.message);
    console.log('Available trainers:', data.availableTrainers);
  }
});

test('Test different URL variations', async ({ request }) => {
  console.log('🔍 Testing different URL variations...');
  
  const variations = [
    'Nasi-Lemak',
    'Nasi%20Lemak',
    'Nasi+Lemak',
    'nasi-lemak',
    'nasi%20lemak'
  ];
  
  for (const variation of variations) {
    console.log(`\n--- Testing: ${variation} ---`);
    
    try {
      const response = await request.get(`http://localhost:3010/api/salesforce/merchant/${variation}`);
      const data = await response.json();
      
      console.log(`Status: ${response.status()}`);
      console.log(`Success: ${data.success}`);
      
      if (data.success) {
        console.log(`✅ FOUND with variation: ${variation}`);
        console.log(`Trainer: ${data.onboardingTrainerData?.trainers?.[0]?.name}`);
        break;
      } else {
        console.log(`❌ Not found with: ${variation}`);
        if (data.availableTrainers) {
          console.log(`Available: ${data.availableTrainers.join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`Error with ${variation}:`, error);
    }
  }
});
