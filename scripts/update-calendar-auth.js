#!/usr/bin/env node

/**
 * Script to update trainer's Lark calendar authorization
 * This helps select the correct calendar (personal work calendar vs group calendar)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listCalendars() {
  console.log('\n📅 Current Calendar Authorizations:\n');
  
  const tokens = await prisma.larkAuthToken.findMany({
    select: {
      userEmail: true,
      userName: true,
      calendarId: true,
      updatedAt: true
    }
  });
  
  tokens.forEach(token => {
    console.log(`👤 ${token.userName || token.userEmail}`);
    console.log(`   Email: ${token.userEmail}`);
    console.log(`   Calendar ID: ${token.calendarId || 'Not set'}`);
    console.log(`   Last Updated: ${token.updatedAt.toLocaleString()}`);
    
    if (token.calendarId?.includes('group.calendar')) {
      console.log('   ⚠️  WARNING: Using GROUP calendar - personal events may not appear!');
    }
    console.log('');
  });
  
  return tokens;
}

async function updateCalendarId(email, newCalendarId) {
  try {
    const result = await prisma.larkAuthToken.update({
      where: { userEmail: email },
      data: { calendarId: newCalendarId }
    });
    
    console.log(`✅ Updated calendar ID for ${email}`);
    console.log(`   New Calendar ID: ${newCalendarId}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Failed to update: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('========================================');
  console.log('  Lark Calendar Authorization Helper');
  console.log('========================================');
  
  const tokens = await listCalendars();
  
  if (tokens.length === 0) {
    console.log('No authorized users found.');
    console.log('\nPlease authorize first at: /trainers/authorize');
    await prisma.$disconnect();
    return;
  }
  
  // Check for Nezo's authorization
  const nezoToken = tokens.find(t => t.userEmail === 'nezo.benardi@storehub.com');
  
  if (nezoToken) {
    console.log('========================================');
    console.log('\n🔍 Checking Nezo\'s Calendar Setup:\n');
    
    if (nezoToken.calendarId?.includes('group.calendar')) {
      console.log('⚠️  ISSUE DETECTED: Nezo is using a GROUP calendar!');
      console.log('   This means personal meetings (like Design reviews) won\'t appear.');
      console.log('');
      console.log('📋 TO FIX THIS:');
      console.log('   1. Visit: http://localhost:3010/trainers/authorize');
      console.log('   2. Re-authorize your Lark account');
      console.log('   3. During authorization, make sure to:');
      console.log('      - Grant calendar permissions');
      console.log('      - Select your PERSONAL work calendar');
      console.log('      - NOT the group/shared calendar');
      console.log('');
      console.log('💡 TIP: Your personal work calendar should be named something like:');
      console.log('   - "Nezo Benardi" or');
      console.log('   - "nezo.benardi@storehub.com" or');
      console.log('   - "My Calendar"');
      console.log('   - NOT "StoreHub Team" or any group calendar');
      
      // Optionally update to primary
      console.log('\n🔧 Quick Fix Options:');
      console.log('   Option 1: Update to "primary" (usually points to personal calendar)');
      console.log('   Option 2: Re-authorize with correct calendar');
      console.log('');
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('Would you like to try updating to "primary"? (y/n): ', async (answer) => {
        if (answer.toLowerCase() === 'y') {
          await updateCalendarId('nezo.benardi@storehub.com', 'primary');
          console.log('\n✅ Calendar updated! Please test the availability now.');
          console.log('   If it still doesn\'t work, please re-authorize.');
        } else {
          console.log('\nPlease re-authorize at: http://localhost:3010/trainers/authorize');
        }
        
        rl.close();
        await prisma.$disconnect();
      });
      
      return;
    } else {
      console.log('✅ Calendar setup looks correct!');
      console.log(`   Using: ${nezoToken.calendarId}`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});