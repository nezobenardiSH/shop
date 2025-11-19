#!/usr/bin/env node
/**
 * Test script to verify Lark VC permissions
 * Run with: node test-lark-vc-permissions.js
 */

require('dotenv').config({ path: '.env.local' });

async function testLarkVCPermissions() {
  console.log('🔍 Testing Lark VC Permissions...\n');

  // Step 1: Get Lark Access Token
  console.log('📝 Step 1: Getting Lark access token...');

  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;

  if (!appId || !appSecret) {
    console.error('❌ ERROR: LARK_APP_ID or LARK_APP_SECRET not found in .env.local');
    process.exit(1);
  }

  try {
    const tokenResponse = await fetch(
      'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.tenant_access_token) {
      console.error('❌ Failed to get access token:', tokenData);
      process.exit(1);
    }

    const accessToken = tokenData.tenant_access_token;
    console.log('✅ Access token obtained');

    // Check app permissions
    console.log('📝 Checking app permissions...');
    const permissionsResponse = await fetch(
      `https://open.larksuite.com/open-apis/contact/v3/scopes`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (permissionsResponse.ok) {
      const permData = await permissionsResponse.json();
      console.log('   App scopes:', permData);
    }
    console.log('');

    // Step 2: Test VC API - Try multiple endpoint variations
    console.log('📝 Step 2: Testing VC API endpoints...\n');

    const testMeetingTitle = 'Test Meeting - Permission Check';
    const now = Math.floor(Date.now() / 1000);
    const startTime = now + 3600; // 1 hour from now
    const endTime = startTime + 1800; // 30 minutes duration

    // Try different endpoint variations
    const endpoints = [
      {
        name: 'vc/v1/reserve/apply (POST)',
        url: 'https://open.larksuite.com/open-apis/vc/v1/reserve/apply',
        method: 'POST',
        body: {
          end_time: endTime.toString(),
          meeting_settings: {
            topic: testMeetingTitle,
            auto_record: false,
          },
        },
      },
      {
        name: 'vc/v1/reserves (POST)',
        url: 'https://open.larksuite.com/open-apis/vc/v1/reserves',
        method: 'POST',
        body: {
          end_time: endTime.toString(),
          meeting_settings: {
            topic: testMeetingTitle,
            auto_record: false,
          },
        },
      },
      {
        name: 'vc/v1/meetings (POST)',
        url: 'https://open.larksuite.com/open-apis/vc/v1/meetings',
        method: 'POST',
        body: {
          topic: testMeetingTitle,
          start_time: startTime.toString(),
          end_time: endTime.toString(),
        },
      },
    ];

    let vcResponse = null;
    let vcData = null;
    let successfulEndpoint = null;

    for (const endpoint of endpoints) {
      console.log(`\n🔍 Trying: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      console.log(`   Body: ${JSON.stringify(endpoint.body, null, 2)}`);

      vcResponse = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(endpoint.body),
      });

      console.log(`   Status: ${vcResponse.status}`);

      const responseText = await vcResponse.text();

      try {
        vcData = JSON.parse(responseText);
        console.log(`   Response: ${JSON.stringify(vcData, null, 2)}`);

        if (vcResponse.ok || (vcData && vcData.code !== 99991401)) {
          successfulEndpoint = endpoint.name;
          console.log(`   ✅ Got valid response!`);
          break;
        }
      } catch (e) {
        console.log(`   ❌ Non-JSON response: ${responseText}`);
      }
    }

    if (!successfulEndpoint) {
      console.log('\n⚠️  All endpoints returned errors or 404');
      vcResponse = { ok: false, status: 404 };
      vcData = { code: 404, msg: 'All endpoints failed' };
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Step 3: Analyze results
    if (!vcResponse.ok) {
      console.log('❌ VC API FAILED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('⚠️  PERMISSIONS NOT APPROVED');
      console.log('');
      console.log('Error Code:', vcData.code);
      console.log('Error Message:', vcData.msg || vcData.message);
      console.log('');

      if (vcData.code === 99991401 || vcData.msg?.includes('permission')) {
        console.log('💡 Solution:');
        console.log('   1. Go to Lark Developer Console');
        console.log('   2. Navigate to your app → Permissions & Scopes');
        console.log('   3. Ensure these permissions are enabled and approved:');
        console.log('      • vc:reserve (Create/update/delete meetings)');
        console.log('      • vc:reserve:readonly (Read meeting details)');
        console.log('   4. Request admin approval if needed');
      }

      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      process.exit(1);
    }

    // Success!
    const meetingLink = vcData.data?.reserve?.meeting_no
      ? `https://vc.larksuite.com/j/${vcData.data.reserve.meeting_no}`
      : vcData.data?.reserve?.url;
    const reservationId = vcData.data?.reserve?.id;

    console.log('✅ VC API SUCCESS!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🎉 PERMISSIONS ARE WORKING!');
    console.log('');
    console.log('✅ Test meeting created successfully:');
    console.log('   Meeting Link:', meetingLink || 'N/A');
    console.log('   Reservation ID:', reservationId || 'N/A');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Your Lark VC permissions are approved ✓');
    console.log('   2. Meeting links will now auto-generate when booking remote training');
    console.log('   3. Test by booking a remote training session');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Cleanup: Try to delete the test meeting (optional)
    if (reservationId) {
      console.log('');
      console.log('🗑️  Cleaning up test meeting...');
      try {
        const deleteResponse = await fetch(
          `https://open.larksuite.com/open-apis/vc/v1/reserves/${reservationId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (deleteResponse.ok) {
          console.log('✅ Test meeting deleted');
        } else {
          console.log('ℹ️  Test meeting will expire automatically');
        }
      } catch (deleteError) {
        console.log('ℹ️  Could not delete test meeting (it will expire automatically)');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testLarkVCPermissions();
