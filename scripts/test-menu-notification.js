// Test script for menu submission notification
// This simulates what Salesforce should send to the webhook

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

async function testMenuSubmissionNotification() {
  console.log('🧪 Testing Menu Submission Notification\n')
  console.log('=' .repeat(60))

  // STEP 1: Replace these with real values from your Salesforce
  const TRAINER_ID = 'a0yQ9000003aAvBIAU' // Real Onboarding_Trainer__c ID
  const SUBMISSION_LINK = 'https://docs.google.com/forms/test-submission-link' // Test submission URL

  console.log('\n📋 Test Configuration:')
  console.log(`   Trainer ID: ${TRAINER_ID}`)
  console.log(`   Submission Link: ${SUBMISSION_LINK}`)
  console.log(`   Webhook URL: ${BASE_URL}/api/salesforce/webhook`)

  if (TRAINER_ID === 'YOUR_ONBOARDING_TRAINER_ID_HERE') {
    console.log('\n❌ ERROR: Please update TRAINER_ID with a real Salesforce ID')
    console.log('   Find it in Salesforce: Onboarding_Trainer__c record → Id field')
    process.exit(1)
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n🚀 Sending webhook request...\n')

  try {
    const response = await fetch(`${BASE_URL}/api/salesforce/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        objectType: 'Onboarding_Trainer__c',
        recordId: TRAINER_ID,
        eventType: 'update',
        changes: {
          Menu_Collection_Submission_Link__c: SUBMISSION_LINK
        }
      })
    })

    const result = await response.json()

    console.log('📥 Response Status:', response.status)
    console.log('📦 Response Body:', JSON.stringify(result, null, 2))

    if (response.ok) {
      console.log('\n✅ Webhook call successful!')
      console.log('\n🔍 What to check:')
      console.log('   1. Check server logs for: "Menu submission notification sent to MSM"')
      console.log('   2. Check if Onboarding Manager received Lark notification')
      console.log('   3. Check if Product_Setup_Status__c was updated in Salesforce')
    } else {
      console.log('\n❌ Webhook call failed!')
      console.log('   Error:', result.error || result.message)
    }

  } catch (error) {
    console.log('\n❌ Request failed:', error.message)
    console.log('\nPossible issues:')
    console.log('   1. Server is not running (run: npm run dev)')
    console.log('   2. BASE_URL is incorrect')
    console.log('   3. Network/firewall blocking request')
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📖 How to use this script:')
  console.log('   1. Update TRAINER_ID with your Onboarding_Trainer__c ID')
  console.log('   2. Run: node scripts/test-menu-notification.js')
  console.log('   3. Check if notification was sent\n')
}

// Instructions for checking server logs
function showLogInstructions() {
  console.log('\n📊 HOW TO CHECK SERVER LOGS:')
  console.log('=' .repeat(60))
  console.log('\nIf running locally (npm run dev):')
  console.log('   → Look at your terminal where the dev server is running')
  console.log('   → You should see logs like:')
  console.log('      • "Received Salesforce webhook: ..."')
  console.log('      • "Menu upload detected via field: Menu_Collection_Submission_Link__c"')
  console.log('      • "📧 Menu submission notification sent to MSM: ..."')
  console.log('\nIf running on production (Vercel/Heroku/etc):')
  console.log('   → Check your platform\'s logs:')
  console.log('      • Vercel: Dashboard → Project → Logs')
  console.log('      • Heroku: heroku logs --tail')
  console.log('      • AWS: CloudWatch Logs')
  console.log('\nWhat to look for:')
  console.log('   ✅ "Menu submission notification sent to MSM" = Success!')
  console.log('   ⚠️  "No MSM email found" = MSM not configured')
  console.log('   ❌ No logs at all = Webhook not being called')
  console.log('\n' + '='.repeat(60))
}

// Instructions for Salesforce setup
function showSalesforceSetup() {
  console.log('\n⚙️  SALESFORCE AUTOMATION SETUP:')
  console.log('=' .repeat(60))
  console.log('\nThe webhook won\'t be called unless you set up Salesforce automation!')
  console.log('\n🔧 Quick Setup (Process Builder):')
  console.log('   1. Salesforce Setup → Process Builder → New Process')
  console.log('   2. Object: Onboarding_Trainer__c')
  console.log('   3. Trigger: When a record is updated')
  console.log('   4. Criteria:')
  console.log('      • ISCHANGED([Onboarding_Trainer__c].Menu_Collection_Submission_Link__c)')
  console.log('      • AND field IS NOT NULL')
  console.log('   5. Action: Apex/HTTP Callout')
  console.log('      • Method: POST')
  console.log(`      • URL: ${BASE_URL}/api/salesforce/webhook`)
  console.log('      • Body: (see docs/salesforce-automation-setup.md)')
  console.log('\n📖 Full documentation: docs/salesforce-automation-setup.md')
  console.log('=' .repeat(60))
}

// Run the test
console.log('\n🎯 MENU SUBMISSION NOTIFICATION TESTER')
console.log('=' .repeat(60))

testMenuSubmissionNotification()
  .then(() => {
    showLogInstructions()
    showSalesforceSetup()
  })
  .catch(console.error)
