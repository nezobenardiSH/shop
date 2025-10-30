async function testProductionAPI() {
  console.log('🌐 Testing Production API Directly')
  console.log('=' . repeat(60))
  
  const merchantId = 'a0yQ900000BalYL'
  const tests = [
    { pin: '2454', description: 'Business Owner PIN' },
    { pin: '6789', description: 'Operation Manager PIN' }
  ]
  
  for (const test of tests) {
    console.log(`\n📱 Testing PIN: ${test.pin} (${test.description})`)
    console.log('-' . repeat(40))
    
    try {
      const response = await fetch('https://onboarding-portal.onrender.com/api/auth/merchant-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: merchantId,
          pin: test.pin
        })
      })
      
      console.log('Response Status:', response.status, response.statusText)
      
      const data = await response.json()
      console.log('Response Data:', JSON.stringify(data, null, 2))
      
      if (response.ok) {
        console.log('✅ LOGIN SUCCESSFUL!')
      } else {
        console.log('❌ LOGIN FAILED')
        if (data.lockout) {
          console.log('🔒 Account is locked out!')
        }
        if (data.remainingAttempts !== undefined) {
          console.log(`⚠️ Remaining attempts: ${data.remainingAttempts}`)
        }
      }
    } catch (error) {
      console.error('❌ Network error:', error.message)
    }
  }
  
  console.log('\n' + '=' . repeat(60))
  console.log('📋 Summary:')
  console.log('-' . repeat(60))
  console.log('If both PINs fail with "Invalid merchant ID or PIN":')
  console.log('  → The server cannot connect to Salesforce')
  console.log('  → Check Render environment variables')
  console.log('')
  console.log('If you see "Too many attempts":')
  console.log('  → Wait 15 minutes or restart the server on Render')
  console.log('')
  console.log('If you see "Service temporarily unavailable":')
  console.log('  → Salesforce connection issue on production')
  console.log('  → Check Render logs for details')
}

testProductionAPI().catch(console.error)