const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function syncLarkIds() {
  try {
    // Get all Lark auth tokens from database
    const authTokens = await prisma.larkAuthToken.findMany()
    
    console.log('Found', authTokens.length, 'authorized users in database:')
    authTokens.forEach(token => {
      console.log(`- ${token.userEmail}: userId=${token.larkUserId}, calendar=${token.calendarId}`)
    })
    
    // Read trainers config
    const trainersPath = path.join(__dirname, '..', 'config', 'trainers.json')
    const trainersConfig = JSON.parse(fs.readFileSync(trainersPath, 'utf-8'))
    
    // Update trainers with matching emails
    let updatedCount = 0
    authTokens.forEach(token => {
      // Update trainers array
      trainersConfig.trainers = trainersConfig.trainers.map(trainer => {
        if (trainer.email === token.userEmail && token.larkUserId) {
          console.log(`Updating trainer ${trainer.email} with Lark ID: ${token.larkUserId}`)
          updatedCount++
          return {
            ...trainer,
            larkUserId: token.larkUserId,
            larkOpenId: token.larkUserId // Use same ID for both
          }
        }
        return trainer
      })
      
      // Update default trainer if matches
      if (trainersConfig.defaultTrainer && trainersConfig.defaultTrainer.email === token.userEmail && token.larkUserId) {
        console.log(`Updating default trainer with Lark ID: ${token.larkUserId}`)
        trainersConfig.defaultTrainer = {
          ...trainersConfig.defaultTrainer,
          larkUserId: token.larkUserId,
          larkOpenId: token.larkUserId
        }
      }
    })
    
    if (updatedCount > 0) {
      // Write back to file
      fs.writeFileSync(trainersPath, JSON.stringify(trainersConfig, null, 2))
      console.log(`\n✅ Updated ${updatedCount} trainer(s) in trainers.json`)
    } else {
      console.log('\n⚠️ No trainers updated (no matching emails or missing Lark IDs)')
    }
    
    // Do the same for installers
    const installersPath = path.join(__dirname, '..', 'config', 'installers.json')
    const installersConfig = JSON.parse(fs.readFileSync(installersPath, 'utf-8'))
    
    let installerUpdatedCount = 0
    authTokens.forEach(token => {
      // Update internal installers
      if (installersConfig.internal && installersConfig.internal.installers) {
        installersConfig.internal.installers = installersConfig.internal.installers.map(installer => {
          if (installer.email === token.userEmail && token.larkUserId) {
            console.log(`Updating installer ${installer.email} with Lark ID: ${token.larkUserId}`)
            installerUpdatedCount++
            return {
              ...installer,
              larkUserId: token.larkUserId,
              larkOpenId: token.larkUserId
            }
          }
          return installer
        })
      }
    })
    
    if (installerUpdatedCount > 0) {
      fs.writeFileSync(installersPath, JSON.stringify(installersConfig, null, 2))
      console.log(`✅ Updated ${installerUpdatedCount} installer(s) in installers.json`)
    }
    
  } catch (error) {
    console.error('Error syncing Lark IDs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

syncLarkIds()