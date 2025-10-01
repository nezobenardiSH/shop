const jsforce = require('jsforce')
require('dotenv').config({ path: '.env.local' })

async function testSalesforceConnection() {
  console.log('🔍 Testing Salesforce Sandbox Connection...\n')
  
  // Check environment variables
  console.log('📋 Environment Variables:')
  console.log(`SF_USERNAME: ${process.env.SF_USERNAME ? '✅ Set' : '❌ Missing'}`)
  console.log(`SF_PASSWORD: ${process.env.SF_PASSWORD ? '✅ Set' : '❌ Missing'}`)
  console.log(`SF_TOKEN: ${process.env.SF_TOKEN ? '✅ Set' : '❌ Missing'}`)
  console.log(`SF_LOGIN_URL: ${process.env.SF_LOGIN_URL || 'https://test.salesforce.com (default)'}`)
  console.log('')

  if (!process.env.SF_USERNAME || !process.env.SF_PASSWORD || !process.env.SF_TOKEN) {
    console.log('❌ Missing required Salesforce credentials!')
    console.log('Please set SF_USERNAME, SF_PASSWORD, and SF_TOKEN in your .env.local file')
    console.log('')
    console.log('Example format:')
    console.log('SF_USERNAME=your.email@company.com.sandboxname')
    console.log('SF_PASSWORD=your_sandbox_password')
    console.log('SF_TOKEN=your_sandbox_security_token')
    return
  }

  try {
    // Create connection
    const conn = new jsforce.Connection({
      loginUrl: process.env.SF_LOGIN_URL || 'https://test.salesforce.com'
    })

    console.log('🔗 Attempting to connect to Salesforce...')
    
    // Login
    await conn.login(
      process.env.SF_USERNAME,
      process.env.SF_PASSWORD + process.env.SF_TOKEN
    )

    console.log('✅ Successfully connected to Salesforce!')
    console.log('')

    // Get organization info
    const orgResult = await conn.query('SELECT Id, Name, OrganizationType, IsSandbox FROM Organization LIMIT 1')
    const org = orgResult.records[0]
    
    console.log('🏢 Organization Info:')
    console.log(`Name: ${org.Name}`)
    console.log(`Type: ${org.OrganizationType}`)
    console.log(`Environment: ${org.IsSandbox ? 'Sandbox ✅' : 'Production ⚠️'}`)
    console.log('')

    // Test Account access
    const accountResult = await conn.query('SELECT Id, Name FROM Account LIMIT 5')
    console.log(`📊 Account Access: Found ${accountResult.totalSize} accounts`)
    
    if (accountResult.records.length > 0) {
      console.log('Sample accounts:')
      accountResult.records.forEach((acc, index) => {
        console.log(`  ${index + 1}. ${acc.Name} (${acc.Id})`)
      })
    }
    console.log('')

    // Check for custom fields
    console.log('🔍 Checking for custom fields...')
    try {
      const customFieldTest = await conn.query(`
        SELECT Id, Name, External_Id__c, Onboarding_Stage__c, Installation_Date__c, Training_Date__c 
        FROM Account 
        WHERE External_Id__c != null 
        LIMIT 1
      `)
      console.log('✅ Custom fields are accessible')
    } catch (error) {
      if (error.message.includes('External_Id__c')) {
        console.log('⚠️  Custom field External_Id__c not found - you may need to create it')
      } else if (error.message.includes('Onboarding_Stage__c')) {
        console.log('⚠️  Custom field Onboarding_Stage__c not found - you may need to create it')
      } else {
        console.log('⚠️  Some custom fields may be missing:', error.message)
      }
    }

    console.log('')
    console.log('🎉 Salesforce connection test completed successfully!')
    console.log('You can now use the merchant portal with real Salesforce integration.')

  } catch (error) {
    console.log('❌ Connection failed!')
    console.log('')
    
    if (error.message.includes('INVALID_LOGIN')) {
      console.log('🔐 Login Error - Check these:')
      console.log('1. Username format: your.email@company.com.sandboxname')
      console.log('2. Password is correct for sandbox')
      console.log('3. Security token is from sandbox (not production)')
      console.log('4. Login URL is https://test.salesforce.com')
    } else if (error.message.includes('API_DISABLED_FOR_ORG')) {
      console.log('🚫 API access is disabled for this org')
    } else {
      console.log('Error details:', error.message)
    }
  }
}

// Run the test
testSalesforceConnection().catch(console.error)
