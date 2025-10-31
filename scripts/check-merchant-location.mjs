import { getSalesforceConnection } from '../lib/salesforce.js'

const merchantId = process.argv[2] || 'a0yQ900000BlNfZ'

async function checkMerchantLocation() {
  console.log('🔍 Checking merchant location for ID:', merchantId)
  
  try {
    const conn = await getSalesforceConnection()
    
    if (!conn) {
      console.log('❌ Could not connect to Salesforce')
      return
    }
    
    console.log('✅ Connected to Salesforce')
    
    // Query the merchant's location
    const query = `
      SELECT Id, Name, Merchant_Location__c, Assigned_Installer__c,
             Shipping_State__c, Shipping_City__c
      FROM Onboarding_Trainer__c 
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    console.log('📋 Query:', query)
    const result = await conn.query(query)
    
    if (result.totalSize > 0) {
      const merchant = result.records[0]
      console.log('\n✅ Merchant Found:')
      console.log('   Name:', merchant.Name)
      console.log('   ID:', merchant.Id)
      console.log('   Merchant_Location__c:', merchant.Merchant_Location__c || '[NOT SET]')
      console.log('   Assigned_Installer__c:', merchant.Assigned_Installer__c || '[NOT SET]')
      console.log('   Shipping_State__c:', merchant.Shipping_State__c || '[NOT SET]')
      console.log('   Shipping_City__c:', merchant.Shipping_City__c || '[NOT SET]')
      
      // Determine what location category this would map to
      const location = merchant.Merchant_Location__c
      let expectedType = 'external'
      let expectedLocation = 'external'
      
      if (location === 'Within Klang Valley') {
        expectedType = 'internal'
        expectedLocation = 'klangValley'
      } else if (location === 'Penang') {
        expectedType = 'internal'
        expectedLocation = 'penang'
      } else if (location === 'JB' || location === 'Johor Bahru') {
        expectedType = 'internal'
        expectedLocation = 'johorBahru'
      }
      
      console.log('\n🎯 Expected mapping:')
      console.log('   Type:', expectedType)
      console.log('   Location Category:', expectedLocation)
      
      if (expectedType === 'external') {
        console.log('   ℹ️ This merchant will use EXTERNAL VENDOR')
      } else {
        console.log('   ℹ️ This merchant will use INTERNAL INSTALLERS from:', expectedLocation)
      }
      
      if (merchant.Assigned_Installer__c && merchant.Assigned_Installer__c.toLowerCase() === 'surfstek') {
        console.log('   ⚠️ NOTE: Overridden to external due to Surfstek assignment')
      }
      
    } else {
      console.log('❌ No merchant found with ID:', merchantId)
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
  
  process.exit(0)
}

checkMerchantLocation()