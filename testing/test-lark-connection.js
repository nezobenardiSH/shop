// Test script to verify Lark API connection
const fetch = require('node-fetch');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const LARK_APP_ID = process.env.LARK_APP_ID || 'cli_a8549d99f97c502f';
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || 'M7Wzk5ZGORiSJJp7xKjxEdzWEOBVtpNT';
const LARK_DOMAIN = process.env.LARK_DOMAIN || 'https://open.larksuite.com';

async function testLarkConnection() {
  console.log('🔍 Testing Lark API Connection...\n');
  console.log('App ID:', LARK_APP_ID);
  console.log('Domain:', LARK_DOMAIN);
  console.log('\n-----------------------------------\n');

  try {
    // Step 1: Get tenant access token
    console.log('📌 Step 1: Getting tenant access token...');
    const tokenResponse = await fetch(`${LARK_DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: LARK_APP_ID,
        app_secret: LARK_APP_SECRET
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.code !== 0) {
      console.error('❌ Failed to get access token:', tokenData.msg);
      return;
    }

    console.log('✅ Successfully obtained access token!');
    console.log('   Token expires in:', tokenData.expire, 'seconds');
    
    const accessToken = tokenData.tenant_access_token;

    // Step 2: Test calendar API access
    console.log('\n📌 Step 2: Testing calendar API access...');
    
    // Try to get user info for one of the trainers
    const testEmail = 'nezo.benardi@storehub.com';
    console.log('   Testing with email:', testEmail);
    
    const userResponse = await fetch(`${LARK_DOMAIN}/open-apis/contact/v3/users/batch_get_id?emails=${testEmail}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const userData = await userResponse.json();
    
    if (userData.code === 0) {
      console.log('✅ Successfully accessed user API!');
      if (userData.data?.user_list?.length > 0) {
        console.log('   User found:', userData.data.user_list[0]);
      } else {
        console.log('⚠️  User not found in Lark. Make sure the email exists in your Lark organization.');
      }
    } else {
      console.log('❌ Failed to access user API:', userData.msg);
      console.log('   This might mean the app doesn\'t have the necessary permissions.');
    }

    console.log('\n-----------------------------------\n');
    console.log('🎉 Connection test complete!');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('   Make sure your Lark app is properly configured and active.');
  }
}

testLarkConnection();