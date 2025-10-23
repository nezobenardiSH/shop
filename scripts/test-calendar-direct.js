const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

async function testCalendarDirect() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing Calendar Event Creation Directly\n');
    console.log('=========================================\n');
    
    // Get Nezo's token from database
    const token = await prisma.larkAuthToken.findUnique({
      where: { userEmail: 'nezo.benardi@storehub.com' }
    });
    
    if (!token) {
      console.log('❌ No token found for nezo.benardi@storehub.com');
      return;
    }
    
    console.log('✅ Found token for:', token.userEmail);
    console.log('   Calendar ID:', token.calendarId);
    console.log('   Lark User ID:', token.larkUserId);
    console.log('   Token expires:', token.expiresAt);
    console.log('');
    
    // Test 1: Try to list calendars with user token
    console.log('Test 1: List calendars with user token...');
    const listResponse = await fetch('https://open.larksuite.com/open-apis/calendar/v4/calendars', {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const listData = await listResponse.json();
    console.log('Response:', listData.code === 0 ? '✅ Success' : `❌ Error: ${listData.msg}`);
    
    if (listData.code === 0 && listData.data?.calendar_list) {
      console.log(`Found ${listData.data.calendar_list.length} calendars`);
      listData.data.calendar_list.forEach(cal => {
        console.log(`  - ${cal.calendar_id}: ${cal.summary || 'No name'} (${cal.role})`);
      });
    }
    console.log('');
    
    // Test 2: Try to create an event
    console.log('Test 2: Create a test event...');
    
    const now = new Date();
    const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
    
    const event = {
      summary: 'Test Event from Script',
      description: 'This is a test event created by the diagnostic script',
      start_time: {
        timestamp: Math.floor(startTime.getTime() / 1000).toString(),
        timezone: 'Asia/Singapore'
      },
      end_time: {
        timestamp: Math.floor(endTime.getTime() / 1000).toString(),
        timezone: 'Asia/Singapore'
      }
    };
    
    console.log('Event data:', JSON.stringify(event, null, 2));
    console.log('');
    
    console.log('Attempting to create event in calendar:', token.calendarId);
    
    const createResponse = await fetch(
      `https://open.larksuite.com/open-apis/calendar/v4/calendars/${token.calendarId}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );
    
    const createData = await createResponse.json();
    
    if (createData.code === 0) {
      console.log('✅ Event created successfully!');
      console.log('   Event ID:', createData.data?.event?.event_id);
      
      // Delete the test event
      if (createData.data?.event?.event_id) {
        const deleteResponse = await fetch(
          `https://open.larksuite.com/open-apis/calendar/v4/calendars/${token.calendarId}/events/${createData.data.event.event_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token.accessToken}`
            }
          }
        );
        const deleteData = await deleteResponse.json();
        console.log('   Cleanup:', deleteData.code === 0 ? '✅ Test event deleted' : '❌ Failed to delete test event');
      }
    } else {
      console.log('❌ Failed to create event');
      console.log('   Error code:', createData.code);
      console.log('   Error message:', createData.msg);
      
      if (createData.msg && createData.msg.includes('no calendar access_role')) {
        console.log('\n🔴 CALENDAR ACCESS ROLE ERROR CONFIRMED\n');
        console.log('This error occurs when:');
        console.log('1. The calendar ID is incorrect or belongs to someone else');
        console.log('2. The user doesn\'t have write access to the calendar');
        console.log('3. The calendar is a shared/group calendar without proper permissions');
        console.log('\nCurrent calendar ID:', token.calendarId);
        console.log('\nPossible solutions:');
        console.log('1. Use "primary" instead of the specific calendar ID');
        console.log('2. Create events in the user\'s primary calendar');
        console.log('3. Check if this is a personal or group calendar');
      }
    }
    
    // Test 3: Try with "primary" calendar
    console.log('\nTest 3: Try creating event in "primary" calendar...');
    
    const primaryResponse = await fetch(
      'https://open.larksuite.com/open-apis/calendar/v4/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );
    
    const primaryData = await primaryResponse.json();
    
    if (primaryData.code === 0) {
      console.log('✅ Event created successfully in PRIMARY calendar!');
      console.log('   Event ID:', primaryData.data?.event?.event_id);
      
      // Delete the test event
      if (primaryData.data?.event?.event_id) {
        await fetch(
          `https://open.larksuite.com/open-apis/calendar/v4/calendars/primary/events/${primaryData.data.event.event_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token.accessToken}`
            }
          }
        );
        console.log('   Cleanup: Test event deleted');
      }
      
      console.log('\n✅ SOLUTION: Use "primary" as the calendar ID instead of:', token.calendarId);
    } else {
      console.log('❌ Failed to create event in primary calendar');
      console.log('   Error:', primaryData.msg);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCalendarDirect();