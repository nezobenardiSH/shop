/**
 * Salesforce to Google Calendar Sync Diagnostic Tool
 *
 * This script helps diagnose why Salesforce Events are not syncing to Google Calendar/Lark.
 *
 * IMPORTANT: This system does NOT have automatic sync built-in.
 * If you're expecting automatic sync, you need:
 * 1. Salesforce Einstein Activity Capture (enterprise feature), OR
 * 2. Custom middleware integration
 *
 * Usage: node scripts/diagnose-salesforce-calendar-sync.js
 */

const jsforce = require('jsforce');

// Configuration
const SF_USERNAME = process.env.SF_USERNAME;
const SF_PASSWORD = process.env.SF_PASSWORD;
const SF_TOKEN = process.env.SF_TOKEN;
const SF_LOGIN_URL = process.env.SF_LOGIN_URL || 'https://test.salesforce.com';

async function main() {
  console.log('🔍 SALESFORCE TO CALENDAR SYNC DIAGNOSTIC\n');
  console.log('=' .repeat(60));

  // Step 1: Check if Einstein Activity Capture is mentioned in Salesforce
  console.log('\n📋 STEP 1: Checking Salesforce Configuration\n');

  try {
    // Connect to Salesforce
    const conn = new jsforce.Connection({ loginUrl: SF_LOGIN_URL });
    await conn.login(SF_USERNAME, SF_PASSWORD + SF_TOKEN);
    console.log('✅ Connected to Salesforce successfully');
    console.log(`   Org ID: ${conn.userInfo.organizationId}`);
    console.log(`   User: ${conn.userInfo.userName}`);

    // Check for Einstein Activity Capture settings
    console.log('\n🔍 Checking for Einstein Activity Capture...');
    try {
      // Query for any Einstein-related settings (this may not work in sandbox)
      const einsteinQuery = `
        SELECT Id, DeveloperName, MasterLabel, Value
        FROM OrganizationSettings
        WHERE DeveloperName LIKE '%Einstein%' OR DeveloperName LIKE '%Activity%'
        LIMIT 10
      `;
      const einsteinResult = await conn.query(einsteinQuery);

      if (einsteinResult.totalSize > 0) {
        console.log('✅ Found Einstein-related settings:');
        einsteinResult.records.forEach(record => {
          console.log(`   - ${record.DeveloperName}: ${record.Value}`);
        });
      } else {
        console.log('⚠️  No Einstein Activity Capture settings found');
        console.log('   This feature may not be enabled or available in your Salesforce org');
      }
    } catch (settingsError) {
      console.log('⚠️  Cannot query OrganizationSettings (expected in some Salesforce editions)');
      console.log('   Message:', settingsError.message);
    }

    // Step 2: Check recent Events in Salesforce
    console.log('\n📋 STEP 2: Checking Recent Salesforce Events\n');

    const eventsQuery = `
      SELECT Id, Subject, StartDateTime, EndDateTime, OwnerId, Owner.Name,
             WhatId, What.Name, Type, Location, Description, CreatedDate
      FROM Event
      WHERE CreatedDate = LAST_N_DAYS:7
      ORDER BY CreatedDate DESC
      LIMIT 10
    `;

    const eventsResult = await conn.query(eventsQuery);

    if (eventsResult.totalSize > 0) {
      console.log(`✅ Found ${eventsResult.totalSize} events in the last 7 days:\n`);

      eventsResult.records.forEach((event, index) => {
        console.log(`${index + 1}. ${event.Subject}`);
        console.log(`   Event ID: ${event.Id}`);
        console.log(`   Type: ${event.Type || 'Not specified'}`);
        console.log(`   Start: ${event.StartDateTime}`);
        console.log(`   Assigned To: ${event.Owner.Name} (${event.OwnerId})`);
        console.log(`   Related To: ${event.What?.Name || 'None'}`);
        console.log(`   Created: ${event.CreatedDate}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No events found in the last 7 days');
      console.log('   This might indicate events are not being created properly');
    }

    // Step 3: Check User's Google Calendar Integration
    console.log('\n📋 STEP 3: Checking User Calendar Integration\n');

    // Get list of users who have events
    const usersWithEventsQuery = `
      SELECT OwnerId, Owner.Name, Owner.Email, COUNT(Id) EventCount
      FROM Event
      WHERE CreatedDate = LAST_N_DAYS:30
      GROUP BY OwnerId, Owner.Name, Owner.Email
      ORDER BY COUNT(Id) DESC
      LIMIT 10
    `;

    const usersResult = await conn.query(usersWithEventsQuery);

    if (usersResult.totalSize > 0) {
      console.log('Users with Events (last 30 days):\n');

      for (const user of usersResult.records) {
        console.log(`👤 ${user.Owner.Name} (${user.Owner.Email})`);
        console.log(`   Salesforce User ID: ${user.OwnerId}`);
        console.log(`   Event Count: ${user.EventCount}`);

        // Check if this user has Google Calendar connected (via Connected Apps)
        // Note: This requires specific permissions and may not be available
        try {
          const userCalendarQuery = `
            SELECT Id, IsGoogleCalendarConnected__c
            FROM User
            WHERE Id = '${user.OwnerId}'
            LIMIT 1
          `;
          const userCalResult = await conn.query(userCalendarQuery);

          if (userCalResult.records.length > 0) {
            const calendarConnected = userCalResult.records[0].IsGoogleCalendarConnected__c;
            console.log(`   Google Calendar: ${calendarConnected ? '✅ Connected' : '❌ Not Connected'}`);
          }
        } catch (err) {
          // Field doesn't exist - expected if no Google integration
          console.log('   Google Calendar: ⚠️  Cannot verify (field not available)');
        }

        console.log('');
      }
    }

    // Step 4: Check for External Calendar Sync Settings
    console.log('\n📋 STEP 4: Checking External Calendar Configuration\n');

    try {
      // Check if there are any connected apps for calendar integration
      const connectedAppsQuery = `
        SELECT Id, Name, Description, CreatedDate
        FROM ConnectedApplication
        WHERE Name LIKE '%Calendar%' OR Name LIKE '%Google%'
        LIMIT 5
      `;
      const appsResult = await conn.query(connectedAppsQuery);

      if (appsResult.totalSize > 0) {
        console.log('✅ Found Calendar-related Connected Apps:');
        appsResult.records.forEach(app => {
          console.log(`   - ${app.Name}`);
          console.log(`     Created: ${app.CreatedDate}`);
          if (app.Description) {
            console.log(`     Description: ${app.Description}`);
          }
        });
      } else {
        console.log('⚠️  No calendar-related Connected Apps found');
        console.log('   External calendar integration may not be configured');
      }
    } catch (appsError) {
      console.log('⚠️  Cannot query ConnectedApplication (permission may be required)');
      console.log('   Message:', appsError.message);
    }

    // Step 5: Provide diagnostic summary
    console.log('\n📋 DIAGNOSTIC SUMMARY\n');
    console.log('=' .repeat(60));

    console.log('\n🔍 What We Found:\n');

    if (eventsResult.totalSize > 0) {
      console.log('✅ Salesforce Events are being created properly');
      console.log(`   ${eventsResult.totalSize} events found in last 7 days`);
    } else {
      console.log('❌ No Salesforce Events found in last 7 days');
      console.log('   Events may not be created by the portal');
    }

    console.log('\n🔍 About Salesforce to Google Calendar Sync:\n');
    console.log('This system does NOT have automatic sync built-in because:');
    console.log('1. Lark Calendar and Salesforce Events are SEPARATE systems');
    console.log('2. Portal creates events in BOTH systems independently');
    console.log('3. No automatic sync exists between them\n');

    console.log('📚 To Enable Automatic Sync, You Need ONE of These:\n');
    console.log('Option 1: Salesforce Einstein Activity Capture');
    console.log('  - Enterprise/Unlimited Edition feature');
    console.log('  - Automatically syncs Salesforce Events to Google Calendar');
    console.log('  - Requires admin configuration in Salesforce Setup');
    console.log('  - Check: Setup > Einstein Activity Capture > Settings\n');

    console.log('Option 2: Google Calendar Integration for Salesforce');
    console.log('  - Available via AppExchange');
    console.log('  - Various third-party apps available');
    console.log('  - Check: https://appexchange.salesforce.com (search "Google Calendar")\n');

    console.log('Option 3: Custom Middleware Integration');
    console.log('  - Build custom integration using:');
    console.log('    * Salesforce Platform Events (for real-time sync)');
    console.log('    * Google Calendar API');
    console.log('    * Middleware service (Node.js, Python, etc.)');
    console.log('  - Requires development and maintenance\n');

    console.log('💡 Current System Architecture:\n');
    console.log('Portal → Lark Calendar (Primary, for scheduling)');
    console.log('Portal → Salesforce Events (Secondary, for KPI tracking)');
    console.log('         ↕ NO AUTOMATIC SYNC ↕');
    console.log('Lark ←   Not Connected   → Salesforce\n');

    console.log('🔍 Next Steps:\n');
    console.log('1. Check if you have Salesforce Einstein Activity Capture license');
    console.log('2. If yes: Configure it in Salesforce Setup');
    console.log('3. If no: Consider AppExchange solutions or custom integration');
    console.log('4. Verify users have connected their Google/Lark calendars to Salesforce');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
    console.error('\nFull error:', error);
  }
}

// Run the diagnostic
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
