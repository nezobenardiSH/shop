/**
 * One-Time Data Migration Script
 * Creates Onboarding_Portal__c records for all existing Onboarding_Trainer__c records
 * that don't already have a linked Portal record.
 * 
 * Usage:
 *   node scripts/create-portal-records.js
 * 
 * What it does:
 * 1. Queries all Onboarding_Trainer__c records
 * 2. For each trainer, checks if an Onboarding_Portal__c record exists
 * 3. If not, creates a new Portal record with Onboarding_Trainer_Record__c = trainer.Id
 * 4. Reports success/failure for each record
 */

require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function createPortalRecords() {
  console.log('🚀 Starting Portal Record Migration Script...\n')

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

    console.log('   Username:', username)
    console.log('   Login URL:', conn.loginUrl)

    await conn.login(username, password + token)
    console.log('✅ Successfully logged in to Salesforce\n')

    // Step 1: Query Onboarding_Trainer__c records created in the last 1 month
    console.log('📋 Querying Onboarding_Trainer__c records created in the last 1 month...')

    // Calculate date 1 month ago
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const oneMonthAgoISO = oneMonthAgo.toISOString()

    console.log(`   Filtering for records created after: ${oneMonthAgoISO}\n`)

    const trainerQuery = `
      SELECT Id, Name, CreatedDate
      FROM Onboarding_Trainer__c
      WHERE CreatedDate >= ${oneMonthAgoISO}
      ORDER BY CreatedDate DESC
    `
    const trainerResult = await conn.query(trainerQuery)
    console.log(`✅ Found ${trainerResult.totalSize} Onboarding_Trainer__c records created in the last month\n`)

    if (trainerResult.totalSize === 0) {
      console.log('⚠️ No Onboarding_Trainer__c records found. Exiting.')
      return
    }

    // Step 2: Query all existing Portal records
    console.log('📋 Querying existing Onboarding_Portal__c records...')
    const portalQuery = `
      SELECT Id, Onboarding_Trainer_Record__c
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c != null
    `
    const portalResult = await conn.query(portalQuery)
    console.log(`✅ Found ${portalResult.totalSize} existing Portal records\n`)

    // Create a Set of trainer IDs that already have Portal records
    const existingPortalTrainerIds = new Set(
      portalResult.records.map(portal => portal.Onboarding_Trainer_Record__c)
    )

    // Step 3: Find trainers without Portal records
    const trainersNeedingPortal = trainerResult.records.filter(
      trainer => !existingPortalTrainerIds.has(trainer.Id)
    )

    console.log(`📊 Summary:`)
    console.log(`   Total Trainers: ${trainerResult.totalSize}`)
    console.log(`   Already have Portal: ${existingPortalTrainerIds.size}`)
    console.log(`   Need Portal created: ${trainersNeedingPortal.length}`)
    console.log(`   (Note: Salesforce query limit is 2000 records per query)\n`)

    if (trainersNeedingPortal.length === 0) {
      console.log('✅ All trainers already have Portal records. Nothing to do!')
      return
    }

    // Step 4: Create Portal records for trainers that don't have one
    console.log(`🔨 Creating ${trainersNeedingPortal.length} Portal records...\n`)

    const portalRecordsToCreate = trainersNeedingPortal.map(trainer => ({
      Name: `Portal - ${trainer.Name}`,
      Onboarding_Trainer_Record__c: trainer.Id
    }))

    // Create records in batches of 200 (Salesforce limit)
    const batchSize = 200
    let successCount = 0
    let errorCount = 0
    const errors = []

    for (let i = 0; i < portalRecordsToCreate.length; i += batchSize) {
      const batch = portalRecordsToCreate.slice(i, i + batchSize)
      console.log(`   Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)...`)

      try {
        const results = await conn.sobject('Onboarding_Portal__c').create(batch)
        
        // Handle both single result and array of results
        const resultArray = Array.isArray(results) ? results : [results]
        
        resultArray.forEach((result, index) => {
          if (result.success) {
            successCount++
            const trainer = trainersNeedingPortal[i + index]
            console.log(`   ✅ Created Portal for: ${trainer.Name} (${trainer.Id})`)
          } else {
            errorCount++
            const trainer = trainersNeedingPortal[i + index]
            console.log(`   ❌ Failed for: ${trainer.Name} (${trainer.Id})`)
            console.log(`      Error: ${result.errors.join(', ')}`)
            errors.push({
              trainer: trainer.Name,
              trainerId: trainer.Id,
              error: result.errors.join(', ')
            })
          }
        })
      } catch (batchError) {
        console.error(`   ❌ Batch error:`, batchError.message)
        errorCount += batch.length
        batch.forEach((record, index) => {
          const trainer = trainersNeedingPortal[i + index]
          errors.push({
            trainer: trainer.Name,
            trainerId: trainer.Id,
            error: batchError.message
          })
        })
      }
    }

    // Step 5: Report results
    console.log('\n' + '='.repeat(60))
    console.log('📊 MIGRATION COMPLETE')
    console.log('='.repeat(60))
    console.log(`✅ Successfully created: ${successCount} Portal records`)
    console.log(`❌ Failed: ${errorCount} Portal records`)
    console.log('='.repeat(60))

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:')
      errors.forEach((err, index) => {
        console.log(`\n${index + 1}. Trainer: ${err.trainer} (${err.trainerId})`)
        console.log(`   Error: ${err.error}`)
      })
    }

    // Step 6: Verify the migration
    console.log('\n🔍 Verifying migration...')
    const verifyQuery = `
      SELECT COUNT(Id) totalPortals
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c != null
    `
    const verifyResult = await conn.query(verifyQuery)
    console.log(`✅ Total Portal records with trainer links: ${verifyResult.records[0].totalPortals}`)

    console.log('\n✅ Migration script completed!')

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Run the migration
createPortalRecords()
  .then(() => {
    console.log('\n👋 Exiting...')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Unhandled error:', error)
    process.exit(1)
  })

