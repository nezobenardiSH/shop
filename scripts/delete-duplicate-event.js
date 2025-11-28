/**
 * Script to delete a duplicate calendar event from Khairul's calendar
 * for merchant a0yQ900000CCiJJIA1 (68 studio-)
 *
 * Usage: node scripts/delete-duplicate-event.js
 */

require('dotenv').config({ path: '.env.local' });
const jsforce = require('jsforce');

async function deleteDuplicateEvent() {
  try {
    console.log('🔍 Looking up merchant a0yQ900000CCiJJIA1...\n');

    // Connect to Salesforce
    const conn = new jsforce.Connection({
      loginUrl: process.env.SF_LOGIN_URL || process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
    });

    const username = process.env.SF_USERNAME || process.env.SALESFORCE_USERNAME;
    const password = process.env.SF_PASSWORD || process.env.SALESFORCE_PASSWORD;
    const token = process.env.SF_TOKEN || process.env.SALESFORCE_SECURITY_TOKEN;

    await conn.login(username, password + token);

    console.log('✅ Connected to Salesforce\n');

    // Query Portal for this specific merchant
    const merchantId = 'a0yQ900000CCiJJIA1';
    const portalQuery = `
      SELECT Id, Training_Event_ID__c, Trainer_Name__c, Training_Date__c
      FROM Onboarding_Portal__c
      WHERE Onboarding_Trainer_Record__c = '${merchantId}'
      LIMIT 1
    `;

    const portalResult = await conn.query(portalQuery);

    if (portalResult.totalSize === 0) {
      console.log('❌ No Portal record found for this merchant');
      return;
    }

    const portal = portalResult.records[0];
    console.log('📋 Portal Record:');
    console.log(`   Training_Event_ID__c: ${portal.Training_Event_ID__c || 'Not set'}`);
    console.log(`   Trainer_Name__c (User ID): ${portal.Trainer_Name__c || 'Not set'}`);
    console.log(`   Training_Date__c: ${portal.Training_Date__c || 'Not set'}`);

    // Get the trainer email from the User ID
    if (portal.Trainer_Name__c) {
      const userResult = await conn.query(`SELECT Name, Email FROM User WHERE Id = '${portal.Trainer_Name__c}'`);
      if (userResult.totalSize > 0) {
        console.log(`   Trainer Name: ${userResult.records[0].Name}`);
        console.log(`   Trainer Email: ${userResult.records[0].Email}`);
      }
    }

    // Query CSM from Onboarding_Trainer__c
    const trainerQuery = `
      SELECT CSM_Name__c, CSM_Name__r.Name, CSM_Name__r.Email
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
    `;
    const trainerResult = await conn.query(trainerQuery);

    if (trainerResult.totalSize > 0) {
      const trainer = trainerResult.records[0];
      console.log('\n📋 Current CSM (Onboarding_Trainer__c):');
      console.log(`   CSM_Name__c (User ID): ${trainer.CSM_Name__c || 'Not set'}`);
      console.log(`   CSM Name: ${trainer.CSM_Name__r?.Name || 'Not set'}`);
      console.log(`   CSM Email: ${trainer.CSM_Name__r?.Email || 'Not set'}`);
    }

    const eventId = portal.Training_Event_ID__c;

    console.log('\n⚠️  The event in Khairul\'s calendar needs to be deleted.');
    console.log('   Khairul Uwais email: khairuluwais.fuad@storehub.com');
    console.log(`   Event ID to delete: ${eventId}`);

    if (!eventId) {
      console.log('❌ No event ID found in Portal - cannot delete');
      return;
    }

    // Now let's try to delete it using the Lark API
    console.log('\n🗑️  Attempting to delete event from Khairul\'s calendar...');

    // Import the Lark service dynamically
    const path = require('path');

    // We need to use tsx to run TypeScript imports
    console.log('\n📝 To delete this event, run the following command:');
    console.log(`\n   npx tsx -e "
const { larkService } = require('./lib/lark');
const { CalendarIdManager } = require('./lib/calendar-id-manager');

async function del() {
  const email = 'khairuluwais.fuad@storehub.com';
  const eventId = '${eventId}';
  const calId = await CalendarIdManager.getResolvedCalendarId(email);
  await larkService.deleteCalendarEvent(calId, eventId, email);
  console.log('Deleted!');
}
del();
"`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

deleteDuplicateEvent();
