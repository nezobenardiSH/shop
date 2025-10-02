// Test intelligent trainer assignment
const fetch = require('node-fetch');

async function testBooking() {
  console.log('🧪 Testing Intelligent Trainer Assignment\n');
  console.log('==========================================\n');
  
  // Test parameters
  const testBookings = [
    { date: '2025-10-03', startTime: '09:00', endTime: '11:00', merchantName: 'Test Merchant 1' },
    { date: '2025-10-03', startTime: '11:00', endTime: '13:00', merchantName: 'Test Merchant 2' },
    { date: '2025-10-03', startTime: '13:00', endTime: '15:00', merchantName: 'Test Merchant 3' },
  ];
  
  const results = [];
  
  for (const booking of testBookings) {
    console.log(`\n📅 Testing booking for ${booking.merchantName}`);
    console.log(`   Date: ${booking.date}`);
    console.log(`   Time: ${booking.startTime} - ${booking.endTime}`);
    
    try {
      const response = await fetch('http://localhost:3010/api/lark/book-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: `test-${Date.now()}`,
          merchantName: booking.merchantName,
          trainerName: 'System', // This will be ignored, using intelligent assignment
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.assignedTrainer) {
        console.log(`   ✅ Success! Assigned to: ${data.assignedTrainer}`);
        console.log(`   📝 Reason: ${data.assignmentReason || 'N/A'}`);
        results.push({
          ...booking,
          assignedTo: data.assignedTrainer,
          reason: data.assignmentReason
        });
      } else {
        console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`);
        if (data.details) console.log(`      Details: ${data.details}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n==========================================');
  console.log('📊 ASSIGNMENT SUMMARY\n');
  
  const trainerCounts = {};
  results.forEach(r => {
    trainerCounts[r.assignedTo] = (trainerCounts[r.assignedTo] || 0) + 1;
  });
  
  console.log('Trainer Distribution:');
  Object.entries(trainerCounts).forEach(([trainer, count]) => {
    console.log(`   ${trainer}: ${count} booking(s)`);
  });
  
  console.log('\nDetailed Results:');
  results.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.merchantName} → ${r.assignedTo}`);
    console.log(`      (${r.reason})`);
  });
  
  console.log('\n✅ Test Complete!');
}

testBooking().catch(console.error);