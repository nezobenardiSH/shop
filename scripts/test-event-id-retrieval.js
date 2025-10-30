/**
 * Test script to verify event IDs are being properly saved and retrieved
 * After Salesforce field expansion to Text(100)
 */

async function testEventIdRetrieval() {
  const merchantId = 'a0yQ9000003aAvBIAU'; // activate175 test merchant
  
  console.log('🔍 Testing Event ID retrieval for merchant:', merchantId);
  console.log('📋 Fetching merchant data from API...\n');
  
  try {
    const response = await fetch(`http://localhost:3010/api/salesforce/merchant/${merchantId}`);
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.onboardingTrainerData && data.onboardingTrainerData.trainers && data.onboardingTrainerData.trainers[0]) {
      const trainer = data.onboardingTrainerData.trainers[0];
      
      console.log('✅ Merchant data retrieved successfully!\n');
      console.log('📊 Event ID Information:');
      console.log('────────────────────────────────────────');
      
      // Installation Event ID
      if (trainer.installationEventId) {
        console.log('🔧 Installation Event ID:');
        console.log(`   Value: ${trainer.installationEventId}`);
        console.log(`   Length: ${trainer.installationEventId.length} characters`);
        console.log(`   Status: ✅ Present`);
      } else {
        console.log('🔧 Installation Event ID: ❌ Not set (null)');
      }
      
      console.log('');
      
      // Training Event ID  
      if (trainer.trainingEventId) {
        console.log('📚 Training Event ID:');
        console.log(`   Value: ${trainer.trainingEventId}`);
        console.log(`   Length: ${trainer.trainingEventId.length} characters`);
        console.log(`   Status: ✅ Present`);
      } else {
        console.log('📚 Training Event ID: ❌ Not set (null)');
      }
      
      console.log('\n📅 Related Dates:');
      console.log('────────────────────────────────────────');
      
      if (trainer.installationDate) {
        console.log(`🔧 Installation Date: ${trainer.installationDate}`);
      }
      
      if (trainer.trainingDate) {
        console.log(`📚 Training Date: ${trainer.trainingDate}`);
      }
      
      console.log('\n📋 Summary:');
      console.log('────────────────────────────────────────');
      
      const hasInstallationEventId = !!trainer.installationEventId;
      const hasTrainingEventId = !!trainer.trainingEventId;
      
      if (hasInstallationEventId || hasTrainingEventId) {
        console.log('✅ Event IDs are being retrieved successfully!');
        console.log('✅ Salesforce field expansion to Text(100) is working!');
        
        if (hasInstallationEventId && hasTrainingEventId) {
          console.log('✅ Both Installation and Training Event IDs are present');
        } else if (hasInstallationEventId) {
          console.log('⚠️ Only Installation Event ID is present');
        } else {
          console.log('⚠️ Only Training Event ID is present');
        }
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Test rescheduling to verify old events are deleted');
        console.log('2. Monitor for any duplicate calendar events');
      } else {
        console.log('❌ No Event IDs found');
        console.log('\n🔍 Possible reasons:');
        console.log('1. No bookings have been made yet for this merchant');
        console.log('2. Bookings were made before the Salesforce field update');
        console.log('3. Event IDs are not being saved properly');
        console.log('\n💡 Try making a new booking and run this test again');
      }
      
    } else {
      console.log('❌ No trainer data found in response');
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
testEventIdRetrieval();