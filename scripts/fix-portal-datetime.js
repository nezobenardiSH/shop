require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function fixPortalDateTime() {
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
    
    // Following timezone-handling-rules.md: Use Singapore timezone explicitly
    const testDate = '2025-11-12'
    const testTimeSlot = { start: '14:00', end: '16:00' }  // 2:00 PM - 4:00 PM
    const installationDateTime = `${testDate}T${testTimeSlot.start}:00+08:00`  // Singapore timezone
    
    console.log('🔧 FIXING PORTAL DATETIME')
    console.log('=' . repeat(60))
    console.log(`Following timezone-handling-rules.md guidelines:`)
    console.log(`- Always use Singapore timezone (+08:00)`)
    console.log(`- Don't use toISOString() (converts to UTC and shifts date)`)
    console.log('=' . repeat(60))
    console.log(`\nDate: ${testDate}`)
    console.log(`Time Slot: ${testTimeSlot.start} - ${testTimeSlot.end}`)
    console.log(`DateTime to save: ${installationDateTime}`)
    
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
      
      console.log('\n📝 Updating Portal with proper datetime...')
      
      try {
        const updateResult = await conn.sobject('Onboarding_Portal__c').update({
          Id: portal.Id,
          Installation_Date__c: installationDateTime
        })
        
        if (updateResult.success) {
          console.log('✅ Portal datetime updated successfully')
          
          // Query again to verify
          const verifyResult = await conn.query(portalQuery)
          const updatedPortal = verifyResult.records[0]
          
          console.log('\n📋 Updated Portal Installation_Date__c:')
          console.log(`   ${updatedPortal.Installation_Date__c}`)
          
          if (updatedPortal.Installation_Date__c) {
            const savedDate = new Date(updatedPortal.Installation_Date__c)
            console.log('\n🕒 Verification:')
            console.log(`   Raw from Salesforce: ${updatedPortal.Installation_Date__c}`)
            console.log(`   Singapore Time: ${savedDate.toLocaleString('en-US', { 
              timeZone: 'Asia/Singapore', 
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true 
            })}`)
            
            // Check if date and time are correct
            const expectedDateStr = 'Nov 12, 2025'
            const expectedTimeStr = '2:00 PM'
            const actualSingapore = savedDate.toLocaleString('en-US', { timeZone: 'Asia/Singapore' })
            
            if (actualSingapore.includes(expectedDateStr) && actualSingapore.includes(expectedTimeStr)) {
              console.log(`   ✅ Date and time are correct!`)
            } else {
              console.log(`   ⚠️  Expected: ${expectedDateStr} at ${expectedTimeStr}`)
              console.log(`   ⚠️  Got: ${actualSingapore}`)
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
    console.log('📌 Key Points:')
    console.log('- Send datetime with timezone offset: YYYY-MM-DDTHH:MM:SS+08:00')
    console.log('- This preserves the correct date and time in Singapore timezone')
    console.log('- UI should display this correctly as Singapore time')

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  fixPortalDateTime()
}

module.exports = fixPortalDateTime