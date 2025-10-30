const { getSalesforceConnection } = require('../lib/salesforce');

async function debugEventIds() {
  try {
    const conn = await getSalesforceConnection();
    if (!conn) {
      console.error('Failed to get Salesforce connection');
      return;
    }

    // Query for all Onboarding_Portal__c records with event IDs
    const query = `
      SELECT 
        Id,
        Name,
        Onboarding_Trainer_Record__c,
        Onboarding_Trainer_Record__r.Name,
        Installation_Event_ID__c,
        Training_Event_ID__c,
        Installation_Date__c,
        Training_Date__c,
        CreatedDate,
        LastModifiedDate
      FROM Onboarding_Portal__c
      WHERE Installation_Event_ID__c != null OR Training_Event_ID__c != null
      ORDER BY LastModifiedDate DESC
      LIMIT 20
    `;

    console.log('🔍 Querying Onboarding_Portal__c records with event IDs...\n');
    const result = await conn.query(query);
    
    console.log(`Found ${result.totalSize} records with event IDs:\n`);
    
    result.records.forEach((record, index) => {
      console.log(`📋 Record ${index + 1}:`);
      console.log(`   Portal ID: ${record.Id}`);
      console.log(`   Portal Name: ${record.Name}`);
      console.log(`   Trainer Record ID: ${record.Onboarding_Trainer_Record__c}`);
      console.log(`   Trainer Name: ${record.Onboarding_Trainer_Record__r?.Name || 'N/A'}`);
      console.log(`   Installation Event ID: ${record.Installation_Event_ID__c || 'Not set'}`);
      if (record.Installation_Event_ID__c) {
        console.log(`     - Length: ${record.Installation_Event_ID__c.length} chars`);
      }
      console.log(`   Training Event ID: ${record.Training_Event_ID__c || 'Not set'}`);
      if (record.Training_Event_ID__c) {
        console.log(`     - Length: ${record.Training_Event_ID__c.length} chars`);
      }
      console.log(`   Installation Date: ${record.Installation_Date__c || 'Not set'}`);
      console.log(`   Training Date: ${record.Training_Date__c || 'Not set'}`);
      console.log(`   Created: ${record.CreatedDate}`);
      console.log(`   Last Modified: ${record.LastModifiedDate}`);
      console.log('');
    });

    // Also check for any records without event IDs but with dates
    const missingQuery = `
      SELECT 
        Id,
        Name,
        Onboarding_Trainer_Record__r.Name,
        Installation_Date__c,
        Training_Date__c
      FROM Onboarding_Portal__c
      WHERE 
        (Installation_Date__c != null AND Installation_Event_ID__c = null) OR
        (Training_Date__c != null AND Training_Event_ID__c = null)
      LIMIT 10
    `;

    const missingResult = await conn.query(missingQuery);
    
    if (missingResult.totalSize > 0) {
      console.log(`\n⚠️  Found ${missingResult.totalSize} records with dates but MISSING event IDs:`);
      missingResult.records.forEach((record) => {
        console.log(`   - ${record.Name} (${record.Onboarding_Trainer_Record__r?.Name || 'N/A'})`);
        if (record.Installation_Date__c && !record.Installation_Event_ID__c) {
          console.log(`     Missing Installation Event ID (has date: ${record.Installation_Date__c})`);
        }
        if (record.Training_Date__c && !record.Training_Event_ID__c) {
          console.log(`     Missing Training Event ID (has date: ${record.Training_Date__c})`);
        }
      });
    } else {
      console.log('\n✅ All records with dates have corresponding event IDs');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugEventIds();