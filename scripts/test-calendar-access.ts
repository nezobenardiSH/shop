import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testCalendarAccess() {
  try {
    console.log('🔍 Testing calendar access for all trainers...\n')
    
    // Get all authorized trainers
    const trainers = await prisma.larkAuthToken.findMany()
    
    if (trainers.length === 0) {
      console.log('❌ No authorized trainers found')
      return
    }
    
    console.log(`Found ${trainers.length} authorized trainers:\n`)
    
    for (const trainer of trainers) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`👤 ${trainer.userName} (${trainer.userEmail})`)
      console.log(`${'='.repeat(60)}`)
      console.log(`📋 Lark User ID: ${trainer.larkUserId}`)
      console.log(`📅 Calendar ID: ${trainer.calendarId || 'Not set'}`)
      console.log(`🔐 Scopes: ${trainer.scopes || 'Not recorded'}`)
      console.log(`⏰ Token Expires: ${trainer.expiresAt}`)
      
      // Check if token is expired
      const now = new Date()
      const isExpired = trainer.expiresAt < now
      console.log(`⏱️  Token Status: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`)
      
      // Check required scopes
      const requiredScopes = [
        'calendar:calendar',
        'calendar:calendar.event:create',
        'calendar:calendar.event:read',
        'calendar:calendar.event:update',
        'calendar:calendar.event:delete',
        'calendar:calendar.free_busy:read'
      ]
      
      console.log('\n📊 Scope Check:')
      let allScopesPresent = true
      requiredScopes.forEach(scope => {
        const hasScope = trainer.scopes?.includes(scope)
        console.log(`   ${hasScope ? '✅' : '❌'} ${scope}`)
        if (!hasScope) allScopesPresent = false
      })
      
      // Test calendar access
      console.log('\n🧪 Testing Calendar Access:')
      
      if (isExpired) {
        console.log('   ⚠️  Cannot test - token is expired')
        console.log('   📝 Action: Trainer needs to re-authorize')
        continue
      }
      
      if (!allScopesPresent) {
        console.log('   ⚠️  Cannot test - missing required scopes')
        console.log('   📝 Action: Trainer needs to re-authorize with all scopes')
        continue
      }
      
      // Import larkService to test actual API calls
      const { larkService } = await import('../lib/lark')
      
      try {
        // Test 1: Get calendar list
        console.log('   🔍 Test 1: Fetching calendar list...')
        const calendars = await larkService.getCalendarList(trainer.userEmail)
        console.log(`   ✅ Success! Found ${calendars.length} calendars`)
        
        // Show calendars with access roles
        console.log('\n   📋 Calendars:')
        calendars.forEach((cal: any, index: number) => {
          console.log(`      ${index + 1}. ${cal.summary || 'Unnamed Calendar'}`)
          console.log(`         ID: ${cal.calendar_id}`)
          console.log(`         Role: ${cal.role || 'N/A'}`)
          console.log(`         Type: ${cal.type || 'N/A'}`)
          
          // Check if this is the stored calendar ID
          if (cal.calendar_id === trainer.calendarId) {
            console.log(`         ⭐ This is the stored calendar ID`)
            console.log(`         🔐 Access Role: ${cal.role}`)
            
            // Check if role allows event creation
            const canCreate = ['owner', 'writer', 'editor'].includes(cal.role?.toLowerCase() || '')
            if (canCreate) {
              console.log(`         ✅ CAN create events (role: ${cal.role})`)
            } else {
              console.log(`         ❌ CANNOT create events (role: ${cal.role})`)
              console.log(`         ⚠️  THIS IS THE PROBLEM!`)
            }
          }
        })
        
        // Test 2: Check if stored calendar ID has write access
        console.log('\n   🔍 Test 2: Checking stored calendar ID access...')
        const storedCal = calendars.find((cal: any) => cal.calendar_id === trainer.calendarId)
        
        if (!storedCal) {
          console.log(`   ❌ Stored calendar ID not found in user's calendar list!`)
          console.log(`   ⚠️  Calendar ID: ${trainer.calendarId}`)
          console.log(`   📝 Action: Need to update calendar ID to user's primary calendar`)
        } else {
          const role = storedCal.role?.toLowerCase() || ''
          const canWrite = ['owner', 'writer', 'editor'].includes(role)
          
          if (canWrite) {
            console.log(`   ✅ Stored calendar has write access (role: ${storedCal.role})`)
          } else {
            console.log(`   ❌ Stored calendar has READ-ONLY access (role: ${storedCal.role})`)
            console.log(`   ⚠️  THIS IS WHY "no calendar access_role" ERROR OCCURS!`)
            console.log(`   📝 Action: Update calendar ID to a calendar with write access`)
          }
        }
        
        // Find primary calendar
        console.log('\n   🔍 Test 3: Finding primary calendar...')
        const primaryCal = calendars.find((cal: any) => 
          cal.type === 'primary' || cal.role === 'owner'
        )
        
        if (primaryCal) {
          console.log(`   ✅ Found primary calendar:`)
          console.log(`      ID: ${primaryCal.calendar_id}`)
          console.log(`      Name: ${primaryCal.summary}`)
          console.log(`      Role: ${primaryCal.role}`)
          
          if (primaryCal.calendar_id !== trainer.calendarId) {
            console.log(`   ⚠️  Primary calendar ID differs from stored ID!`)
            console.log(`   📝 Recommendation: Update to primary calendar ID`)
          }
        } else {
          console.log(`   ⚠️  Could not identify primary calendar`)
        }
        
      } catch (error: any) {
        console.log(`   ❌ API Test Failed: ${error.message}`)
      }
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('📝 Summary & Recommendations:')
    console.log('='.repeat(60))
    console.log('\nIf you see "no calendar access_role" errors, the issue is likely:')
    console.log('1. The stored calendar ID points to a calendar the user can only READ')
    console.log('2. The user needs WRITE access (owner/writer/editor role) to create events')
    console.log('3. Solution: Update the calendar ID to the user\'s primary calendar')
    console.log('\nTo fix: Re-authorize each trainer to refresh their calendar ID')
    
  } catch (error) {
    console.error('Error testing calendar access:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testCalendarAccess()

