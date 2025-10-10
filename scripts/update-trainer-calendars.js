#!/usr/bin/env node

/**
 * Script to fetch and update trainer calendar IDs from Lark
 * Run this to populate the actual calendar IDs for each trainer
 */

const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Load trainer configuration
const configPath = path.join(__dirname, '..', 'config', 'trainers.json');
const trainersConfig = require(configPath);

// Create a simple Lark API client
class LarkClient {
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

  async getPrimaryCalendarId(userEmail) {
    const user = await this.getUserByEmail(userEmail);
    const data = await this.makeRequest('/open-apis/calendar/v4/calendars', {
      method: 'GET',
      headers: { 'X-Lark-User-Id': user.user_id }
    });
    
    const calendars = data.data?.calendar_list || [];
    const primary = calendars.find(cal => 
      cal.type === 'primary' || 
      cal.role === 'owner' ||
      cal.summary?.toLowerCase().includes('primary')
    );
    
    return primary?.calendar_id || calendars[0]?.calendar_id || 'primary';
  }
}

const larkService = new LarkClient();

async function updateTrainerCalendars() {
  console.log('🔄 Starting trainer calendar ID update...\n');
  console.log('Current configuration:', {
    appId: process.env.LARK_APP_ID ? '✅ Configured' : '❌ Missing',
    appSecret: process.env.LARK_APP_SECRET ? '✅ Configured' : '❌ Missing',
    domain: process.env.LARK_DOMAIN || 'https://open.larksuite.com'
  });
  console.log('\n-----------------------------------\n');

  // Track updates
  let updatedCount = 0;
  let failedCount = 0;
  const results = [];

  // Process each trainer
  for (const trainer of trainersConfig.trainers) {
    if (!trainer.email) {
      console.log(`⚠️  Skipping ${trainer.name}: No email configured`);
      continue;
    }

    // Skip test/merchant entries
    if (trainer.name === 'Nasi Lemak' || trainer.email.includes('test')) {
      console.log(`⏭️  Skipping ${trainer.name}: Test/merchant account`);
      continue;
    }

    console.log(`\n📧 Processing ${trainer.name} (${trainer.email})...`);

    try {
      // Fetch primary calendar ID
      const calendarId = await larkService.getPrimaryCalendarId(trainer.email);
      
      if (calendarId && calendarId !== 'primary') {
        // Update the trainer's calendar ID
        trainer.calendarId = calendarId;
        updatedCount++;
        
        console.log(`✅ Successfully fetched calendar ID: ${calendarId}`);
        results.push({
          name: trainer.name,
          email: trainer.email,
          calendarId: calendarId,
          status: 'success'
        });
      } else {
        console.log(`⚠️  Using fallback 'primary' for ${trainer.name}`);
        trainer.calendarId = 'primary';
        results.push({
          name: trainer.name,
          email: trainer.email,
          calendarId: 'primary',
          status: 'fallback'
        });
      }

      // Also try to get Lark user ID
      try {
        const user = await larkService.getUserByEmail(trainer.email);
        if (user && user.user_id !== trainer.email) {
          trainer.larkUserId = user.user_id;
          console.log(`   User ID: ${user.user_id}`);
        }
      } catch (userError) {
        console.log('   Could not fetch user ID');
      }

    } catch (error) {
      console.error(`❌ Failed to update ${trainer.name}:`, error.message);
      failedCount++;
      results.push({
        name: trainer.name,
        email: trainer.email,
        error: error.message,
        status: 'failed'
      });
    }
  }

  // Save the updated configuration
  if (updatedCount > 0) {
    console.log('\n💾 Saving updated configuration...');
    
    try {
      fs.writeFileSync(
        configPath, 
        JSON.stringify(trainersConfig, null, 2)
      );
      console.log('✅ Configuration saved successfully!');
    } catch (saveError) {
      console.error('❌ Failed to save configuration:', saveError);
    }
  }

  // Print summary
  console.log('\n-----------------------------------');
  console.log('📊 Summary:');
  console.log(`   Updated: ${updatedCount} trainers`);
  console.log(`   Failed: ${failedCount} trainers`);
  console.log(`   Total: ${trainersConfig.trainers.length} trainers`);
  
  console.log('\n📋 Results:');
  results.forEach(result => {
    if (result.status === 'success') {
      console.log(`   ✅ ${result.name}: ${result.calendarId}`);
    } else if (result.status === 'fallback') {
      console.log(`   ⚠️  ${result.name}: Using fallback 'primary'`);
    } else {
      console.log(`   ❌ ${result.name}: ${result.error}`);
    }
  });

  console.log('\n✨ Calendar update process complete!');
}

// Run the update
updateTrainerCalendars().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});