require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function checkPicklistValues() {
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

    // Get metadata for Onboarding_Trainer__c
    const metadata = await conn.sobject('Onboarding_Trainer__c').describe()
    
    console.log('📊 Checking Onboarding_Trainer__c field metadata...\n')
    
    // Find the Assigned_Installer__c field
    const assignedInstallerField = metadata.fields.find(f => f.name === 'Assigned_Installer__c')
    
    if (assignedInstallerField) {
      console.log('Found Assigned_Installer__c field:')
      console.log(`  Type: ${assignedInstallerField.type}`)
      console.log(`  Updateable: ${assignedInstallerField.updateable}`)
      console.log(`  Restricted Picklist: ${assignedInstallerField.restrictedPicklist}`)
      
      if (assignedInstallerField.picklistValues && assignedInstallerField.picklistValues.length > 0) {
        console.log(`\n  Valid picklist values (${assignedInstallerField.picklistValues.length} total):`)
        assignedInstallerField.picklistValues.forEach((value, idx) => {
          if (value.active) {
            console.log(`    ${idx + 1}. "${value.value}" (Label: ${value.label})`)
          }
        })
        
        console.log('\n  Inactive values:')
        assignedInstallerField.picklistValues.forEach((value, idx) => {
          if (!value.active) {
            console.log(`    - "${value.value}" (Label: ${value.label}) [INACTIVE]`)
          }
        })
      } else {
        console.log('\n  No picklist values found - this might be a text field or reference field')
      }
    } else {
      console.log('❌ Assigned_Installer__c field not found')
    }
    
    // Also check Installation_Date__c
    console.log('\n' + '=' . repeat(60) + '\n')
    const installationDateField = metadata.fields.find(f => f.name === 'Installation_Date__c')
    
    if (installationDateField) {
      console.log('Found Installation_Date__c field:')
      console.log(`  Type: ${installationDateField.type}`)
      console.log(`  Updateable: ${installationDateField.updateable}`)
    } else {
      console.log('❌ Installation_Date__c field not found')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  checkPicklistValues()
}

module.exports = checkPicklistValues