#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
const fs = require('fs').promises
const path = require('path')

async function revokeAllAuth() {
  console.log('🔄 Revoking all Lark OAuth authorizations...\n')
  
  const prisma = new PrismaClient()

  try {
    // 1. Delete all tokens from database
    const deleted = await prisma.larkOAuthToken.deleteMany({})
    console.log(`✅ Deleted ${deleted.count} OAuth tokens from database`)

    // 2. Clear trainer Lark IDs from config
    const trainersConfigPath = path.join(process.cwd(), 'config', 'trainers.json')
    const trainersConfig = JSON.parse(await fs.readFile(trainersConfigPath, 'utf-8'))
    
    trainersConfig.trainers.forEach((trainer) => {
      if (trainer.larkUserId || trainer.larkOpenId) {
        console.log(`📝 Clearing Lark IDs for trainer: ${trainer.name}`)
        delete trainer.larkUserId
        delete trainer.larkOpenId
      }
    })
    
    await fs.writeFile(trainersConfigPath, JSON.stringify(trainersConfig, null, 2))
    console.log('✅ Cleared trainer Lark IDs from config')

    // 3. Clear installer Lark IDs from config
    const installersConfigPath = path.join(process.cwd(), 'config', 'installers.json')
    const installersConfig = JSON.parse(await fs.readFile(installersConfigPath, 'utf-8'))
    
    installersConfig.internal.installers.forEach((installer) => {
      if (installer.larkUserId || installer.larkOpenId) {
        console.log(`📝 Clearing Lark IDs for installer: ${installer.name}`)
        delete installer.larkUserId
        delete installer.larkOpenId
      }
    })
    
    await fs.writeFile(installersConfigPath, JSON.stringify(installersConfig, null, 2))
    console.log('✅ Cleared installer Lark IDs from config')

    console.log('\n🎯 All authorizations have been revoked!')
    console.log('\n📋 Next steps:')
    console.log('1. Go to http://localhost:3010/trainers/authorize to re-authorize trainers')
    console.log('2. Go to http://localhost:3010/installers/authorize to re-authorize installers')
    console.log('\n⚠️  IMPORTANT: When re-authorizing, make sure to:')
    console.log('   - Accept ALL calendar permissions when prompted')
    console.log('   - Check that your Lark app has calendar permissions enabled in the Developer Console')
    
  } catch (error) {
    console.error('❌ Error revoking authorizations:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
revokeAllAuth()