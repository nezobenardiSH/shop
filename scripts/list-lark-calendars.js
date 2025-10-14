#!/usr/bin/env node

/**
 * List all available Lark calendars for a user
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUserCalendars(userEmail) {
  try {
    // Get user token
    const token = await prisma.larkAuthToken.findUnique({
      where: { userEmail }
    });
    
    if (!token) {
      console.log(`No authorization found for ${userEmail}`);
      return;
    }
    
    console.log(`\n📅 Fetching calendars for ${userEmail}...\n`);
    
    // Make API call to list calendars
    const response = await fetch('https://open.larksuite.com/open-apis/calendar/v4/calendars', {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0 && data.data?.calendar_list) {
      console.log(`Found ${data.data.calendar_list.length} calendars:\n`);
      
      data.data.calendar_list.forEach((cal, index) => {
        console.log(`${index + 1}. ${cal.summary || 'Unnamed Calendar'}`);
        console.log(`   ID: ${cal.calendar_id}`);
        console.log(`   Type: ${cal.type || 'unknown'}`);
        console.log(`   Permissions: ${cal.permission || 'unknown'}`);
        
        // Highlight personal vs group calendars
        if (cal.calendar_id?.includes('group.calendar')) {
          console.log('   📋 This is a GROUP/SHARED calendar');
        } else if (cal.type === 'primary' || cal.summary?.includes(userEmail.split('@')[0])) {
          console.log('   ⭐ This looks like your PERSONAL calendar');
        }
        console.log('');
      });
      
      // Current setting
      console.log('========================================');
      console.log(`Current Calendar ID in database: ${token.calendarId}`);
      console.log('========================================');
      
      // Recommendation
      const personalCal = data.data.calendar_list.find(cal => 
        !cal.calendar_id?.includes('group.calendar') && 
        (cal.type === 'primary' || cal.summary?.toLowerCase().includes('nezo'))
      );
      
      if (personalCal && personalCal.calendar_id !== token.calendarId) {
        console.log('\n💡 RECOMMENDATION:');
        console.log(`   Update to calendar: "${personalCal.summary}"`);
        console.log(`   ID: ${personalCal.calendar_id}`);
        console.log('\n   Run: node scripts/update-calendar-id.js');
      }
      
    } else {
      console.log('Failed to fetch calendars:', data.msg || 'Unknown error');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function main() {
  const userEmail = process.argv[2] || 'nezo.benardi@storehub.com';
  
  console.log('========================================');
  console.log('  Lark Calendar List Tool');
  console.log('========================================');
  
  await listUserCalendars(userEmail);
  
  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});