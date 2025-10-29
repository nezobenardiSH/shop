/**
 * Quick script to check if a merchant has an Onboarding_Portal__c record
 * 
 * Usage:
 *   node scripts/check-portal-record.js <merchantId>
 * 
 * Example:
 *   node scripts/check-portal-record.js a0yQ9000003aAvBIAU
 */

require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function checkPortalRecord() {
  const merchantId = process.argv[2]

  if (!merchantId) {
    console.error('❌ Error: Please provide a merchant ID')
    console.log('\nUsage:')
    console.log('  node scripts/check-portal-record.js <merchantId>')
    console.log('\nExample:')
    console.log('  node scripts/check-portal-record.js a0yQ9000003aAvBIAU')
    process.exit(1)
  }

  console.log(`🔍 Checking Portal record for merchant: ${merchantId}\n`)

  // Connect to Salesforce
  const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL || process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
  })

  try {
    // Login to Salesforce
    const username = process.env.SF_USERNAME || process.env.SALESFORCE_USERNAME
    const password = process.env.SF_PASSWORD || process.env.SALESFORCE_PASSWORD
    const token = process.env.SF_TOKEN || process.env.SALESFORCE_TOKEN
    
    await conn.login(username, password + token)
    console.log('✅ Connected to Salesforce\n')

    // First, get the merchant name
    const trainerQuery = `
      SELECT Id, Name, CreatedDate
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    const trainerResult = await conn.query(trainerQuery)

    if (trainerResult.totalSize === 0) {
      console.log('❌ Merchant not found with ID:', merchantId)
      process.exit(1)
    }

    const trainer = trainerResult.records[0]
    console.log('📋 Merchant Details:')
    console.log(`   Name: ${trainer.Name}`)
    console.log(`   ID: ${trainer.Id}`)
    console.log(`   Created: ${trainer.CreatedDate}\n`)

    // Check for Portal record
    const portalQuery = `
      SELECT Id, Name, Onboarding_Trainer_Record__c, Training_Event_ID__c, Installation_Event_ID__c, CreatedDate
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c = '${merchantId}'
      LIMIT 1
    `
    const portalResult = await conn.query(portalQuery)

    if (portalResult.totalSize === 0) {
      console.log('❌ NO PORTAL RECORD FOUND')
      console.log('\n💡 To create a Portal record, run:')
      console.log('   node scripts/create-portal-records.js')
    } else {
      const portal = portalResult.records[0]
      console.log('✅ PORTAL RECORD EXISTS')
      console.log('\n📋 Portal Details:')
      console.log(`   Portal ID: ${portal.Id}`)
      console.log(`   Portal Name: ${portal.Name}`)
      console.log(`   Created: ${portal.CreatedDate}`)
      console.log(`   Training Event ID: ${portal.Training_Event_ID__c || '(not set)'}`)
      console.log(`   Installation Event ID: ${portal.Installation_Event_ID__c || '(not set)'}`)
      
      if (portal.Training_Event_ID__c || portal.Installation_Event_ID__c) {
        console.log('\n✅ Merchant has booked appointments')
      } else {
        console.log('\n⚠️  Merchant has not booked any appointments yet')
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

checkPortalRecord()
  .then(() => {
    console.log('\n✅ Check complete!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Unhandled error:', error)
    process.exit(1)
  })

