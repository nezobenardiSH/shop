import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkNezoPermissions() {
  try {
    console.log('🔍 Checking Nezo\'s Lark OAuth permissions...\n')
    
    const nezoAuth = await prisma.larkAuthToken.findUnique({
      where: { userEmail: 'nezo.benardi@storehub.com' }
    })
    
    if (!nezoAuth) {
      console.log('❌ No OAuth token found for nezo.benardi@storehub.com')
      console.log('   Nezo needs to authorize the app at /trainers/authorize')
      return
    }
    
    console.log('✅ OAuth token found for Nezo')
    console.log('📋 Details:')
    console.log(`   User Name: ${nezoAuth.userName}`)
    console.log(`   Lark User ID: ${nezoAuth.larkUserId}`)
    console.log(`   Calendar ID: ${nezoAuth.calendarId || 'Not set'}`)
    console.log(`   Token Expires: ${nezoAuth.expiresAt}`)
    console.log(`   Scopes: ${nezoAuth.scopes || 'Not recorded'}`)
    console.log()
    
    // Check if the required scope is present
    const requiredScope = 'calendar:calendar.event:create'
    const hasCreatePermission = nezoAuth.scopes?.includes(requiredScope)
    
    console.log('🔐 Permission Check:')
    console.log(`   Has "${requiredScope}": ${hasCreatePermission ? '✅ YES' : '❌ NO'}`)
    console.log()
    
    if (!hasCreatePermission) {
      console.log('⚠️  ISSUE FOUND:')
      console.log('   Nezo\'s token does NOT have calendar event creation permission!')
      console.log('   This is why bookings fail with "no calendar access_role" error.')
      console.log()
      console.log('📝 Solution:')
      console.log('   1. Go to /trainers/authorize')
      console.log('   2. Click "Revoke" next to Nezo\'s name')
      console.log('   3. Click "Authorize" again')
      console.log('   4. Grant ALL permissions when Lark asks')
      console.log()
    } else {
      console.log('✅ Nezo has the correct permissions!')
      console.log('   If bookings still fail, the issue is elsewhere.')
      console.log()
    }
    
    // Check all required scopes
    const requiredScopes = [
      'calendar:calendar',
      'calendar:calendar.event:create',
      'calendar:calendar.event:read',
      'calendar:calendar.event:update',
      'calendar:calendar.event:delete',
      'calendar:calendar.free_busy:read'
    ]
    
    console.log('📊 Full Scope Analysis:')
    requiredScopes.forEach(scope => {
      const hasScope = nezoAuth.scopes?.includes(scope)
      console.log(`   ${hasScope ? '✅' : '❌'} ${scope}`)
    })
    
  } catch (error) {
    console.error('Error checking permissions:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkNezoPermissions()

