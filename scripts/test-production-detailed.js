async function testProductionDetailed() {
  console.log('🌐 Testing Production After Redeploy')
  console.log('=' . repeat(60))
  
  const merchantId = 'a0yQ900000BalYL'
  
  // First test if the API is reachable
  console.log('\n1️⃣ Testing API Health...')
  console.log('-' . repeat(40))
  
  try {
    const healthResponse = await fetch('https://onboarding-portal.onrender.com/api/auth/merchant-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})  // Empty body to test API response
    })
    
    console.log('API Status:', healthResponse.status)
    const text = await healthResponse.text()
    try {
      const json = JSON.parse(text)
      console.log('API Response:', json)
    } catch {
      console.log('Raw Response:', text.substring(0, 200))
    }
  } catch (error) {
    console.error('❌ Cannot reach API:', error.message)
    return
  }
  
  // Test with actual PINs
  const tests = [
    { pin: '2454', description: 'Business Owner PIN' },
    { pin: '6789', description: 'Operation Manager PIN' }
  ]
  
  for (const test of tests) {
    console.log(`\n2️⃣ Testing PIN: ${test.pin} (${test.description})`)
    console.log('-' . repeat(40))
    
    try {
      console.log('Sending request with:')
      console.log('  merchantId:', merchantId)
      console.log('  pin:', test.pin)
      
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
      
      console.log('\nResponse Status:', response.status, response.statusText)
      
      const data = await response.json()
      console.log('Response Data:', JSON.stringify(data, null, 2))
      
      if (response.ok) {
        console.log('✅ LOGIN SUCCESSFUL!')
        break  // Stop testing if one works
      } else {
        console.log('❌ LOGIN FAILED')
        
        if (data.error) {
          console.log('Error message:', data.error)
        }
        
        if (data.lockout) {
          console.log('🔒 ACCOUNT IS LOCKED OUT!')
          console.log('   Must wait 15 minutes from first failed attempt')
        }
        
        if (data.remainingAttempts !== undefined) {
          console.log(`⚠️ Remaining attempts: ${data.remainingAttempts}`)
          if (data.remainingAttempts === 0) {
            console.log('   Next attempt will lock the account for 15 minutes')
          }
        }
      }
    } catch (error) {
      console.error('❌ Request failed:', error.message)
    }
  }
  
  console.log('\n' + '=' . repeat(60))
  console.log('📋 Analysis:')
  console.log('-' . repeat(60))
  console.log('Possible causes for "Access Denied":')
  console.log('')
  console.log('1. Rate Limiting (Most Likely):')
  console.log('   - You may have hit the 5-attempt limit')
  console.log('   - Rate limits are stored in server memory')
  console.log('   - They persist even after redeploy if server doesn\'t fully restart')
  console.log('   - Solution: Wait 15 minutes OR restart the service on Render')
  console.log('')
  console.log('2. Salesforce Connection Issue:')
  console.log('   - Check if SF environment variables are set on Render')
  console.log('   - Error would be "Invalid merchant ID or PIN"')
  console.log('')
  console.log('3. Wrong Merchant ID Format:')
  console.log('   - Verify the URL uses: a0yQ900000BalYL')
  console.log('   - Not the full 18-character ID: a0yQ900000BalYLIAZ')
  console.log('')
  console.log('🔧 Immediate Fix:')
  console.log('   Go to Render Dashboard → Your Service → "Restart"')
  console.log('   This will clear the in-memory rate limit')
}

testProductionDetailed().catch(console.error)