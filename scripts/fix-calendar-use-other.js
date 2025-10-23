const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

async function fixCalendar() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Fixing calendar to use the other owned calendar...\n');
    
    const token = await prisma.larkAuthToken.findUnique({
      where: { userEmail: 'nezo.benardi@storehub.com' }
    });
    
    // Try the other calendar you own
    const otherCalendarId = 'feishu.cn_zLXUWDRprW4Ozy6kXXCIua@group.calendar.feishu.cn';
    console.log('Testing calendar:', otherCalendarId, '(Nezo Benardi)');
    
    const event = {
      summary: 'Test Event',
      description: 'Testing calendar permissions',
      start_time: {
        timestamp: Math.floor((Date.now() + 86400000) / 1000).toString()
      },
      end_time: {
        timestamp: Math.floor((Date.now() + 90000000) / 1000).toString()
      }
    };
    
    const response = await fetch(
      `https://open.larksuite.com/open-apis/calendar/v4/calendars/${otherCalendarId}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );
    
    const data = await response.json();
    
    if (data.code === 0) {
      console.log('✅ SUCCESS! This calendar works!');
      console.log('   Event ID:', data.data?.event?.event_id);
      
      // Update database
      await prisma.larkAuthToken.update({
        where: { userEmail: 'nezo.benardi@storehub.com' },
        data: { calendarId: otherCalendarId }
      });
      
      console.log('\n✅ Updated database to use working calendar:', otherCalendarId);
      console.log('   This is your "Nezo Benardi" calendar\n');
      
      // Clean up test event
      if (data.data?.event?.event_id) {
        await fetch(
          `https://open.larksuite.com/open-apis/calendar/v4/calendars/${otherCalendarId}/events/${data.data.event.event_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token.accessToken}`
            }
          }
        );
        console.log('   Cleaned up test event');
      }
      
      console.log('\n🎉 Calendar fixed! Try booking again now.');
    } else {
      console.log('❌ This calendar also has permission issues');
      console.log('   Error:', data.msg);
      console.log('\n🔧 SOLUTION: You need to change calendar permissions in Lark');
      console.log('   1. Open Lark/Feishu');
      console.log('   2. Go to Calendar settings');
      console.log('   3. Find your calendar');
      console.log('   4. Change permissions from "show_only_free_busy" to allow event creation');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixCalendar();