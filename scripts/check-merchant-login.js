require('dotenv').config({ path: '.env.local' })
const jsforce = require('jsforce')

async function checkMerchantLogin() {
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

    const merchantId = 'a0yQ900000BalYL'  // The merchant having login issues
    const submittedPIN = '2454'
    
    console.log('🔍 Checking login for merchant:', merchantId)
    console.log('📌 Submitted PIN:', submittedPIN)
    console.log('=' . repeat(60))
    
    // Same query as the login API uses
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
      console.log('❌ Merchant not found with ID:', merchantId)
      console.log('\n💡 Possible issues:')
      console.log('1. The merchant ID might be incorrect')
      console.log('2. The record might not exist in Salesforce')
      return
    }
    
    const trainer = result.records[0]
    console.log('✅ Found merchant:', trainer.Name)
    console.log('')
    
    console.log('📞 Phone Numbers Found:')
    console.log('=' . repeat(60))
    
    const phoneData = []
    
    // Business Owner Contact Phone
    if (trainer.Business_Owner_Contact__r?.Phone) {
      const phone = trainer.Business_Owner_Contact__r.Phone
      const cleanPhone = phone.replace(/\D/g, '')
      const last4 = cleanPhone.slice(-4)
      phoneData.push({
        type: 'Business Owner Contact',
        name: trainer.Business_Owner_Contact__r.Name,
        phone: phone,
        cleanedPhone: cleanPhone,
        last4Digits: last4,
        matchesPIN: last4 === submittedPIN
      })
    }
    
    // Merchant PIC Contact Number
    if (trainer.Merchant_PIC_Contact_Number__c) {
      const phone = trainer.Merchant_PIC_Contact_Number__c
      const cleanPhone = phone.replace(/\D/g, '')
      const last4 = cleanPhone.slice(-4)
      phoneData.push({
        type: 'Merchant PIC',
        name: 'Merchant PIC',
        phone: phone,
        cleanedPhone: cleanPhone,
        last4Digits: last4,
        matchesPIN: last4 === submittedPIN
      })
    }
    
    // Operation Manager Contact Phone
    if (trainer.Operation_Manager_Contact__r?.Phone) {
      const phone = trainer.Operation_Manager_Contact__r.Phone
      const cleanPhone = phone.replace(/\D/g, '')
      const last4 = cleanPhone.slice(-4)
      phoneData.push({
        type: 'Operation Manager Contact',
        name: trainer.Operation_Manager_Contact__r.Name,
        phone: phone,
        cleanedPhone: cleanPhone,
        last4Digits: last4,
        matchesPIN: last4 === submittedPIN
      })
    }
    
    if (phoneData.length === 0) {
      console.log('❌ No phone numbers found for this merchant!')
      console.log('\n💡 Solution: Add at least one phone number in Salesforce:')
      console.log('   - Business Owner Contact Phone')
      console.log('   - Merchant PIC Contact Number')
      console.log('   - Operation Manager Contact Phone')
      return
    }
    
    // Display phone data
    phoneData.forEach((data, index) => {
      console.log(`\n${index + 1}. ${data.type}:`)
      console.log(`   Name: ${data.name}`)
      console.log(`   Phone: ${data.phone}`)
      console.log(`   Cleaned: ${data.cleanedPhone}`)
      console.log(`   Last 4 digits (PIN): ${data.last4Digits}`)
      console.log(`   Matches submitted PIN (${submittedPIN}): ${data.matchesPIN ? '✅ YES' : '❌ NO'}`)
    })
    
    console.log('\n' + '=' . repeat(60))
    
    const matchFound = phoneData.some(data => data.matchesPIN)
    
    if (matchFound) {
      const matchedData = phoneData.find(data => data.matchesPIN)
      console.log(`✅ PIN ${submittedPIN} is VALID!`)
      console.log(`   Matches: ${matchedData.type} (${matchedData.name})`)
      console.log(`   Phone: ${matchedData.phone}`)
    } else {
      console.log(`❌ PIN ${submittedPIN} does NOT match any phone number!`)
      console.log('\n📱 Valid PINs for this merchant:')
      phoneData.forEach(data => {
        console.log(`   - ${data.last4Digits} (from ${data.type}: ${data.phone})`)
      })
    }
    
    console.log('\n💡 How PINs work:')
    console.log('   - The PIN is the LAST 4 DIGITS of any registered phone number')
    console.log('   - Phone numbers can include country codes, spaces, dashes, etc.')
    console.log('   - Only the numeric digits are considered')
    console.log('   - Example: +60 12-345 6789 → PIN is 6789')

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.errorCode) {
      console.error('Error Code:', error.errorCode)
    }
  }
}

// Run if called directly
if (require.main === module) {
  checkMerchantLogin()
}

module.exports = checkMerchantLogin