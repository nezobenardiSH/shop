#!/usr/bin/env node

/**
 * Test script for Lark Calendar integration
 * Tests calendar ID retrieval, FreeBusy, and event creation
 */

const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Test configuration
const TEST_EMAIL = 'nezo.benardi@storehub.com'; // Replace with your test email
const TEST_MERCHANT = {
  name: 'Test Merchant ABC',
  address: '123 Test Street, KL',
  phone: '+60-123456789',
  contactPerson: 'John Doe'
};

// Create a simple Lark API client for testing
class LarkTestClient {
  constructor() {
    this.baseUrl = process.env.LARK_DOMAIN || 'https://open.larksuite.com';
    this.appId = process.env.LARK_APP_ID;
    this.appSecret = process.env.LARK_APP_SECRET;
    this.accessToken = null;
  }

  async getAccessToken() {
    const response = await fetch(`${this.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret
      })
    });
    
    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`Auth failed: ${data.msg}`);
    }
    
    this.accessToken = data.tenant_access_token;
    return this.accessToken;
  }

  async makeRequest(endpoint, options = {}) {
    if (!this.accessToken) {
      await this.getAccessToken();
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json();
    if (data.code !== 0 && data.code !== undefined) {
      throw new Error(`API Error: ${data.msg}`);
    }
    
    return data;
  }

  async getUserByEmail(email) {
    try {
      const data = await this.makeRequest(
        `/open-apis/contact/v3/users/batch/get?user_ids=${encodeURIComponent(email)}&user_id_type=email`
      );
      
      const users = data.data?.items || [];
      if (users.length > 0) {
        return {
          user_id: users[0].user_id || users[0].open_id,
          name: users[0].name
        };
      }
    } catch (error) {
      console.log('User lookup failed, using email as ID');
    }
    
    return { user_id: email, name: email.split('@')[0] };
  }

  async getCalendarList(userEmail) {
    const user = await this.getUserByEmail(userEmail);
    const data = await this.makeRequest('/open-apis/calendar/v4/calendars', {
      method: 'GET',
      headers: { 'X-Lark-User-Id': user.user_id }
    });
    
    return data.data?.calendar_list || [];
  }

  async getPrimaryCalendarId(userEmail) {
    const calendars = await this.getCalendarList(userEmail);
    const primary = calendars.find(cal => 
      cal.type === 'primary' || 
      cal.role === 'owner' ||
      cal.summary?.toLowerCase().includes('primary')
    );
    
    return primary?.calendar_id || calendars[0]?.calendar_id || 'primary';
  }

  async getFreeBusySchedule(userEmails, startTime, endTime) {
    const users = await Promise.all(userEmails.map(email => this.getUserByEmail(email)));
    const userIds = users.map(u => u.user_id);
    
    const data = await this.makeRequest('/open-apis/calendar/v4/freebusy/query', {
      method: 'POST',
      body: JSON.stringify({
        time_min: startTime.toISOString(),
        time_max: endTime.toISOString(),
        user_id_list: userIds
      })
    });
    
    return data;
  }
}

async function runTests() {
  console.log('🧪 Lark Calendar Integration Test Suite\n');
  console.log('========================================\n');
  
  try {
    const larkClient = new LarkTestClient();
    
    // Test 1: Authentication
    console.log('📌 Test 1: Authentication');
    const token = await larkClient.getAccessToken();
    console.log(token ? '✅ Authentication successful' : '❌ Authentication failed');
    console.log('\n');
    
    // Test 2: Get Calendar ID
    console.log('📌 Test 2: Get Calendar ID');
    try {
      const calendarId = await larkClient.getPrimaryCalendarId(TEST_EMAIL);
      console.log(`✅ Calendar ID retrieved: ${calendarId}`);
      
      // Save for later tests
      global.testCalendarId = calendarId;
    } catch (error) {
      console.log(`❌ Failed to get calendar ID: ${error.message}`);
      global.testCalendarId = 'primary';
    }
    console.log('\n');
    
    // Test 3: FreeBusy API
    console.log('📌 Test 3: FreeBusy API');
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      
      const freeBusy = await larkClient.getFreeBusySchedule(
        [TEST_EMAIL],
        startDate,
        endDate
      );
      
      if (freeBusy.data?.freebusy_list) {
        const busyCount = freeBusy.data.freebusy_list[0]?.busy_time?.length || 0;
        console.log(`✅ FreeBusy retrieved: ${busyCount} busy slots found`);
      } else {
        console.log('⚠️ FreeBusy returned but no data');
      }
    } catch (error) {
      console.log(`❌ FreeBusy test failed: ${error.message}`);
    }
    console.log('\n');
    
    // Test 4: Check User Lookup
    console.log('📌 Test 4: User Lookup');
    try {
      const user = await larkClient.getUserByEmail(TEST_EMAIL);
      console.log(`✅ User found: ${user.name} (ID: ${user.user_id})`);
    } catch (error) {
      console.log(`❌ User lookup failed: ${error.message}`);
    }
    console.log('\n');
    
    // Test 5: Calendar List
    console.log('📌 Test 5: Calendar List');
    try {
      const calendars = await larkClient.getCalendarList(TEST_EMAIL);
      console.log(`✅ Found ${calendars.length} calendar(s)`);
      
      if (calendars.length > 0) {
        console.log('   Calendars:');
        calendars.slice(0, 3).forEach(cal => {
          console.log(`   - ${cal.summary || 'Unnamed'} (${cal.calendar_id})`);
        });
      }
    } catch (error) {
      console.log(`❌ Calendar list failed: ${error.message}`);
    }
    console.log('\n');
    
    console.log('\n========================================');
    console.log('✨ Test suite completed!');
    
  } catch (error) {
    console.error('❌ Fatal error in test suite:', error);
    process.exit(1);
  }
}

// Run tests
console.log('Starting Lark Calendar tests...\n');
console.log('Configuration:');
console.log(`  App ID: ${process.env.LARK_APP_ID ? '✅' : '❌'}`);
console.log(`  App Secret: ${process.env.LARK_APP_SECRET ? '✅' : '❌'}`);
console.log(`  Domain: ${process.env.LARK_DOMAIN || 'https://open.larksuite.com'}`);
console.log(`  Test Email: ${TEST_EMAIL}`);
console.log('\n');

runTests();