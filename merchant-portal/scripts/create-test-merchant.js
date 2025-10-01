const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function createTestMerchant() {
  try {
    // Hash the password
    const passwordHash = await bcrypt.hash('password123', 10)
    
    // Create test merchant
    const merchant = await prisma.merchant.create({
      data: {
        slug: 'bestbuy',
        companyName: 'Best Buy Store',
        email: 'test@bestbuy.com',
        passwordHash: passwordHash,
        address: '123 Main Street, New York, NY 10001',
        phone: '555-123-4567',
        onboardingStage: 'new'
      }
    })
    
    console.log('Test merchant created:', merchant)
  } catch (error) {
    console.error('Error creating test merchant:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestMerchant()
