require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function clearTestData() {
  const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
  })

  await conn.login(
    process.env.SF_USERNAME,
    process.env.SF_PASSWORD + process.env.SF_TOKEN
  )

  console.log('✅ Connected')
  
  // Clear the test event ID
  const result = await conn.sobject('Onboarding_Portal__c').update({
    Id: 'a1QQ9000005x4KvMAI',
    Installation_Event_ID__c: null
  })
  
  console.log('Cleared test data:', result)
}

clearTestData()
