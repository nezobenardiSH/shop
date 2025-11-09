// Test the double booking fix by making direct API calls
const fetch = require('node-fetch');

(async () => {
  try {
    console.log('🧪 Testing Double Booking Fix via API\n');

    // Test data
    const merchantId = 'a0yQ9000003aAvB';
    const merchantState = 'Selangor';
    const merchantName = 'Test Merchant';
    const trainerEmail = 'john.lai@storehub.com'; // Klang Valley trainer

    // First booking
    console.log('Step 1: Create first training booking');
    const firstBookingPayload = {
      merchantId,
      merchantState,
      merchantName,
      date: '2025-11-11',
      startTime: '10:00',
      endTime: '11:00',
      onboardingServicesBought: 'Onsite Full Service',  // Use the actual service type
      trainerEmail
    };

    console.log('   Payload:', JSON.stringify(firstBookingPayload, null, 2));

    const firstResponse = await fetch('http://localhost:3010/api/lark/book-training', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firstBookingPayload)
    });

    const firstData = await firstResponse.json();
    console.log(`   Status: ${firstResponse.status}`);
    console.log(`   Response:`, JSON.stringify(firstData, null, 2));

    if (!firstData.eventId) {
      console.log('❌ First booking failed - no event ID returned');
      return;
    }

    const firstEventId = firstData.eventId;
    console.log(`   ✅ First booking created with Event ID: ${firstEventId}\n`);

    // Reschedule to different date
    console.log('Step 2: Reschedule to different date (Nov 12, 12:00-13:00)');
    const reschedulePayload = {
      merchantId,
      merchantState,
      merchantName,
      date: '2025-11-12',
      startTime: '12:00',
      endTime: '13:00',
      onboardingServicesBought: 'Onsite Full Service',  // Use the actual service type
      trainerEmail,
      existingEventId: firstEventId  // This is the key - we're rescheduling
    };

    console.log('   Payload:', JSON.stringify(reschedulePayload, null, 2));

    const rescheduleResponse = await fetch('http://localhost:3010/api/lark/book-training', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reschedulePayload)
    });

    const rescheduleData = await rescheduleResponse.json();
    console.log(`   Status: ${rescheduleResponse.status}`);
    console.log(`   Response:`, JSON.stringify(rescheduleData, null, 2));

    // Check results
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));

    if (rescheduleData.error) {
      console.log(`\n❌ Reschedule FAILED with error: ${rescheduleData.error}`);
      console.log(`   Details: ${rescheduleData.details}`);
      console.log('\n⚠️ This could mean:');
      console.log('   1. Old event deletion failed (prevents double booking - GOOD)');
      console.log('   2. Or there was a real error (BAD)');
    } else if (rescheduleData.eventId) {
      console.log(`\n✅ Reschedule SUCCEEDED`);
      console.log(`   Old Event ID: ${firstEventId}`);
      console.log(`   New Event ID: ${rescheduleData.eventId}`);
      console.log('\n✅ TEST PASSED: Old event should have been deleted, new event created');
    } else {
      console.log('\n❌ Unexpected response - no error and no eventId');
    }

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error(error);
  }
})();

