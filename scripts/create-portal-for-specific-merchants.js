/**
 * Create Portal records for specific merchants by name
 * 
 * Usage:
 *   node scripts/create-portal-for-specific-merchants.js
 */

require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

// List of merchant names to create Portal records for
const MERCHANT_NAMES = [
  'activate175'
]

async function createPortalRecords() {
  console.log('🚀 Creating Portal Records for Specific Merchants...\n')

  // Connect to Salesforce
  const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL || process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
  })

  try {
    // Login to Salesforce
    console.log('🔐 Logging into Salesforce...')
    const username = process.env.SF_USERNAME || process.env.SALESFORCE_USERNAME
    const password = process.env.SF_PASSWORD || process.env.SALESFORCE_PASSWORD
    const token = process.env.SF_TOKEN || process.env.SALESFORCE_TOKEN
    
    if (!username || !password || !token) {
      throw new Error('Missing Salesforce credentials in .env.local')
    }

    await conn.login(username, password + token)
    console.log(`   Username: ${username}`)
    console.log(`   Login URL: ${conn.instanceUrl}`)
    console.log('✅ Successfully logged in to Salesforce\n')

    // Step 1: Query for the specific merchants
    console.log('📋 Querying for specific merchants...')
    console.log(`   Looking for merchants with name LIKE: ${MERCHANT_NAMES.join(', ')}\n`)

    const trainerQuery = `
      SELECT Id, Name
      FROM Onboarding_Trainer__c
      WHERE Name LIKE '%activate175%'
      ORDER BY Name
    `
    const trainerResult = await conn.query(trainerQuery)
    console.log(`✅ Found ${trainerResult.totalSize} matching merchants\n`)

    if (trainerResult.totalSize === 0) {
      console.log('❌ No merchants found with those names')
      return
    }

    // Display found merchants
    console.log('📋 Found Merchants:')
    trainerResult.records.forEach((trainer, index) => {
      console.log(`   ${index + 1}. ${trainer.Name} (${trainer.Id})`)
    })
    console.log()

    // Step 2: Check which ones already have Portal records
    console.log('📋 Checking for existing Portal records...')
    const trainerIds = trainerResult.records.map(t => `'${t.Id}'`).join(',')
    const portalQuery = `
      SELECT Id, Onboarding_Trainer_Record__c
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c IN (${trainerIds})
    `
    const portalResult = await conn.query(portalQuery)
    console.log(`✅ Found ${portalResult.totalSize} existing Portal records\n`)

    // Create a Set of trainer IDs that already have Portal records
    const existingPortalTrainerIds = new Set(
      portalResult.records.map(p => p.Onboarding_Trainer_Record__c)
    )

    // Filter trainers that need Portal records
    const trainersNeedingPortal = trainerResult.records.filter(
      trainer => !existingPortalTrainerIds.has(trainer.Id)
    )

    console.log('📊 Summary:')
    console.log(`   Total Merchants Found: ${trainerResult.totalSize}`)
    console.log(`   Already have Portal: ${portalResult.totalSize}`)
    console.log(`   Need Portal created: ${trainersNeedingPortal.length}\n`)

    if (trainersNeedingPortal.length === 0) {
      console.log('✅ All merchants already have Portal records. Nothing to do!')
      return
    }

    // Step 3: Create Portal records for merchants that don't have them
    console.log('🔨 Creating Portal records...\n')

    const portalRecordsToCreate = trainersNeedingPortal.map(trainer => ({
      Name: `Portal - ${trainer.Name}`,
      Onboarding_Trainer_Record__c: trainer.Id
    }))

    let successCount = 0
    let failCount = 0

    // Create records in batches of 200 (Salesforce limit)
    const batchSize = 200
    for (let i = 0; i < portalRecordsToCreate.length; i += batchSize) {
      const batch = portalRecordsToCreate.slice(i, i + batchSize)
      console.log(`   Creating batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)...`)

      const results = await conn.sobject('Onboarding_Portal__c').create(batch)
      
      // Count successes and failures
      const resultsArray = Array.isArray(results) ? results : [results]
      resultsArray.forEach((result, index) => {
        if (result.success) {
          successCount++
          const trainer = trainersNeedingPortal[i + index]
          console.log(`   ✅ Created Portal for: ${trainer.Name}`)
        } else {
          failCount++
          const trainer = trainersNeedingPortal[i + index]
          console.log(`   ❌ Failed for ${trainer.Name}: ${result.errors.join(', ')}`)
        }
      })
    }

    console.log('\n📊 Final Results:')
    console.log(`   ✅ Successfully created: ${successCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   📈 Success rate: ${((successCount / (successCount + failCount)) * 100).toFixed(2)}%`)

    // Step 4: Display merchants that already had Portal records
    if (existingPortalTrainerIds.size > 0) {
      console.log('\n📋 Merchants that already had Portal records:')
      trainerResult.records.forEach(trainer => {
        if (existingPortalTrainerIds.has(trainer.Id)) {
          console.log(`   ✅ ${trainer.Name} (already exists)`)
        }
      })
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    throw error
  }
}

createPortalRecords()
  .then(() => {
    console.log('\n✅ Script completed successfully!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

