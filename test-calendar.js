// Test script to check what calendar events are being returned for Nezo
const fetch = require('node-fetch');

async function testCalendarEvents() {
  try {
    console.log('Testing calendar events for nezo.benardi@storehub.com...\n');
    
    // Import the lark service
    const { larkService } = await import('./lib/lark.ts');
    
    // Set date range for October 14, 2025
    const startDate = new Date('2025-10-14T00:00:00.000Z');
    const endDate = new Date('2025-10-15T00:00:00.000Z');
    
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
    
    // Get raw busy times
    const busyTimes = await larkService.getRawBusyTimes(
      'nezo.benardi@storehub.com',
      startDate,
      endDate
    );
    
    console.log(`\n=== RESULTS ===`);
    console.log(`Found ${busyTimes.length} busy periods on October 14, 2025:\n`);
    
    busyTimes.forEach((busy, i) => {
      const start = new Date(busy.start_time);
      const end = new Date(busy.end_time);
      
      const startLocal = start.toLocaleString('en-US', { 
        timeZone: 'Asia/Singapore', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        day: '2-digit',
        month: 'short'
      });
      const endLocal = end.toLocaleString('en-US', { 
        timeZone: 'Asia/Singapore', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
      
      console.log(`${i+1}. ${startLocal} - ${endLocal}`);
      console.log(`   UTC: ${busy.start_time} to ${busy.end_time}`);
      
      // Check if this is the lunch meeting
      if (startLocal.includes('12:30') || startLocal.includes('01:30')) {
        console.log(`   🍱 This might be the lunch meeting!`);
      }
      
      console.log('');
    });
    
    // Check specifically for lunch time (12:30-1:30pm Singapore = 04:30-05:30 UTC)
    const lunchStart = new Date('2025-10-14T04:30:00.000Z');
    const lunchEnd = new Date('2025-10-14T05:30:00.000Z');
    
    const lunchOverlap = busyTimes.find(busy => {
      const start = new Date(busy.start_time);
      const end = new Date(busy.end_time);
      return (start < lunchEnd && end > lunchStart);
    });
    
    if (lunchOverlap) {
      console.log(`✅ Found lunch meeting overlap!`);
    } else {
      console.log(`❌ No lunch meeting found for 12:30-1:30pm on Oct 14`);
      console.log(`   Expected time range: 04:30-05:30 UTC`);
    }
    
  } catch (error) {
    console.error('Error testing calendar events:', error);
  }
}

testCalendarEvents();
