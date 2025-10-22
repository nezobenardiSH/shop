/**
 * Check installation booking data in Salesforce
 */

import dotenv from 'dotenv'
import path from 'path'
import jsforce from 'jsforce'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  console.log('🔧 Checking Installation Data')
  console.log('====================================\n')

  const SF_LOGIN_URL = process.env.SALESFORCE_LOGIN_URL
  const SF_USERNAME = process.env.SALESFORCE_USERNAME
  const SF_PASSWORD = process.env.SALESFORCE_PASSWORD
  const SF_SECURITY_TOKEN = process.env.SALESFORCE_SECURITY_TOKEN

  if (!SF_LOGIN_URL || !SF_USERNAME || !SF_PASSWORD || !SF_SECURITY_TOKEN) {
    console.error('❌ Missing Salesforce credentials in .env.local')
    console.error('Looking for: SALESFORCE_LOGIN_URL, SALESFORCE_USERNAME, SALESFORCE_PASSWORD, SALESFORCE_SECURITY_TOKEN')
    process.exit(1)
  }

  console.log('🔗 Connecting to Salesforce...')
  const conn = new jsforce.Connection({ loginUrl: SF_LOGIN_URL })
  
  try {
    await conn.login(SF_USERNAME, SF_PASSWORD + SF_SECURITY_TOKEN)
    console.log('✅ Connected to Salesforce\n')

    // Find Nasi Lemak trainer record
    console.log('🔍 Finding Nasi Lemak trainer record...')
    const query = `
      SELECT Id, Name, 
             Installation_Date__c, 
             Installation_Event_Id__c,
             Assigned_Installer__c,
             Installation_Status__c
      FROM Onboarding_Trainer__c 
      WHERE Name = 'Nasi Lemak'
      LIMIT 1
    `
    
    const result = await conn.query(query)
    
    if (result.totalSize === 0) {
      console.error('❌ No trainer found with name "Nasi Lemak"')
      process.exit(1)
    }

    const trainer: any = result.records[0]
    console.log('✅ Found trainer: Nasi Lemak (ID: ' + trainer.Id + ')')
    console.log('   Current Installation_Date__c:', trainer.Installation_Date__c || 'Not set')
    console.log('   Current Installation_Event_Id__c:', trainer.Installation_Event_Id__c || 'Not set')
    console.log('   Assigned_Installer__c:', trainer.Assigned_Installer__c || 'Not set')
    console.log('   Installation_Status__c:', trainer.Installation_Status__c || 'Not set')
    
    if (trainer.Installation_Event_Id__c) {
      console.log('   Event ID length:', trainer.Installation_Event_Id__c.length, 'characters')
    } else {
      console.log('   Event ID length: 0 characters')
    }

    console.log('\n✅ Current Salesforce data retrieved successfully!\n')

    if (trainer.Installation_Event_Id__c) {
      console.log('📋 Summary:')
      console.log('   ✅ Event ID is present in Salesforce')
      console.log('   ✅ Rescheduling should work (will delete old event)')
    } else {
      console.log('📋 Summary:')
      console.log('   ❌ Event ID is missing in Salesforce')
      console.log('   ❌ Rescheduling will NOT delete old events')
      console.log('\n📋 To fix this:')
      console.log('   1. Make a new installation booking')
      console.log('   2. Check the server logs for "Installation_Event_Id__c"')
      console.log('   3. Verify the event ID is being saved')
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()

