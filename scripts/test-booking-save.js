require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function testBookingSave() {
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

    // Test with a specific merchant
    const merchantId = 'a0yQ9000003aAvBIAU' // Example merchant ID
    
    console.log('📊 Testing with Merchant ID:', merchantId)
    console.log('=' . repeat(50))
    
    // 1. Check Trainer record
    console.log('\n1️⃣  Checking Onboarding_Trainer__c record...')
    const trainerQuery = `
      SELECT Id, Name, Installation_Date__c, Assigned_Installer__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    const trainerResult = await conn.query(trainerQuery)
    
    if (trainerResult.totalSize > 0) {
      const trainer = trainerResult.records[0]
      console.log('✅ Found Trainer record:')
      console.log(`   Name: ${trainer.Name}`)
      console.log(`   Installation_Date__c: ${trainer.Installation_Date__c || 'NOT SET'}`)
      console.log(`   Assigned_Installer__c: ${trainer.Assigned_Installer__c || 'NOT SET'}`)
    } else {
      console.log('❌ No Trainer record found with ID:', merchantId)
      return
    }
    
    // 2. Check Portal record
    console.log('\n2️⃣  Checking Onboarding_Portal__c record...')
    const portalQuery = `
      SELECT Id, Name, Installation_Event_ID__c, Training_Event_ID__c, Onboarding_Trainer_Record__c
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c = '${merchantId}'
      LIMIT 1
    `
    
    const portalResult = await conn.query(portalQuery)
    
    if (portalResult.totalSize > 0) {
      const portal = portalResult.records[0]
      console.log('✅ Found Portal record:')
      console.log(`   ID: ${portal.Id}`)
      console.log(`   Name: ${portal.Name}`)
      console.log(`   Installation_Event_ID__c: ${portal.Installation_Event_ID__c || 'NOT SET'}`)
      console.log(`   Training_Event_ID__c: ${portal.Training_Event_ID__c || 'NOT SET'}`)
    } else {
      console.log('⚠️  No Portal record found for this merchant')
      console.log('   The booking flow will auto-create one when booking')
    }
    
    console.log('\n' + '=' . repeat(50))
    console.log('📋 Summary:')
    console.log('- Trainer fields (Date & Installer): Should be saved during booking')
    console.log('- Portal Event ID: Should be saved (auto-creates Portal if missing)')
    console.log('- External booking bug: Fixed (uses Id instead of Name)')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  testBookingSave()
}

module.exports = testBookingSave