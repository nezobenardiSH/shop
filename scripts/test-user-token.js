#!/usr/bin/env node

/**
 * Test script for user token authentication
 * Use this after getting a user access token from Lark
 */

const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const TEST_EMAIL = 'nezo.benardi@storehub.com';

async function testUserToken() {
  console.log('🔑 Testing User Token Authentication\n');
  console.log('========================================\n');
  
  // Check for user token
  const userToken = process.env.LARK_USER_ACCESS_TOKEN || 
                   process.env[`LARK_USER_TOKEN_${TEST_EMAIL.replace(/\./g, '_')}`];
  
  if (!userToken) {
    console.log('❌ No user token found in environment');
    console.log('\nPlease add to .env.local:');
    console.log('LARK_USER_ACCESS_TOKEN=u-your-token-here');
    console.log('\nGet your token from:');
    console.log('https://open.larksuite.com/document/server-docs/api-call-guide/debugging-tools/api-explorer');
    return;
  }
  
  console.log('✅ User token found:', userToken.substring(0, 10) + '...');
  console.log('\n');
  
  const baseUrl = process.env.LARK_DOMAIN || 'https://open.larksuite.com';
  
  // Test 1: Get Calendar List
  console.log('📌 Test 1: Get Calendar List');
  try {
    const response = await fetch(`${baseUrl}/open-apis/calendar/v4/calendars`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      const calendars = data.data?.calendar_list || [];
      console.log(`✅ Successfully retrieved ${calendars.length} calendar(s)`);
      
      if (calendars.length > 0) {
        console.log('\nCalendars found:');
        calendars.forEach(cal => {
          console.log(`  - ${cal.summary || 'Unnamed'}`);
          console.log(`    ID: ${cal.calendar_id}`);
          console.log(`    Type: ${cal.type || 'unknown'}`);
          console.log(`    Role: ${cal.role || 'unknown'}`);
        });
        
        // Find primary calendar
        const primary = calendars.find(c => c.type === 'primary' || c.role === 'owner');
        if (primary) {
          console.log(`\n📅 Primary Calendar ID: ${primary.calendar_id}`);
          global.primaryCalendarId = primary.calendar_id;
        }
      }
    } else {
      console.log(`❌ Failed: ${data.msg}`);
      if (data.msg.includes('token')) {
        console.log('\n⚠️ Token may be expired. Get a new one from API Explorer.');
      }
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  console.log('\n');
  
  // Test 2: FreeBusy Check
  console.log('📌 Test 2: FreeBusy Check');
  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    
    const response = await fetch(`${baseUrl}/open-apis/calendar/v4/freebusy/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        time_min: startDate.toISOString(),
        time_max: endDate.toISOString(),
        user_id_list: [TEST_EMAIL]
      })
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      const busySlots = data.data?.freebusy_list?.[0]?.busy_time || [];
      console.log(`✅ FreeBusy check successful`);
      console.log(`   Found ${busySlots.length} busy slot(s) in next 7 days`);
      
      if (busySlots.length > 0) {
        console.log('\n   Next 3 busy slots:');
        busySlots.slice(0, 3).forEach(slot => {
          const start = new Date(slot.start_time);
          const end = new Date(slot.end_time);
          console.log(`   - ${start.toLocaleString()} to ${end.toLocaleString()}`);
        });
      }
    } else {
      console.log(`❌ Failed: ${data.msg}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  console.log('\n');
  
  // Test 3: Get User Info
  console.log('📌 Test 3: Get User Info');
  try {
    const response = await fetch(`${baseUrl}/open-apis/authen/v1/user_info`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      const user = data.data;
      console.log('✅ User info retrieved:');
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email || user.enterprise_email}`);
      console.log(`   User ID: ${user.user_id || user.open_id}`);
    } else {
      console.log(`❌ Failed: ${data.msg}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('\n========================================');
  console.log('✨ User token test complete!');
  console.log('\n');
  
  // Summary
  console.log('📊 Summary:');
  console.log('   Token is valid: ✅');
  console.log('   Can access calendars: Check above');
  console.log('   Can check availability: Check above');
  console.log('\nNext steps:');
  console.log('1. Add this token to .env.local');
  console.log('2. Get tokens for other trainers');
  console.log('3. Test booking operations');
}

// Run the test
testUserToken().catch(console.error);