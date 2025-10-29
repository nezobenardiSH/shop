require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function testFinalBooking() {
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
    const testDateTime = '2025-11-06T10:00:00.000Z'  // Full datetime for Portal
    const testDateOnly = '2025-11-06'  // Date only for Trainer
    const testInstallerUserId = '005Q900000hLy0PIAS'  // Nezo Benardi's User ID
    const testEventId = `test-event-${Date.now()}`
    
    console.log('🧪 TESTING FINAL BOOKING FLOW')
    console.log('=' . repeat(60))
    console.log(`Merchant ID: ${merchantId}`)
    console.log(`Test DateTime: ${testDateTime}`)
    console.log(`Test Date Only: ${testDateOnly}`)
    console.log(`Test Installer User ID: ${testInstallerUserId}`)
    console.log(`Test Event ID: ${testEventId}`)
    console.log('=' . repeat(60))
    
    // 1. Check current state
    console.log('\n1️⃣  BEFORE UPDATE - Checking current state...\n')
    
    // Check Trainer record
    const trainerQuery = `
      SELECT Id, Name, Installation_Date__c, Assigned_Installer__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    const trainerResult = await conn.query(trainerQuery)
    
    if (trainerResult.totalSize === 0) {
      console.log('❌ No Trainer record found with ID:', merchantId)
      return
    }
    
    const trainerBefore = trainerResult.records[0]
    console.log('📋 Trainer record BEFORE:')
    console.log(`   Name: ${trainerBefore.Name}`)
    console.log(`   Installation_Date__c: ${trainerBefore.Installation_Date__c || 'NOT SET'}`)
    console.log(`   Assigned_Installer__c: ${trainerBefore.Assigned_Installer__c || 'NOT SET'}`)
    
    // Check Portal record
    const portalQuery = `
      SELECT Id, Name, Installation_Event_ID__c, Installation_Date__c, Installer_Name__c
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c = '${merchantId}'
      LIMIT 1
    `
    
    const portalResult = await conn.query(portalQuery)
    
    let portalId = null
    if (portalResult.totalSize > 0) {
      const portalBefore = portalResult.records[0]
      portalId = portalBefore.Id
      console.log('\n📋 Portal record BEFORE:')
      console.log(`   ID: ${portalBefore.Id}`)
      console.log(`   Name: ${portalBefore.Name}`)
      console.log(`   Installation_Event_ID__c: ${portalBefore.Installation_Event_ID__c || 'NOT SET'}`)
      console.log(`   Installation_Date__c: ${portalBefore.Installation_Date__c || 'NOT SET'}`)
      console.log(`   Installer_Name__c: ${portalBefore.Installer_Name__c || 'NOT SET'}`)
    } else {
      console.log('\n⚠️  No Portal record found - will be auto-created')
    }
    
    // 2. Simulate what the booking flow does
    console.log('\n2️⃣  SIMULATING BOOKING FLOW UPDATES...\n')
    
    // Update Trainer with date only
    console.log('📝 Updating Onboarding_Trainer__c with date only...')
    try {
      const trainerUpdateResult = await conn.sobject('Onboarding_Trainer__c').update({
        Id: merchantId,
        Installation_Date__c: testDateOnly
        // NOT updating Assigned_Installer__c as it's a restricted picklist
      })
      
      if (trainerUpdateResult.success) {
        console.log('✅ Trainer date updated successfully')
      } else {
        console.log('❌ Trainer update failed:', trainerUpdateResult.errors)
      }
    } catch (trainerError) {
      console.log('❌ Error updating Trainer:', trainerError.message)
    }
    
    // Update or create Portal record
    console.log('\n📝 Updating/Creating Onboarding_Portal__c with full data...')
    
    if (portalId) {
      // Update existing Portal record
      try {
        const portalUpdateResult = await conn.sobject('Onboarding_Portal__c').update({
          Id: portalId,
          Installation_Event_ID__c: testEventId,
          Installation_Date__c: testDateTime,
          Installer_Name__c: testInstallerUserId  // Use User ID
        })
        
        if (portalUpdateResult.success) {
          console.log('✅ Portal record updated successfully')
        } else {
          console.log('❌ Portal update failed:', portalUpdateResult.errors)
        }
      } catch (portalError) {
        console.log('❌ Error updating Portal:', portalError.message)
      }
    } else {
      // Create new Portal record
      try {
        const createResult = await conn.sobject('Onboarding_Portal__c').create({
          Name: `Portal - ${trainerBefore.Name}`,
          Onboarding_Trainer_Record__c: merchantId,
          Installation_Event_ID__c: testEventId,
          Installation_Date__c: testDateTime,
          Installer_Name__c: testInstallerUserId  // Use User ID
        })
        
        if (createResult.success) {
          console.log(`✅ Created new Portal record: ${createResult.id}`)
          portalId = createResult.id
        } else {
          console.log('❌ Portal creation failed:', createResult.errors)
        }
      } catch (createError) {
        console.log('❌ Error creating Portal:', createError.message)
      }
    }
    
    // 3. Verify the updates
    console.log('\n3️⃣  AFTER UPDATE - Verifying changes...\n')
    
    // Check Trainer after update
    const trainerAfterResult = await conn.query(trainerQuery)
    const trainerAfter = trainerAfterResult.records[0]
    
    console.log('📋 Trainer record AFTER:')
    console.log(`   Name: ${trainerAfter.Name}`)
    console.log(`   Installation_Date__c: ${trainerAfter.Installation_Date__c || 'NOT SET'}`)
    console.log(`   Assigned_Installer__c: ${trainerAfter.Assigned_Installer__c || 'NOT SET'}`)
    
    // Check Portal after update
    const portalAfterResult = await conn.query(portalQuery)
    if (portalAfterResult.totalSize > 0) {
      const portalAfter = portalAfterResult.records[0]
      console.log('\n📋 Portal record AFTER:')
      console.log(`   ID: ${portalAfter.Id}`)
      console.log(`   Name: ${portalAfter.Name}`)
      console.log(`   Installation_Event_ID__c: ${portalAfter.Installation_Event_ID__c || 'NOT SET'}`)
      console.log(`   Installation_Date__c: ${portalAfter.Installation_Date__c || 'NOT SET'}`)
      console.log(`   Installer_Name__c: ${portalAfter.Installer_Name__c || 'NOT SET'}`)
    }
    
    console.log('\n' + '=' . repeat(60))
    console.log('✅ TEST RESULTS:\n')
    
    // Verify Trainer updates
    const trainerDateUpdated = trainerAfter.Installation_Date__c === testDateOnly
    console.log(`Trainer Installation_Date__c: ${trainerDateUpdated ? '✅ UPDATED' : '❌ NOT UPDATED'}`)
    console.log(`   Expected: ${testDateOnly}`)
    console.log(`   Actual: ${trainerAfter.Installation_Date__c || 'null'}`)
    
    // Verify Portal updates
    if (portalAfterResult.totalSize > 0) {
      const portalAfter = portalAfterResult.records[0]
      const eventIdUpdated = portalAfter.Installation_Event_ID__c === testEventId
      const dateTimeUpdated = portalAfter.Installation_Date__c === testDateTime
      const installerUpdated = portalAfter.Installer_Name__c === testInstallerUserId
      
      console.log(`\nPortal Installation_Event_ID__c: ${eventIdUpdated ? '✅ UPDATED' : '❌ NOT UPDATED'}`)
      console.log(`   Expected: ${testEventId}`)
      console.log(`   Actual: ${portalAfter.Installation_Event_ID__c || 'null'}`)
      
      console.log(`\nPortal Installation_Date__c: ${dateTimeUpdated ? '✅ UPDATED' : '❌ NOT UPDATED'}`)
      console.log(`   Expected: ${testDateTime}`)
      console.log(`   Actual: ${portalAfter.Installation_Date__c || 'null'}`)
      
      console.log(`\nPortal Installer_Name__c: ${installerUpdated ? '✅ UPDATED' : '❌ NOT UPDATED'}`)
      console.log(`   Expected: ${testInstallerUserId}`)
      console.log(`   Actual: ${portalAfter.Installer_Name__c || 'null'}`)
    } else {
      console.log('\n❌ No Portal record found after update')
    }
    
    console.log('\n' + '=' . repeat(60))
    console.log('📌 SUMMARY:')
    console.log('- Trainer date field accepts date-only format')
    console.log('- Portal fields store datetime, event ID, and installer name')
    console.log('- UI should display Portal data when available')
    console.log('- Booking flow creates Portal record if missing')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  testFinalBooking()
}

module.exports = testFinalBooking