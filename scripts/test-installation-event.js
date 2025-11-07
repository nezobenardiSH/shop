/**
 * Test script to verify Installation event creation with full details
 */
require('dotenv').config({ path: '.env.local' })
const { getSalesforceConnection } = require('../lib/salesforce')
const LarkService = require('../lib/lark').default

async function testInstallationEvent() {
  console.log('🔍 Testing Installation Event Creation')
  console.log('=====================================\n')
  
  const merchantId = 'a0yQ9000003aAvBIAU' // activate175
  
  try {
    // Connect to Salesforce
    const conn = await getSalesforceConnection()
    if (!conn) {
      console.error('❌ Failed to connect to Salesforce')
      return
    }
    
    // Fetch merchant details
    const trainerQuery = `
      SELECT Id, Name, Account_Name__c,
             Shipping_Street__c, Shipping_City__c, Shipping_State__c, 
             Shipping_Zip_Postal_Code__c, Shipping_Country__c,
             Operation_Manager_Contact__r.Name, Operation_Manager_Contact__r.Phone, 
             Operation_Manager_Contact__r.Email,
             Business_Owner_Contact__r.Name, Business_Owner_Contact__r.Phone, 
             Business_Owner_Contact__r.Email,
             Merchant_PIC_Name__c, Merchant_PIC_Contact_Number__c, Merchant_PIC_Email__c,
             MSM_Name__r.Name, MSM_Name__r.Email, MSM_Name__r.Phone,
             Onboarding_Summary__c, Pilot_Test__c,
             Installation_Event_Id__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    const result = await conn.query(trainerQuery)
    
    if (result.totalSize === 0) {
      console.error('❌ Merchant not found')
      return
    }
    
    const trainer = result.records[0]
    console.log('📋 Merchant Details:')
    console.log('  Name:', trainer.Name)
    console.log('  Pilot Test:', trainer.Pilot_Test__c)
    console.log('  Installation Event ID:', trainer.Installation_Event_Id__c)
    console.log('  MSM Name:', trainer.MSM_Name__r?.Name)
    console.log('  MSM Email:', trainer.MSM_Name__r?.Email)
    console.log('  Onboarding Summary:', trainer.Onboarding_Summary__c)
    console.log('')
    
    // If there's an existing event, try to fetch its details
    if (trainer.Installation_Event_Id__c) {
      console.log('📅 Fetching existing Installation event details...')
      
      try {
        // Initialize Lark service
        const larkService = new LarkService()
        
        // Try to get event details (this might need a different approach)
        console.log('Event ID:', trainer.Installation_Event_Id__c)
        console.log('\n⚠️ Note: To see the full event details, you need to:')
        console.log('1. Open Lark calendar')
        console.log('2. Find the Installation event')
        console.log('3. Click on it to see if description is visible')
        console.log('4. Or check the event details/edit view')
        
      } catch (error) {
        console.error('Error fetching event:', error.message)
      }
    } else {
      console.log('ℹ️ No Installation event exists yet')
      console.log('Create one through the portal to test the new description format')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  }
}

testInstallationEvent().catch(console.error)