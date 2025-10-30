require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function checkPortalField() {
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

    const metadata = await conn.describe('Onboarding_Portal__c')

    console.log(`Object: ${metadata.label}`)
    console.log(`Total fields: ${metadata.fields.length}\n`)

    const installationField = metadata.fields.find(f => f.name === 'Installation_Event_ID__c')
    
    if (installationField) {
      console.log('✅ Installation_Event_ID__c field EXISTS\n')
      console.log(`  Type: ${installationField.type}`)
      console.log(`  Length: ${installationField.length}`)
      console.log(`  Updateable: ${installationField.updateable}`)
    } else {
      console.log('❌ Installation_Event_ID__c field NOT FOUND\n')
      console.log('Available fields with "event" or "installation":')
      metadata.fields
        .filter(f => f.name.toLowerCase().includes('event') || f.name.toLowerCase().includes('installation'))
        .forEach(f => console.log(`  - ${f.name} (${f.type})`))
    }

    const queryResult = await conn.query(`
      SELECT Id, Name, Installation_Event_ID__c, Training_Event_ID__c
      FROM Onboarding_Portal__c
      LIMIT 1
    `)

    if (queryResult.totalSize > 0) {
      console.log('\n✅ Query test successful!')
      console.log(JSON.stringify(queryResult.records[0], null, 2))
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkPortalField()
