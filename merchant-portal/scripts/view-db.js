const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('📊 Database Contents:\n');
    
    const merchantCount = await prisma.merchant.count();
    console.log(`Total Merchants: ${merchantCount}\n`);
    
    if (merchantCount > 0) {
      const merchants = await prisma.merchant.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('Recent Merchants:');
      merchants.forEach(m => {
        console.log(`- ${m.companyName} (${m.email}) - Stage: ${m.onboardingStage}`);
      });
    } else {
      console.log('No merchants in database yet.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();