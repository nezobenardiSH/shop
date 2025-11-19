/**
 * Test script to directly call Lark VC API with user OAuth token
 * Run with: npx tsx test-vc-api.ts
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testVCAPI() {
  try {
    console.log('🧪 Testing Lark VC API...\n');

    // Get your OAuth token from database
    const trainerEmail = 'nezo.benardi@storehub.com';
    console.log(`📧 Looking up token for: ${trainerEmail}`);

    const authRecord = await prisma.larkAuthToken.findUnique({
      where: { userEmail: trainerEmail },
    });

    if (!authRecord) {
      console.error('❌ No auth record found for', trainerEmail);
      return;
    }

    console.log(`✅ Found auth record`);
    console.log(`   Scopes: ${authRecord.scopes}`);
    console.log(`   Token expires: ${new Date(authRecord.expiresAt)}`);

    const userAccessToken = authRecord.accessToken;
    console.log(`🔑 Token (first 20 chars): ${userAccessToken.substring(0, 20)}...\n`);

    // Test VC API endpoint (CORRECT PATH: /reserves/apply not /reserve/apply!)
    const baseUrl = process.env.LARK_DOMAIN || 'https://open.larksuite.com';
    const vcApiUrl = `${baseUrl}/open-apis/vc/v1/reserves/apply`;

    console.log(`📍 Testing endpoint: ${vcApiUrl}`);
    console.log(`🌐 Base URL: ${baseUrl}\n`);

    // Create test meeting for tomorrow at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const startTime = Math.floor(tomorrow.getTime() / 1000);
    const endTime = startTime + 3600; // 1 hour meeting

    // Simplified request body matching Lark API docs
    const requestBody = {
      end_time: endTime.toString(),
      meeting_settings: {
        topic: 'Test VC Meeting - API Test',
      },
    };

    console.log(`📋 Request body:`, JSON.stringify(requestBody, null, 2));
    console.log('\n🚀 Sending POST request...\n');

    const response = await fetch(vcApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📡 Response Headers:`, Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log(`\n📦 Response Body (raw):`);
    console.log(responseText);

    // Try to parse JSON
    try {
      const vcData = JSON.parse(responseText);
      console.log(`\n📊 Response Body (parsed):`, JSON.stringify(vcData, null, 2));

      if (vcData.code === 0) {
        console.log('\n✅ SUCCESS! VC meeting created!');
        console.log(`   Meeting Link: ${vcData.data?.reserve?.url || vcData.data?.reserve?.meeting_no}`);
        console.log(`   Reservation ID: ${vcData.data?.reserve?.id}`);
      } else {
        console.log('\n❌ API returned error:');
        console.log(`   Code: ${vcData.code}`);
        console.log(`   Message: ${vcData.msg}`);
      }
    } catch (parseError) {
      console.log('\n⚠️ Response is not valid JSON');
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testVCAPI();
