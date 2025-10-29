require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function ensurePortalRecords() {
  try {
    console.log('🔐 Connecting to Salesforce...')
    
    const conn = new jsforce.Connection({
      loginUrl: process.env.SF_LOGIN_URL || process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
    })

    const username = process.env.SF_USERNAME || process.env.SALESFORCE_USERNAME
    const password = process.env.SF_PASSWORD || process.env.SALESFORCE_PASSWORD
    const token = process.env.SF_TOKEN || process.env.SALESFORCE_SECURITY_TOKEN

    await conn.login(username, password + token)

    console.log('✅ Connected to Salesforce\n')

    // Find all trainers without portal records
    console.log('📊 Checking for Onboarding_Trainer__c records without Portal records...\n')
    
    const trainersQuery = `
      SELECT Id, Name, Installation_Date__c, Assigned_Installer__c
      FROM Onboarding_Trainer__c
      WHERE Id NOT IN (
        SELECT Onboarding_Trainer_Record__c 
        FROM Onboarding_Portal__c 
        WHERE Onboarding_Trainer_Record__c != null
      )
      LIMIT 100
    `
    
    const orphanTrainers = await conn.query(trainersQuery)
    
    if (orphanTrainers.totalSize === 0) {
      console.log('✅ All Onboarding_Trainer__c records already have Portal records!')
      return
    }

    console.log(`⚠️  Found ${orphanTrainers.totalSize} trainers without Portal records:\n`)
    
    orphanTrainers.records.forEach((trainer, idx) => {
      console.log(`${idx + 1}. ${trainer.Name} (ID: ${trainer.Id})`)
      if (trainer.Installation_Date__c) {
        console.log(`   Installation Date: ${trainer.Installation_Date__c}`)
      }
      if (trainer.Assigned_Installer__c) {
        console.log(`   Assigned Installer: ${trainer.Assigned_Installer__c}`)
      }
    })

    // Ask for confirmation
    console.log('\n🔄 Creating Portal records for these trainers...\n')

    const portalRecordsToCreate = orphanTrainers.records.map(trainer => ({
      Name: `Portal - ${trainer.Name}`,
      Onboarding_Trainer_Record__c: trainer.Id
    }))

    // Create in batches of 10
    const batchSize = 10
    let created = 0

    for (let i = 0; i < portalRecordsToCreate.length; i += batchSize) {
      const batch = portalRecordsToCreate.slice(i, i + batchSize)
      
      try {
        const results = await conn.sobject('Onboarding_Portal__c').create(batch)
        
        // Handle both single result and array of results
        const resultsArray = Array.isArray(results) ? results : [results]
        
        resultsArray.forEach((result, idx) => {
          if (result.success) {
            created++
            console.log(`✅ Created Portal record ${result.id} for ${batch[idx].Name}`)
          } else {
            console.log(`❌ Failed to create Portal record for ${batch[idx].Name}:`, result.errors)
          }
        })
      } catch (error) {
        console.error(`❌ Batch creation failed:`, error.message)
      }
    }

    console.log(`\n✨ Successfully created ${created} Portal records!`)

    // Verify the creation
    console.log('\n🔍 Verifying Portal records...')
    
    const verifyQuery = `
      SELECT COUNT() 
      FROM Onboarding_Portal__c
    `
    
    const countResult = await conn.query(verifyQuery)
    console.log(`Total Portal records in system: ${countResult.totalSize}`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  ensurePortalRecords()
}

module.exports = ensurePortalRecords