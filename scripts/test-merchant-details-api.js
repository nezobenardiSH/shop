/**
 * Test script to verify merchant details API returns all expected fields
 */

async function testMerchantDetailsAPI() {
  const merchantId = 'a0yQ9000003aAvBIAU'; // activate175 test merchant
  
  console.log('🔍 Testing Merchant Details API');
  console.log(`📋 Merchant ID: ${merchantId}\n`);
  console.log('=' . repeat(50));
  
  try {
    const response = await fetch(`http://localhost:3010/api/salesforce/merchant/${merchantId}`);
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success === false) {
      console.error('❌ API returned error:', data.message);
      return;
    }
    
    console.log('✅ API Response received successfully\n');
    
    // Check for key fields that were missing
    const trainer = data.onboardingTrainerData?.trainers?.[0];
    
    if (!trainer) {
      console.error('❌ No trainer data found in response');
      return;
    }
    
    console.log('📊 Key Fields Check:');
    console.log('-'.repeat(50));
    
    const fieldsToCheck = [
      { field: 'onboardingServicesBought', label: 'Onboarding Services Bought' },
      { field: 'shippingStreet', label: 'Shipping Street' },
      { field: 'shippingCity', label: 'Shipping City' },
      { field: 'shippingState', label: 'Shipping State' },
      { field: 'shippingCountry', label: 'Shipping Country' },
      { field: 'subIndustry', label: 'Sub Industry' },
      { field: 'preferredLanguage', label: 'Preferred Language' },
      { field: 'requiredFeaturesByMerchant', label: 'Required Features' },
      { field: 'syncedQuoteTotalAmount', label: 'Synced Quote Total Amount' },
      { field: 'pendingPayment', label: 'Pending Payment' },
      { field: 'productSetupStatus', label: 'Product Setup Status' },
      { field: 'hardwareDeliveryStatus', label: 'Hardware Delivery Status' },
      { field: 'trainingStatus', label: 'Training Status' }
    ];
    
    let missingCount = 0;
    let presentCount = 0;
    
    fieldsToCheck.forEach(({ field, label }) => {
      const value = trainer[field];
      const status = value !== undefined && value !== null;
      
      if (status) {
        presentCount++;
        console.log(`✅ ${label}: "${value || 'empty string'}"`);
      } else {
        missingCount++;
        console.log(`❌ ${label}: NOT FOUND (undefined)`);
      }
    });
    
    console.log('\n' + '=' . repeat(50));
    console.log('\n📈 Summary:');
    console.log(`  Total fields checked: ${fieldsToCheck.length}`);
    console.log(`  ✅ Present: ${presentCount}`);
    console.log(`  ❌ Missing: ${missingCount}`);
    
    if (missingCount === 0) {
      console.log('\n🎉 All fields are now being returned correctly!');
    } else {
      console.log('\n⚠️ Some fields are still missing from the API response.');
      console.log('Please check if these fields exist in Salesforce.');
    }
    
    // Show address formatting
    if (trainer.shippingStreet || trainer.shippingCity || trainer.shippingState || trainer.shippingCountry) {
      console.log('\n📍 Formatted Address:');
      const addressParts = [
        trainer.shippingStreet,
        trainer.shippingCity,
        trainer.shippingState && trainer.shippingZipPostalCode 
          ? `${trainer.shippingState} ${trainer.shippingZipPostalCode}`
          : trainer.shippingState || trainer.shippingZipPostalCode,
        trainer.shippingCountry
      ].filter(Boolean);
      console.log('  ' + (addressParts.join(', ') || 'N/A'));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('1. The development server is running (npm run dev)');
    console.log('2. The API is accessible at http://localhost:3010');
    console.log('3. You have proper Salesforce credentials configured');
  }
}

// Run the test
testMerchantDetailsAPI();