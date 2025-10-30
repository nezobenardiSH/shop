require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function testDirectUpdate() {
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
    const merchantId = 'a0yQ9000003aAvBIAU' // activate175
    const testDate = '2025-11-05'
    const testInstaller = 'Nejojo' // Use a valid picklist value
    const testEventId = 'test-event-id-12345'
    
    console.log('📊 Testing direct Salesforce updates for Merchant ID:', merchantId)
    console.log('=' . repeat(60))
    
    // 1. First, check current state
    console.log('\n1️⃣  BEFORE UPDATE - Checking current state...')
    const beforeQuery = `
      SELECT Id, Name, Installation_Date__c, Assigned_Installer__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    const beforeResult = await conn.query(beforeQuery)
    
    if (beforeResult.totalSize === 0) {
      console.log('❌ No Trainer record found with ID:', merchantId)
      return
    }
    
    const trainerBefore = beforeResult.records[0]
    console.log('Current Trainer record:')
    console.log(`   Name: ${trainerBefore.Name}`)
    console.log(`   Installation_Date__c: ${trainerBefore.Installation_Date__c || 'NOT SET'}`)
    console.log(`   Assigned_Installer__c: ${trainerBefore.Assigned_Installer__c || 'NOT SET'}`)
    
    // 2. Update the Onboarding_Trainer__c record
    console.log('\n2️⃣  UPDATING Onboarding_Trainer__c...')
    console.log(`   Setting Installation_Date__c to: ${testDate}`)
    console.log(`   Setting Assigned_Installer__c to: ${testInstaller}`)
    
    try {
      // First try updating just the date
      console.log('\n   Attempting to update Installation_Date__c only...')
      const dateUpdateResult = await conn.sobject('Onboarding_Trainer__c').update({
        Id: merchantId,
        Installation_Date__c: testDate
      })
      
      console.log('✅ Date update result:', JSON.stringify(dateUpdateResult))
      
      if (dateUpdateResult.success) {
        console.log('✅ Successfully updated Installation_Date__c!')
        
        // Now try updating with a valid picklist value
        console.log('\n   Attempting to update Assigned_Installer__c with valid picklist value "T2"...')
        const installerUpdateResult = await conn.sobject('Onboarding_Trainer__c').update({
          Id: merchantId,
          Assigned_Installer__c: 'T2'  // Use valid picklist value
        })
        
        console.log('✅ Installer update result:', JSON.stringify(installerUpdateResult))
        
        if (installerUpdateResult.success) {
          console.log('✅ Successfully updated Assigned_Installer__c!')
        } else {
          console.log('❌ Installer update failed:', installerUpdateResult.errors)
        }
      } else {
        console.log('❌ Date update failed:', dateUpdateResult.errors)
      }
    } catch (updateError) {
      console.log('❌ Error updating Trainer:', updateError.message)
      console.log('Full error:', updateError)
    }
    
    // 3. Check Portal record and update/create it
    console.log('\n3️⃣  CHECKING/UPDATING Onboarding_Portal__c...')
    const portalQuery = `
      SELECT Id, Name, Installation_Event_ID__c
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c = '${merchantId}'
      LIMIT 1
    `
    
    const portalResult = await conn.query(portalQuery)
    
    if (portalResult.totalSize > 0) {
      const portalId = portalResult.records[0].Id
      console.log(`Found Portal record: ${portalId}`)
      console.log(`   Current Installation_Event_ID__c: ${portalResult.records[0].Installation_Event_ID__c || 'NOT SET'}`)
      console.log(`   Setting Installation_Event_ID__c to: ${testEventId}`)
      
      try {
        const portalUpdateResult = await conn.sobject('Onboarding_Portal__c').update({
          Id: portalId,
          Installation_Event_ID__c: testEventId
        })
        
        console.log('✅ Portal update result:', JSON.stringify(portalUpdateResult))
        
        if (portalUpdateResult.success) {
          console.log('✅ Successfully updated Portal Event ID!')
        } else {
          console.log('❌ Portal update failed:', portalUpdateResult.errors)
        }
      } catch (portalError) {
        console.log('❌ Error updating Portal:', portalError.message)
      }
    } else {
      console.log('⚠️  No Portal record found, creating one...')
      
      try {
        const createResult = await conn.sobject('Onboarding_Portal__c').create({
          Name: `Portal - ${trainerBefore.Name}`,
          Onboarding_Trainer_Record__c: merchantId,
          Installation_Event_ID__c: testEventId
        })
        
        console.log('✅ Portal create result:', JSON.stringify(createResult))
        
        if (createResult.success) {
          console.log(`✅ Created new Portal record: ${createResult.id}`)
        } else {
          console.log('❌ Portal creation failed:', createResult.errors)
        }
      } catch (createError) {
        console.log('❌ Error creating Portal:', createError.message)
      }
    }
    
    // 4. Verify the updates
    console.log('\n4️⃣  AFTER UPDATE - Verifying changes...')
    const afterQuery = `
      SELECT Id, Name, Installation_Date__c, Assigned_Installer__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    const afterResult = await conn.query(afterQuery)
    const trainerAfter = afterResult.records[0]
    
    console.log('Updated Trainer record:')
    console.log(`   Name: ${trainerAfter.Name}`)
    console.log(`   Installation_Date__c: ${trainerAfter.Installation_Date__c || 'NOT SET'}`)
    console.log(`   Assigned_Installer__c: ${trainerAfter.Assigned_Installer__c || 'NOT SET'}`)
    
    // Check Portal too
    const portalAfterResult = await conn.query(portalQuery)
    if (portalAfterResult.totalSize > 0) {
      console.log('\nPortal record:')
      console.log(`   Installation_Event_ID__c: ${portalAfterResult.records[0].Installation_Event_ID__c || 'NOT SET'}`)
    }
    
    console.log('\n' + '=' . repeat(60))
    console.log('✅ Test completed!')
    console.log('\nSummary:')
    console.log(`- Installation_Date__c: ${trainerBefore.Installation_Date__c || 'null'} → ${trainerAfter.Installation_Date__c || 'null'}`)
    console.log(`- Assigned_Installer__c: ${trainerBefore.Assigned_Installer__c || 'null'} → ${trainerAfter.Assigned_Installer__c || 'null'}`)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  testDirectUpdate()
}

module.exports = testDirectUpdate