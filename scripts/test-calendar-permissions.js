#!/usr/bin/env node

const fetch = require('node-fetch');

async function testCalendarPermissions() {
  console.log('🔍 Testing Lark Calendar Permissions\n');
  console.log('===================================\n');

  const APP_ID = 'cli_a8549d99f97c502f';
  const APP_SECRET = 'M7Wzk5ZGORiSJJp7xKjxEdzWEOBVtpNT';
  
  try {
    // Step 1: Get app access token
    console.log('1️⃣ Getting app access token...');
    const tokenResponse = await fetch('https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: APP_ID,
        app_secret: APP_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.code !== 0) {
      console.error('❌ Failed to get app token:', tokenData);
      return;
    }
    
    const appToken = tokenData.app_access_token;
    console.log('✅ Got app access token\n');

    // Step 2: Check app permissions
    console.log('2️⃣ Checking app permissions...');
    console.log('\n📋 Required Calendar Permissions:');
    console.log('   • calendar:calendar - Access calendar list');
    console.log('   • calendar:calendar:read_as_user - Read calendar as user');
    console.log('   • calendar:calendar.event:create - Create events');
    console.log('   • calendar:calendar.event:read - Read events');
    console.log('   • calendar:calendar.event:update - Update events');
    console.log('   • calendar:calendar.event:delete - Delete events');
    console.log('   • calendar:calendar.free_busy:read - Read free/busy');

    console.log('\n⚠️  IMPORTANT STEPS TO FIX "no calendar access_role" ERROR:\n');
    console.log('1. Go to https://open.larksuite.com');
    console.log('2. Navigate to your app: "Onboarding Portal"');
    console.log('3. Click on "Permissions & Scopes" in the left sidebar');
    console.log('4. Search for "calendar" in the permissions list');
    console.log('5. Enable ALL of these permissions:');
    console.log('   - View, create, update, and delete calendar information');
    console.log('   - View, edit, and delete calendar events');
    console.log('   - View calendar free/busy information');
    console.log('6. Click "Save" or "Apply" to save the changes');
    console.log('7. You may need to create a new version and release it');
    console.log('\n📌 After enabling permissions in the console:');
    console.log('   1. Re-authorize users at /trainers/authorize');
    console.log('   2. Re-authorize installers at /installers/authorize');

    // Step 3: Try to list calendars with app token (this will likely fail)
    console.log('\n3️⃣ Testing calendar access with app token...');
    const calendarResponse = await fetch('https://open.larksuite.com/open-apis/calendar/v4/calendars', {
      headers: {
        'Authorization': `Bearer ${appToken}`,
      },
    });

    const calendarData = await calendarResponse.json();
    if (calendarData.code === 0) {
      console.log('✅ App can access calendars (unexpected!)');
    } else {
      console.log('⚠️  App token cannot directly access calendars (expected)');
      console.log('   Error:', calendarData.msg);
      if (calendarData.msg.includes('no calendar access_role')) {
        console.log('\n🔴 CALENDAR PERMISSIONS NOT ENABLED IN DEVELOPER CONSOLE');
        console.log('   Please follow the steps above to enable calendar permissions');
      }
    }

    // Step 4: Check if we have any user tokens
    console.log('\n4️⃣ Checking for existing user authorizations...');
    const fs = require('fs');
    const path = require('path');
    
    const trainersPath = path.join(process.cwd(), 'config', 'trainers.json');
    const trainers = JSON.parse(fs.readFileSync(trainersPath, 'utf-8'));
    
    const authorizedTrainers = trainers.trainers.filter(t => t.larkUserId || t.larkOpenId);
    console.log(`   Found ${authorizedTrainers.length} authorized trainers`);
    
    if (authorizedTrainers.length > 0) {
      console.log('   Authorized trainers:', authorizedTrainers.map(t => t.name).join(', '));
    }

    const installersPath = path.join(process.cwd(), 'config', 'installers.json');
    const installers = JSON.parse(fs.readFileSync(installersPath, 'utf-8'));
    
    const authorizedInstallers = installers.internal.installers.filter(i => i.larkUserId || i.larkOpenId);
    console.log(`   Found ${authorizedInstallers.length} authorized installers`);
    
    if (authorizedInstallers.length > 0) {
      console.log('   Authorized installers:', authorizedInstallers.map(i => i.name).join(', '));
    }

  } catch (error) {
    console.error('❌ Error during test:', error.message);
  }
}

testCalendarPermissions();