require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function findMerchants() {
  const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
  })

  const username = process.env.SF_USERNAME
  const password = process.env.SF_PASSWORD
  const token = process.env.SF_TOKEN
  
  await conn.login(username, password + token)
  
  const query = `
    SELECT Id, Name
    FROM Onboarding_Trainer__c
    WHERE Name LIKE '%activate%'
    ORDER BY Name
    LIMIT 20
  `
  const result = await conn.query(query)
  
  console.log(`Found ${result.totalSize} merchants with "activate" in name:\n`)
  result.records.forEach((r, i) => {
    console.log(`${i + 1}. ${r.Name} (${r.Id})`)
  })
}

findMerchants().catch(console.error)

