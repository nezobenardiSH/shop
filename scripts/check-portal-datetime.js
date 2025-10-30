require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function checkPortalDateTime() {
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

    const merchantId = 'a0yQ9000003aAvBIAU'
    
    console.log('📊 Checking datetime values for merchant:', merchantId)
    console.log('=' . repeat(60))
    
    // Check Trainer record
    const trainerQuery = `
      SELECT Id, Name, Installation_Date__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    const trainerResult = await conn.query(trainerQuery)
    
    if (trainerResult.totalSize > 0) {
      const trainer = trainerResult.records[0]
      console.log('📋 Onboarding_Trainer__c:')
      console.log(`   Installation_Date__c (Date field): ${trainer.Installation_Date__c || 'NOT SET'}`)
    }
    
    // Check Portal record
    const portalQuery = `
      SELECT Id, Name, Installation_Date__c, Installation_Event_ID__c, 
             Installer_Name__c, Installer_Name__r.Name
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c = '${merchantId}'
      LIMIT 1
    `
    
    const portalResult = await conn.query(portalQuery)
    
    if (portalResult.totalSize > 0) {
      const portal = portalResult.records[0]
      console.log('\n📋 Onboarding_Portal__c:')
      console.log(`   Installation_Date__c (DateTime field): ${portal.Installation_Date__c || 'NOT SET'}`)
      console.log(`   Installation_Event_ID__c: ${portal.Installation_Event_ID__c || 'NOT SET'}`)
      console.log(`   Installer_Name__c (User): ${portal.Installer_Name__r ? portal.Installer_Name__r.Name : 'NOT SET'}`)
      
      if (portal.Installation_Date__c) {
        const date = new Date(portal.Installation_Date__c)
        console.log('\n🕒 DateTime breakdown:')
        console.log(`   Date: ${date.toISOString().split('T')[0]}`)
        console.log(`   Time: ${date.toISOString().split('T')[1]}`)
        console.log(`   Full ISO: ${date.toISOString()}`)
        console.log(`   Local: ${date.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' })} (KL time)`)
      }
    } else {
      console.log('\n⚠️  No Portal record found')
    }
    
    console.log('\n' + '=' . repeat(60))
    console.log('📌 Summary:')
    console.log('- Trainer has date-only field (no time component)')
    console.log('- Portal has datetime field (includes time)')
    console.log('- UI should display Portal datetime when available')

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  checkPortalDateTime()
}

module.exports = checkPortalDateTime