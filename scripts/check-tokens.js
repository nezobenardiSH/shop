const { PrismaClient } = require('@prisma/client');

async function checkTokens() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking LarkAuthToken table...\n');
    
    const tokens = await prisma.larkAuthToken.findMany();
    
    if (tokens.length === 0) {
      console.log('❌ No tokens found in database!');
      console.log('This explains why calendar creation is failing.');
      console.log('\nYou need to re-authorize:');
      console.log('1. Go to http://localhost:3010/trainers/authorize');
      console.log('2. Click "Authorize with Lark"');
      console.log('3. Accept all permissions');
    } else {
      console.log(`✅ Found ${tokens.length} token(s) in database:\n`);
      tokens.forEach(token => {
        console.log(`- ${token.userEmail}`);
        console.log(`  Name: ${token.userName}`);
        console.log(`  Lark User ID: ${token.larkUserId}`);
        console.log(`  Calendar ID: ${token.calendarId}`);
        console.log(`  Expires: ${token.expiresAt}`);
        console.log(`  Token valid: ${new Date(token.expiresAt) > new Date() ? 'Yes' : 'No (EXPIRED)'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTokens();