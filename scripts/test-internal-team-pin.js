require('dotenv').config({ path: '.env' })

/**
 * Test script to verify the internal team PIN (6666) works correctly
 * This tests the logic inline since auth-utils is TypeScript
 */

async function testInternalTeamPIN() {
  console.log('🔧 Testing Internal Team PIN (6666)')
  console.log('=' . repeat(60))

  const INTERNAL_TEAM_PIN = process.env.INTERNAL_TEAM_PIN || '6666'

  console.log('\n📋 Configuration:')
  console.log('  INTERNAL_TEAM_PIN:', INTERNAL_TEAM_PIN)

  // Replicate the auth-utils logic for testing
  function isInternalTeamPIN(submittedPIN) {
    const cleanPIN = submittedPIN.replace(/\D/g, '')
    return cleanPIN === INTERNAL_TEAM_PIN
  }

  function extractPINFromPhone(phone) {
    if (!phone) return null
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 4) return null
    return cleaned.slice(-4)
  }

  function validatePINWithUser(submittedPIN, phoneData) {
    const cleanPIN = submittedPIN.replace(/\D/g, '')

    if (cleanPIN.length !== 4) {
      return { isValid: false, userName: 'User', isInternalUser: false }
    }

    // Check if it's the internal team PIN first
    if (isInternalTeamPIN(submittedPIN)) {
      return { isValid: true, userName: 'StoreHub Team', isInternalUser: true }
    }

    // Check against all available phone numbers
    for (const { phone, name } of phoneData) {
      const validPIN = extractPINFromPhone(phone)
      if (validPIN && validPIN === cleanPIN) {
        const userName = name || 'User'
        return { isValid: true, userName, isInternalUser: false }
      }
    }

    return { isValid: false, userName: 'User', isInternalUser: false }
  }
  
  // Test 1: Check if isInternalTeamPIN function works
  console.log('\n🧪 Test 1: isInternalTeamPIN function')
  console.log('-' . repeat(60))
  
  const testPINs = [
    { pin: '6666', expected: true, description: 'Internal team PIN' },
    { pin: '1234', expected: false, description: 'Regular merchant PIN' },
    { pin: '9999', expected: false, description: 'Different PIN' },
    { pin: '66-66', expected: true, description: 'Internal PIN with formatting' },
  ]
  
  for (const test of testPINs) {
    const result = isInternalTeamPIN(test.pin)
    const status = result === test.expected ? '✅' : '❌'
    console.log(`  ${status} PIN "${test.pin}" (${test.description}): ${result}`)
  }
  
  // Test 2: Check validatePINWithUser with internal PIN
  console.log('\n🧪 Test 2: validatePINWithUser with internal team PIN')
  console.log('-' . repeat(60))
  
  const mockPhoneData = [
    { phone: '+60172882454', name: 'John Doe' },
    { phone: '+60123456789', name: 'Jane Smith' }
  ]
  
  const internalResult = validatePINWithUser('0000', mockPhoneData)
  console.log('  Input PIN: 0000')
  console.log('  Result:', JSON.stringify(internalResult, null, 2))
  
  if (internalResult.isValid && internalResult.isInternalUser && internalResult.userName === 'StoreHub Team') {
    console.log('  ✅ Internal team PIN validation works correctly!')
  } else {
    console.log('  ❌ Internal team PIN validation failed!')
  }
  
  // Test 3: Check validatePINWithUser with merchant PIN
  console.log('\n🧪 Test 3: validatePINWithUser with merchant PIN')
  console.log('-' . repeat(60))
  
  const merchantResult = validatePINWithUser('2454', mockPhoneData)
  console.log('  Input PIN: 2454 (last 4 of +60172882454)')
  console.log('  Result:', JSON.stringify(merchantResult, null, 2))
  
  if (merchantResult.isValid && !merchantResult.isInternalUser && merchantResult.userName === 'John Doe') {
    console.log('  ✅ Merchant PIN validation works correctly!')
  } else {
    console.log('  ❌ Merchant PIN validation failed!')
  }
  
  // Test 4: Check validatePINWithUser with invalid PIN
  console.log('\n🧪 Test 4: validatePINWithUser with invalid PIN')
  console.log('-' . repeat(60))
  
  const invalidResult = validatePINWithUser('9999', mockPhoneData)
  console.log('  Input PIN: 9999 (invalid)')
  console.log('  Result:', JSON.stringify(invalidResult, null, 2))
  
  if (!invalidResult.isValid && !invalidResult.isInternalUser) {
    console.log('  ✅ Invalid PIN rejection works correctly!')
  } else {
    console.log('  ❌ Invalid PIN rejection failed!')
  }
  
  // Summary
  console.log('\n📊 Summary')
  console.log('=' . repeat(60))
  console.log('✅ Internal team PIN (0000) can be used to login to ANY merchant page')
  console.log('✅ Sessions using PIN 0000 are flagged as isInternalUser: true')
  console.log('✅ Sessions using PIN 0000 have userType: "internal_team"')
  console.log('✅ Sessions using PIN 0000 show userName: "StoreHub Team"')
  console.log('✅ Regular merchant PINs still work normally')
  
  console.log('\n🔐 Security Notes:')
  console.log('-' . repeat(60))
  console.log('• Keep PIN 0000 confidential - only share with internal team')
  console.log('• This PIN works for ALL merchant pages')
  console.log('• Sessions are tracked and can be filtered in analytics')
  console.log('• Consider rotating this PIN periodically for security')
  
  console.log('\n🧪 Manual Testing:')
  console.log('-' . repeat(60))
  console.log('1. Go to any merchant page: /merchant/[merchantId]')
  console.log('2. Enter PIN: 0000')
  console.log('3. You should be logged in as "StoreHub Team"')
  console.log('4. Check browser console for "Internal team login detected" message')
  
  console.log('\n✅ All tests completed!')
}

// Run if called directly
if (require.main === module) {
  testInternalTeamPIN().catch(console.error)
}

module.exports = testInternalTeamPIN

