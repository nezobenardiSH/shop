require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function testLoginAPI() {
  console.log('🔐 Testing Login API for merchant: a0yQ900000BalYL')
  console.log('=' . repeat(60))
  
  // Test both PINs
  const tests = [
    { pin: '2454', description: 'Business Owner Phone (+60172882454)' },
    { pin: '6789', description: 'Operation Manager Phone (+60123456789)' }
  ]
  
  // First, verify the data in Salesforce directly
  console.log('\n📊 Verifying Salesforce data...')
  console.log('-' . repeat(60))
  
  try {
    const conn = new jsforce.Connection({
      loginUrl: process.env.SF_LOGIN_URL || process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
    })
    
    const username = process.env.SF_USERNAME || process.env.SALESFORCE_USERNAME
    const password = process.env.SF_PASSWORD || process.env.SALESFORCE_PASSWORD
    const token = process.env.SF_TOKEN || process.env.SALESFORCE_SECURITY_TOKEN
    
    await conn.login(username, password + token)
    console.log('✅ Connected to Salesforce')
    
    // Query exactly as the API does
    const merchantId = 'a0yQ900000BalYL'
    const query = `
      SELECT Id, Name,
             Business_Owner_Contact__r.Phone,
             Business_Owner_Contact__r.Name,
             Merchant_PIC_Contact_Number__c,
             Operation_Manager_Contact__r.Phone,
             Operation_Manager_Contact__r.Name
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    const result = await conn.query(query)
    
    if (result.totalSize === 0) {
      console.log('❌ Merchant not found!')
      return
    }
    
    const trainer = result.records[0]
    console.log('\n📋 Merchant Found:')
    console.log('  Name:', trainer.Name)
    console.log('  ID:', trainer.Id)
    
    console.log('\n📞 Phone Numbers:')
    if (trainer.Business_Owner_Contact__r?.Phone) {
      const phone = trainer.Business_Owner_Contact__r.Phone
      const cleaned = phone.replace(/\D/g, '')
      const pin = cleaned.slice(-4)
      console.log('  Business Owner:')
      console.log('    Name:', trainer.Business_Owner_Contact__r.Name)
      console.log('    Phone:', phone)
      console.log('    Cleaned:', cleaned)
      console.log('    PIN:', pin)
    }
    
    if (trainer.Merchant_PIC_Contact_Number__c) {
      const phone = trainer.Merchant_PIC_Contact_Number__c
      const cleaned = phone.replace(/\D/g, '')
      const pin = cleaned.slice(-4)
      console.log('  Merchant PIC:')
      console.log('    Phone:', phone)
      console.log('    Cleaned:', cleaned)
      console.log('    PIN:', pin)
    }
    
    if (trainer.Operation_Manager_Contact__r?.Phone) {
      const phone = trainer.Operation_Manager_Contact__r.Phone
      const cleaned = phone.replace(/\D/g, '')
      const pin = cleaned.slice(-4)
      console.log('  Operation Manager:')
      console.log('    Name:', trainer.Operation_Manager_Contact__r.Name)
      console.log('    Phone:', phone)
      console.log('    Cleaned:', cleaned)
      console.log('    PIN:', pin)
    }
    
  } catch (error) {
    console.error('❌ Salesforce error:', error.message)
    return
  }
  
  // Now test the validation logic locally
  console.log('\n🔑 Testing PIN Validation Logic...')
  console.log('-' . repeat(60))
  
  for (const test of tests) {
    console.log(`\nTest: PIN ${test.pin} (${test.description})`)
    
    // Test extractPINFromPhone function logic
    const testPhones = [
      { phone: '+60172882454', expected: '2454' },
      { phone: '+60 17-288 2454', expected: '2454' },
      { phone: '0172882454', expected: '2454' },
      { phone: '+60123456789', expected: '6789' },
      { phone: '+60 12-345 6789', expected: '6789' },
      { phone: '0123456789', expected: '6789' }
    ]
    
    let matchFound = false
    for (const { phone, expected } of testPhones) {
      const cleaned = phone.replace(/\D/g, '')
      const pin = cleaned.slice(-4)
      if (pin === test.pin) {
        console.log(`  ✅ Match found: ${phone} -> ${pin}`)
        matchFound = true
      }
    }
    
    if (!matchFound) {
      console.log(`  ❌ No match found for PIN ${test.pin}`)
    }
  }
  
  // Test if it's a rate limiting issue
  console.log('\n🚦 Testing Rate Limiting...')
  console.log('-' . repeat(60))
  console.log('Rate limiting settings:')
  console.log('  MAX_ATTEMPTS: 5')
  console.log('  LOCKOUT_DURATION: 15 minutes')
  console.log('  Note: Rate limit is stored in-memory and resets on server restart')
  
  console.log('\n💡 Possible Issues and Solutions:')
  console.log('-' . repeat(60))
  console.log('1. ❌ Deployment lag:')
  console.log('   Solution: Wait a few minutes for deployment to complete')
  console.log('')
  console.log('2. ❌ Server not restarted:')
  console.log('   Solution: Check Render dashboard and manually restart the service')
  console.log('')
  console.log('3. ❌ Rate limiting (too many failed attempts):')
  console.log('   Solution: Wait 15 minutes or restart the server on Render')
  console.log('')
  console.log('4. ❌ Browser cache:')
  console.log('   Solution: Hard refresh (Cmd+Shift+R) or use incognito mode')
  console.log('')
  console.log('5. ❌ Environment variables not set on Render:')
  console.log('   Solution: Check Render environment variables match local .env')
  
  console.log('\n📱 Manual Test URLs:')
  console.log('-' . repeat(60))
  console.log('Production URL: https://onboarding-portal.onrender.com/merchant/a0yQ900000BalYL')
  console.log('Test PINs: 2454 or 6789')
  
  console.log('\n🔍 Next Steps:')
  console.log('-' . repeat(60))
  console.log('1. Check Render dashboard for deployment status')
  console.log('2. Look at Render logs for any errors')
  console.log('3. If needed, manually restart the service on Render')
  console.log('4. Verify environment variables are set correctly on Render')
}

// Run if called directly
if (require.main === module) {
  testLoginAPI()
}

module.exports = testLoginAPI