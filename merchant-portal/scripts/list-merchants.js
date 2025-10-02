const { PrismaClient } = require('@prisma/client')

async function listMerchants() {
  const prisma = new PrismaClient()
  
  try {
    const merchants = await prisma.merchant.findMany({
      select: {
        id: true,
        slug: true,
        companyName: true,
        email: true,
        onboardingStage: true,
        createdAt: true
      }
    })
    
    console.log('=== Merchants in Database ===')
    console.log('Total merchants:', merchants.length)
    console.log('\nMerchants:')
    
    merchants.forEach(merchant => {
      console.log(`\n- Company: ${merchant.companyName}`)
      console.log(`  Slug: ${merchant.slug}`)
      console.log(`  ID: ${merchant.id}`)
      console.log(`  Email: ${merchant.email}`)
      console.log(`  Stage: ${merchant.onboardingStage}`)
      console.log(`  URL: https://onboarding-portal-b0ay.onrender.com/merchant/${merchant.slug}`)
    })
    
    if (merchants.length === 0) {
      console.log('No merchants found in database')
      console.log('\nYou may need to:')
      console.log('1. Create merchants through the API')
      console.log('2. Seed the database')
      console.log('3. Check if the database connection is correct')
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

listMerchants()