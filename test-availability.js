const fetch = require('node-fetch');

async function checkAvailability() {
  try {
    const response = await fetch('http://localhost:3010/api/lark/availability');
    const data = await response.json();
    
    // Find Oct 14
    const oct14 = data.availability.find(d => d.date === '2025-10-14');
    if (!oct14) {
      console.log('No data for Oct 14');
      return;
    }
    
    // Check 4-6pm slot
    const slot4to6 = oct14.slots.find(s => s.start === '16:00' && s.end === '18:00');
    
    console.log('\n=== October 14, 4-6pm Slot Analysis ===');
    console.log('Available:', slot4to6.available);
    console.log('Available Trainers:', slot4to6.availableTrainers || 'None');
    console.log('Available Languages:', slot4to6.availableLanguages || 'None');
    
    // Check if Nezo is in the list
    const hasNezo = slot4to6.availableTrainers?.includes('Nezo');
    console.log('\nNezo available for 4-6pm?', hasNezo ? 'YES' : 'NO');
    
    if (!hasNezo) {
      console.log('\n⚠️ Nezo is NOT available for 4-6pm on Oct 14');
      console.log('This suggests Nezo has a conflict during this time.');
    } else {
      console.log('\n✅ Nezo IS available for 4-6pm on Oct 14');
    }
    
    // Also check 3-5pm for comparison
    const slot3to5 = oct14.slots.find(s => s.start === '15:00' && s.end === '17:00');
    console.log('\n=== Comparison: 3-5pm Slot ===');
    console.log('Available Trainers:', slot3to5.availableTrainers || 'None');
    console.log('Nezo available for 3-5pm?', slot3to5.availableTrainers?.includes('Nezo') ? 'YES' : 'NO (expected due to Design meeting)');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAvailability();