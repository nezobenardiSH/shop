require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function testQuery() {
  const merchantId = 'a0yQ9000003aAvBIAU'
  
  const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
  })

  const username = process.env.SF_USERNAME
  const password = process.env.SF_PASSWORD
  const token = process.env.SF_TOKEN

  await conn.login(username, password + token)
  console.log('✅ Connected\n')

  // Test the exact query used in the code
  const portalQuery = `
    SELECT Id
    FROM Onboarding_Portal__c
    WHERE Onboarding_Trainer_Record__c = '${merchantId}'
    LIMIT 1
  `
  
  console.log('Running query:')
  console.log(portalQuery)
  console.log('')
  
  const portalResult = await conn.query(portalQuery)
  
  console.log(`Total records found: ${portalResult.totalSize}`)
  
  if (portalResult.totalSize > 0) {
    console.log('✅ Portal record found!')
    console.log('Portal ID:', portalResult.records[0].Id)
    
    // Try to update it with a test value
    console.log('\nTesting update...')
    const updateResult = await conn.sobject('Onboarding_Portal__c').update({
      Id: portalResult.records[0].Id,
      Installation_Event_ID__c: 'test-event-id-12345'
    })
    
    console.log('Update result:', updateResult)
    
    if (updateResult.success) {
      console.log('✅ Update successful!')
      
      // Verify the update
      const verify = await conn.query(`
        SELECT Id, Installation_Event_ID__c 
        FROM Onboarding_Portal__c 
        WHERE Id = '${portalResult.records[0].Id}'
      `)
      console.log('\nVerification:', verify.records[0])
    }
  } else {
    console.log('❌ No Portal record found!')
  }
}

testQuery().catch(console.error)
