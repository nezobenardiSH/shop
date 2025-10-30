require('dotenv').config({ path: '.env.local' })

async function testApiResponse() {
  try {
    const merchantId = 'a0yQ9000003aAvBIAU'
    const apiUrl = `http://localhost:3010/api/salesforce/merchant/${merchantId}`
    
    console.log('🔍 Testing API response for merchant:', merchantId)
    console.log('📡 Calling:', apiUrl)
    console.log('')
    
    const response = await fetch(apiUrl)
    const data = await response.json()
    
    if (data.success && data.onboardingTrainerData && data.onboardingTrainerData[0]) {
      const trainerData = data.onboardingTrainerData[0]
      
      console.log('✅ API Response received')
      console.log('')
      console.log('📊 Installation Data:')
      console.log(`   Installation Date: ${trainerData.installationDate || 'NOT SET'}`)
      console.log(`   Installer Name: ${trainerData.installerName || 'NOT SET'}`)
      console.log(`   Installation Event ID: ${trainerData.installationEventId || 'NOT SET'}`)
      console.log('')
      
      // Check what type of value we're getting for installerName
      if (trainerData.installerName) {
        // Check if it looks like a Salesforce ID (15 or 18 characters starting with specific prefixes)
        const looksLikeId = /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(trainerData.installerName) && 
                           trainerData.installerName.startsWith('005')
        
        if (looksLikeId) {
          console.log('⚠️  WARNING: installerName appears to be a User ID, not a name!')
          console.log(`   Value: ${trainerData.installerName}`)
          console.log('   This should be displaying the actual user name instead.')
        } else {
          console.log('✅ installerName is displaying a name (not an ID)')
          console.log(`   Value: "${trainerData.installerName}"`)
        }
      }
    } else {
      console.log('❌ Failed to get trainer data:', data.message || 'Unknown error')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Run if called directly
if (require.main === module) {
  testApiResponse()
}

module.exports = testApiResponse