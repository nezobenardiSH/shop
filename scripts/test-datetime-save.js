require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function testDateTimeSave() {
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
    const testDate = '2025-11-15'
    const testTimeSlot = { start: '14:00', end: '16:00' }  // 2:00 PM - 4:00 PM
    const testDateTime = `${testDate}T${testTimeSlot.start}:00+08:00`  // Full datetime with KL timezone
    
    console.log('🧪 TESTING DATETIME SAVE')
    console.log('=' . repeat(60))
    console.log(`Merchant ID: ${merchantId}`)
    console.log(`Test Date: ${testDate}`)
    console.log(`Test Time Slot: ${testTimeSlot.start} - ${testTimeSlot.end}`)
    console.log(`Full DateTime: ${testDateTime}`)
    console.log('=' . repeat(60))
    
    // Check Portal record
    const portalQuery = `
      SELECT Id, Name, Installation_Date__c
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c = '${merchantId}'
      LIMIT 1
    `
    
    const portalResult = await conn.query(portalQuery)
    
    if (portalResult.totalSize > 0) {
      const portal = portalResult.records[0]
      console.log('\n📋 Current Portal Installation_Date__c:')
      console.log(`   ${portal.Installation_Date__c || 'NOT SET'}`)
      
      console.log('\n📝 Updating Portal with new datetime...')
      
      try {
        const updateResult = await conn.sobject('Onboarding_Portal__c').update({
          Id: portal.Id,
          Installation_Date__c: testDateTime
        })
        
        if (updateResult.success) {
          console.log('✅ Portal datetime updated successfully')
          
          // Query again to verify
          const verifyResult = await conn.query(portalQuery)
          const updatedPortal = verifyResult.records[0]
          
          console.log('\n📋 Updated Portal Installation_Date__c:')
          console.log(`   ${updatedPortal.Installation_Date__c}`)
          
          if (updatedPortal.Installation_Date__c) {
            const date = new Date(updatedPortal.Installation_Date__c)
            console.log('\n🕒 DateTime breakdown:')
            console.log(`   UTC: ${date.toISOString()}`)
            console.log(`   KL Time: ${date.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour12: true })}`)
            
            // Check if time component was saved correctly
            const hours = date.getUTCHours()
            const expectedHours = 14 - 8  // 14:00 KL time = 06:00 UTC (UTC+8)
            
            if (hours === expectedHours) {
              console.log(`   ✅ Time component saved correctly (${testTimeSlot.start} KL time)`)
            } else {
              console.log(`   ❌ Time component incorrect. Expected ${expectedHours}:00 UTC, got ${hours}:00 UTC`)
            }
          }
        } else {
          console.log('❌ Portal update failed:', updateResult.errors)
        }
      } catch (updateError) {
        console.log('❌ Error updating Portal:', updateError.message)
      }
    } else {
      console.log('\n⚠️  No Portal record found for this merchant')
    }
    
    console.log('\n' + '=' . repeat(60))
    console.log('📌 Summary:')
    console.log('- The system should save both date AND time to Portal')
    console.log('- Format: YYYY-MM-DDTHH:MM:SS+08:00 (with KL timezone)')
    console.log('- This allows showing exact appointment time in the UI')

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  testDateTimeSave()
}

module.exports = testDateTimeSave