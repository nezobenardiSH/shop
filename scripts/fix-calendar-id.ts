/**
 * Script to fix calendar IDs in the database
 * Finds writable calendars for all authorized users and updates the database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Calendar {
  calendar_id: string
  summary: string
  role: string
  permissions?: string
  type?: string
}

async function getWritableCalendar(accessToken: string, userEmail: string): Promise<string | null> {
  try {
    const response = await fetch('https://open.larksuite.com/open-apis/calendar/v4/calendars', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    const data = await response.json()
    
    if (data.code === 0 && data.data?.calendar_list) {
      const calendars: Calendar[] = data.data.calendar_list
      
      console.log(`\n🔍 Analyzing calendars for ${userEmail}:`)
      console.log(`   Total calendars: ${calendars.length}`)
      
      // Show all owner calendars
      const ownerCalendars = calendars.filter((cal: Calendar) => cal.role === 'owner')
      console.log(`\n   Owner calendars (${ownerCalendars.length}):`)
      ownerCalendars.forEach((cal: Calendar, idx: number) => {
        console.log(`   ${idx + 1}. ${cal.summary || 'No title'}`)
        console.log(`      ID: ${cal.calendar_id}`)
        console.log(`      Permissions: ${cal.permissions || 'none'}`)
        console.log(`      Type: ${cal.type || 'unknown'}`)
      })
      
      // PRIORITY 1: Find PRIMARY type calendar (native Lark calendar, not synced from Google)
      // Google synced calendars (type: 'google') cannot be written to via Lark API
      const primaryCalendar = calendars.find((cal: Calendar) =>
        cal.type === 'primary' &&
        cal.role === 'owner'
      )

      if (primaryCalendar) {
        console.log(`\n✅ Found primary Lark calendar: ${primaryCalendar.calendar_id}`)
        console.log(`   Summary: ${primaryCalendar.summary}`)
        console.log(`   Type: ${primaryCalendar.type}`)
        console.log(`   Role: ${primaryCalendar.role}`)
        return primaryCalendar.calendar_id
      }

      // PRIORITY 2: Find any owner calendar that is NOT a Google sync
      const nativeCalendar = calendars.find((cal: Calendar) =>
        cal.role === 'owner' &&
        cal.type !== 'google'
      )

      if (nativeCalendar) {
        console.log(`\n✅ Found native Lark calendar: ${nativeCalendar.calendar_id}`)
        console.log(`   Type: ${nativeCalendar.type}`)
        return nativeCalendar.calendar_id
      }

      // PRIORITY 3: Fallback to any owner calendar (may be Google sync - might not work)
      const ownerCalendar = calendars.find((cal: Calendar) => cal.role === 'owner')
      if (ownerCalendar) {
        console.log(`\n⚠️ Using owner calendar (may be Google sync): ${ownerCalendar.calendar_id}`)
        console.log(`   Type: ${ownerCalendar.type}`)
        return ownerCalendar.calendar_id
      }
      
      console.log(`\n❌ No suitable calendar found`)
      return null
    }
    
    console.log(`\n❌ Failed to get calendar list: ${data.msg}`)
    return null
  } catch (error) {
    console.error(`\n❌ Error fetching calendars:`, error)
    return null
  }
}

async function fixCalendarIds() {
  try {
    console.log('🔧 Fixing calendar IDs for all authorized users...\n')
    
    // Get all authorized users
    const tokens = await prisma.larkAuthToken.findMany()
    
    console.log(`Found ${tokens.length} authorized users\n`)
    
    for (const token of tokens) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`Processing: ${token.userName || token.userEmail}`)
      console.log(`Email: ${token.userEmail}`)
      console.log(`Current Calendar ID: ${token.calendarId || 'none'}`)

      // Skip if no access token
      if (!token.accessToken) {
        console.log(`⚠️ No access token, skipping...`)
        continue
      }

      // Get writable calendar
      const newCalendarId = await getWritableCalendar(token.accessToken, token.userEmail)
      
      if (newCalendarId && newCalendarId !== token.calendarId) {
        console.log(`\n📝 Updating calendar ID...`)
        console.log(`   Old: ${token.calendarId}`)
        console.log(`   New: ${newCalendarId}`)
        
        await prisma.larkAuthToken.update({
          where: { userEmail: token.userEmail },
          data: { calendarId: newCalendarId }
        })
        
        console.log(`✅ Updated successfully!`)
      } else if (newCalendarId === token.calendarId) {
        console.log(`\n✅ Calendar ID is already correct`)
      } else {
        console.log(`\n⚠️ Could not find a better calendar ID`)
      }
    }
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n✅ Finished processing all users`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
fixCalendarIds()

