const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

async function debugCalendarCreation() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Debug: Testing exact calendar creation flow\n');
    
    // Get token and calendar info
    const token = await prisma.larkAuthToken.findUnique({
      where: { userEmail: 'nezo.benardi@storehub.com' }
    });
    
    if (!token) {
      console.log('❌ No token found');
      return;
    }
    
    console.log('Token info:');
    console.log('  Email:', token.userEmail);
    console.log('  Calendar ID:', token.calendarId);
    console.log('  User ID:', token.larkUserId);
    console.log('');
    
    // Test 1: List calendars and check permissions
    console.log('Test 1: List calendars and check permissions...\n');
    const listResponse = await fetch('https://open.larksuite.com/open-apis/calendar/v4/calendars', {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`
      }
    });
    
    const listData = await listResponse.json();
    if (listData.code === 0) {
      const myCalendar = listData.data.calendar_list.find(
        cal => cal.calendar_id === token.calendarId
      );
      
      if (myCalendar) {
        console.log('✅ Found stored calendar:', token.calendarId);
        console.log('   Name:', myCalendar.summary);
        console.log('   Role:', myCalendar.role);
        console.log('   Type:', myCalendar.type);
        console.log('   Permissions:', myCalendar.permissions || 'not specified');
        
        if (myCalendar.role !== 'owner' && myCalendar.role !== 'writer') {
          console.log('\n⚠️  WARNING: You do not have write permission on this calendar!');
          console.log('   Your role is:', myCalendar.role);
          console.log('   You need "owner" or "writer" role to create events\n');
        }
      } else {
        console.log('❌ Stored calendar not found in your calendar list');
      }
      
      // Find calendars where user has owner permission
      const ownedCalendars = listData.data.calendar_list.filter(cal => cal.role === 'owner');
      console.log(`\nYou have owner permission on ${ownedCalendars.length} calendars:`);
      ownedCalendars.forEach(cal => {
        console.log(`  - ${cal.calendar_id}: ${cal.summary || 'No name'}`);
      });
    }
    
    // Test 2: Try creating event with the stored calendar ID
    console.log('\nTest 2: Try creating event with stored calendar ID...\n');
    
    const event = {
      summary: 'Debug Test Event',
      description: 'Testing calendar creation',
      start_time: {
        timestamp: Math.floor((Date.now() + 86400000) / 1000).toString()
      },
      end_time: {
        timestamp: Math.floor((Date.now() + 90000000) / 1000).toString()
      }
    };
    
    console.log('Attempting to create event in:', token.calendarId);
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
      console.log('✅ SUCCESS! Event created with ID:', createData.data?.event?.event_id);
      
      // Clean up
      if (createData.data?.event?.event_id) {
        await fetch(
          `https://open.larksuite.com/open-apis/calendar/v4/calendars/${token.calendarId}/events/${createData.data.event.event_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token.accessToken}`
            }
          }
        );
        console.log('   Cleaned up test event');
      }
    } else {
      console.log('❌ FAILED to create event');
      console.log('   Error code:', createData.code);
      console.log('   Error message:', createData.msg);
      console.log('   Full response:', JSON.stringify(createData, null, 2));
      
      // Test 3: Try with first owned calendar
      const ownedCalendars = listData.data?.calendar_list?.filter(cal => cal.role === 'owner') || [];
      if (ownedCalendars.length > 0) {
        console.log('\nTest 3: Trying with first owned calendar...\n');
        const ownedCalId = ownedCalendars[0].calendar_id;
        console.log('Using calendar:', ownedCalId);
        
        const retryResponse = await fetch(
          `https://open.larksuite.com/open-apis/calendar/v4/calendars/${ownedCalId}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
          }
        );
        
        const retryData = await retryResponse.json();
        
        if (retryData.code === 0) {
          console.log('✅ SUCCESS with owned calendar!');
          console.log('   Event ID:', retryData.data?.event?.event_id);
          
          // Update database with working calendar
          await prisma.larkAuthToken.update({
            where: { userEmail: 'nezo.benardi@storehub.com' },
            data: { calendarId: ownedCalId }
          });
          
          console.log('\n✅ FIXED: Updated database to use working calendar:', ownedCalId);
          
          // Clean up
          if (retryData.data?.event?.event_id) {
            await fetch(
              `https://open.larksuite.com/open-apis/calendar/v4/calendars/${ownedCalId}/events/${retryData.data.event.event_id}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token.accessToken}`
                }
              }
            );
          }
        } else {
          console.log('❌ Failed even with owned calendar');
          console.log('   Error:', retryData.msg);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugCalendarCreation();