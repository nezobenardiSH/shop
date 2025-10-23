import { test, expect } from '@playwright/test';

test.describe('Training Booking Flow', () => {
  test('should successfully book a training session', async ({ page, request }) => {
    console.log('🔍 Testing training booking flow...\n');
    
    // Step 1: Check current auth status
    console.log('Step 1: Checking OAuth tokens in database...');
    const authCheck = await request.get('http://localhost:3010/api/lark/auth/check-tokens');
    const authData = await authCheck.json();
    console.log('Auth tokens found:', authData);
    
    // Step 2: Prepare booking data
    const bookingData = {
      merchantId: 'test_' + Date.now(),
      merchantName: 'Test Merchant',
      merchantAddress: '123 Test Street, Kuala Lumpur',
      merchantPhone: '+60123456789',
      merchantContactPerson: 'Test Person',
      merchantBusinessType: 'Restaurant',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
      startTime: '10:00',
      endTime: '11:00',
      bookingType: 'training',
      trainerLanguages: ['English'],
      onboardingServicesBought: 'POS System',
      onboardingTrainerName: 'Test Merchant'
    };
    
    console.log('\nStep 2: Booking data:', bookingData);
    
    // Step 3: Make booking request
    console.log('\nStep 3: Making booking request...');
    const response = await request.post('http://localhost:3010/api/lark/book-training', {
      data: bookingData,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = await response.json();
    console.log('Response status:', response.status());
    console.log('Response data:', responseData);
    
    // Step 4: Check the response
    if (response.status() === 500) {
      console.log('\n❌ Booking failed with error:', responseData.error);
      console.log('Details:', responseData.details);
      
      // Debug: Check what's happening in the backend
      console.log('\n🔍 Debugging backend issue...');
      
      // Check trainer availability
      const availabilityResponse = await request.post('http://localhost:3010/api/trainers/availability', {
        data: {
          startDate: bookingData.date,
          endDate: bookingData.date
        }
      });
      
      const availability = await availabilityResponse.json();
      console.log('Trainer availability:', availability);
      
      // Get more detailed error info
      const logs = await request.get('http://localhost:3010/api/debug/last-error');
      const errorDetails = await logs.json();
      console.log('Last error details:', errorDetails);
      
      throw new Error(`Booking failed: ${responseData.error}`);
    }
    
    // Step 5: Verify success
    expect(response.status()).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.eventId).toBeTruthy();
    console.log('\n✅ Booking successful!');
    console.log('Event ID:', responseData.eventId);
    console.log('Assigned trainer:', responseData.assignedTrainer);
  });
  
  test('should handle calendar permission issues gracefully', async ({ request }) => {
    console.log('🔍 Testing calendar permission handling...\n');
    
    // Test with mock mode to bypass calendar issues
    const bookingData = {
      merchantId: 'test_mock_' + Date.now(),
      merchantName: 'Mock Test Merchant',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      startTime: '14:00',
      endTime: '15:00',
      bookingType: 'training',
      merchantAddress: 'Test Address',
      merchantPhone: '0123456789',
      merchantContactPerson: 'Test Contact'
    };
    
    // Add mock parameter
    const response = await request.post('http://localhost:3010/api/lark/book-training?mock=true', {
      data: bookingData
    });
    
    const responseData = await response.json();
    console.log('Mock mode response:', responseData);
    
    expect(response.status()).toBe(200);
    expect(responseData.eventId).toContain('mock-event');
    console.log('✅ Mock mode booking works');
  });
});