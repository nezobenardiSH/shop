const { PrismaClient } = require('@prisma/client');

async function fixCalendarId() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Fixing calendar ID for Nezo...\n');
    
    // Update to use Nezo's personal calendar where he has owner permission
    const result = await prisma.larkAuthToken.update({
      where: { userEmail: 'nezo.benardi@storehub.com' },
      data: { 
        calendarId: 'feishu.cn_npByOcsikBolona6BLBh0f@group.calendar.feishu.cn' 
      }
    });
    
    console.log('✅ Updated calendar ID to:', result.calendarId);
    console.log('   This is your personal calendar where you have owner permissions');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixCalendarId();