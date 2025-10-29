require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function checkPortalFields() {
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

    // Get metadata for Onboarding_Portal__c
    const metadata = await conn.sobject('Onboarding_Portal__c').describe()
    
    console.log('📊 Checking Onboarding_Portal__c field metadata...\n')
    console.log(`Object: ${metadata.label}`)
    console.log(`Total fields: ${metadata.fields.length}\n`)
    
    // Find installation-related fields
    const installationFields = metadata.fields.filter(f => 
      f.name.toLowerCase().includes('install') || 
      f.name.toLowerCase().includes('installer')
    )
    
    console.log('🔍 Installation-related fields:\n')
    installationFields.forEach(field => {
      console.log(`Field: ${field.name}`)
      console.log(`  Label: ${field.label}`)
      console.log(`  Type: ${field.type}`)
      console.log(`  Updateable: ${field.updateable}`)
      if (field.referenceTo && field.referenceTo.length > 0) {
        console.log(`  References: ${field.referenceTo.join(', ')}`)
      }
      if (field.picklistValues && field.picklistValues.length > 0) {
        console.log(`  Picklist values: ${field.picklistValues.map(v => v.value).join(', ')}`)
      }
      console.log('')
    })
    
    // Also check for any text fields that might store installer info
    console.log('🔍 Text fields that might store installer info:\n')
    const textFields = metadata.fields.filter(f => 
      f.type === 'string' && (
        f.name.toLowerCase().includes('name') ||
        f.name.toLowerCase().includes('installer') ||
        f.name.toLowerCase().includes('assigned')
      )
    )
    
    textFields.forEach(field => {
      console.log(`Field: ${field.name}`)
      console.log(`  Label: ${field.label}`)
      console.log(`  Type: ${field.type}`)
      console.log(`  Length: ${field.length}`)
      console.log(`  Updateable: ${field.updateable}`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  checkPortalFields()
}

module.exports = checkPortalFields