require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function findUserByEmail() {
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

    // Installer emails from config
    const installerEmails = [
      'nezo.benardi@storehub.com',
      'mazni.noah@storehub.com'
    ]
    
    console.log('🔍 Searching for Users by email...\n')
    
    for (const email of installerEmails) {
      try {
        const userQuery = `
          SELECT Id, Name, Email, FirstName, LastName, IsActive
          FROM User
          WHERE Email = '${email}'
          LIMIT 1
        `
        
        const userResult = await conn.query(userQuery)
        
        if (userResult.totalSize > 0) {
          const user = userResult.records[0]
          console.log(`✅ Found user for email: ${email}`)
          console.log(`   User ID: ${user.Id}`)
          console.log(`   Name: ${user.Name}`)
          console.log(`   First Name: ${user.FirstName || 'N/A'}`)
          console.log(`   Last Name: ${user.LastName || 'N/A'}`)
          console.log(`   Active: ${user.IsActive}`)
        } else {
          console.log(`❌ No user found for email: ${email}`)
        }
      } catch (error) {
        console.log(`❌ Error searching for ${email}:`, error.message)
      }
      
      console.log('')
    }
    
    console.log('=' . repeat(60))
    console.log('📌 MAPPING FOR INSTALLER CONFIG:\n')
    console.log('Update your installer config with User IDs:')
    console.log('- Instead of storing just name and email')
    console.log('- Add "salesforceUserId" field with the User ID')
    console.log('- Use this ID when updating Installer_Name__c field')

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  findUserByEmail()
}

module.exports = findUserByEmail