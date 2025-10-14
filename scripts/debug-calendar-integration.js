#!/usr/bin/env node

/**
 * Debug script to test calendar integration for both trainers
 * This will help identify why calendar events are not being detected
 */

const { PrismaClient } = require('@prisma/client')

class CalendarDebugger {
  constructor() {
    this.prisma = new PrismaClient()
    this.baseUrl = 'https://open.larksuite.com'
  }

  async makeRequest(endpoint, options = {}) {
    const { userEmail, ...fetchOptions } = options
    
    // Get valid access token for the user
    const token = await this.getValidAccessToken(userEmail)
    if (!token) {
      throw new Error(`No valid token for ${userEmail}`)
    }

    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...fetchOptions.headers
      }
    })

    const data = await response.json()
    return data
  }

  async getValidAccessToken(userEmail) {
    const token = await this.prisma.larkAuthToken.findUnique({
      where: { userEmail }
    })

    if (!token) {
      console.log(`❌ No token found for ${userEmail}`)
      return null
    }

    // Check if token is expired
    const now = new Date()
    const expiryBuffer = new Date(token.expiresAt.getTime() - 5 * 60 * 1000)
    
    if (now < expiryBuffer) {
      console.log(`✅ Token valid for ${userEmail} (expires: ${token.expiresAt})`)
      return token.accessToken
    } else {
      console.log(`⚠️ Token expired for ${userEmail} (expired: ${token.expiresAt})`)
      return null
    }
  }

  async testTrainerCalendar(trainerEmail, trainerName) {
    console.log(`\n🔍 === TESTING ${trainerName} (${trainerEmail}) ===`)
    
    try {
      // 1. Check OAuth token status
      console.log(`\n1️⃣ Checking OAuth token...`)
      const token = await this.getValidAccessToken(trainerEmail)
      if (!token) {
        console.log(`❌ No valid token - this explains why they show as available!`)
        return
      }

      // 2. Test calendar list access
      console.log(`\n2️⃣ Testing calendar list access...`)
      try {
        const calendarsResponse = await this.makeRequest('/open-apis/calendar/v4/calendars', {
          method: 'GET',
          userEmail: trainerEmail
        })
        
        if (calendarsResponse.code === 0 && calendarsResponse.data?.calendar_list) {
          console.log(`✅ Calendar list access successful`)
          console.log(`📅 Found ${calendarsResponse.data.calendar_list.length} calendars:`)
          calendarsResponse.data.calendar_list.forEach((cal, idx) => {
            console.log(`   ${idx + 1}. ${cal.summary} (${cal.calendar_id})`)
            console.log(`      Type: ${cal.type}, Role: ${cal.role}`)
          })
        } else {
          console.log(`❌ Calendar list failed:`, calendarsResponse)
        }
      } catch (error) {
        console.log(`❌ Calendar list error:`, error.message)
      }

      // 3. Get stored calendar ID
      console.log(`\n3️⃣ Checking stored calendar ID...`)
      const tokenData = await this.prisma.larkAuthToken.findUnique({
        where: { userEmail: trainerEmail },
        select: { calendarId: true }
      })
      const storedCalendarId = tokenData?.calendarId
      console.log(`📝 Stored calendar ID: ${storedCalendarId}`)

      // 4. Test calendar events for October 15th
      console.log(`\n4️⃣ Testing calendar events for October 15th...`)
      const oct15Start = new Date('2025-10-15T00:00:00+08:00')
      const oct15End = new Date('2025-10-15T23:59:59+08:00')
      const timeMin = Math.floor(oct15Start.getTime() / 1000)
      const timeMax = Math.floor(oct15End.getTime() / 1000)

      try {
        const eventsResponse = await this.makeRequest(
          `/open-apis/calendar/v4/calendars/${storedCalendarId}/events?start_time=${timeMin}&end_time=${timeMax}`,
          {
            method: 'GET',
            userEmail: trainerEmail
          }
        )

        if (eventsResponse.code === 0) {
          const events = eventsResponse.data?.items || []
          console.log(`✅ Calendar events API successful`)
          console.log(`📅 Found ${events.length} events on October 15th:`)
          
          if (events.length === 0) {
            console.log(`   📝 No events found - calendar appears empty`)
          } else {
            events.forEach((event, idx) => {
              const startTime = new Date(parseInt(event.start_time?.timestamp) * 1000)
              const endTime = new Date(parseInt(event.end_time?.timestamp) * 1000)
              console.log(`   ${idx + 1}. ${event.summary || 'No title'}`)
              console.log(`      Time: ${startTime.toLocaleString('en-US', { timeZone: 'Asia/Singapore' })} - ${endTime.toLocaleString('en-US', { timeZone: 'Asia/Singapore' })}`)
              console.log(`      Status: ${event.status}`)
            })
          }
        } else {
          console.log(`❌ Calendar events failed:`, eventsResponse)
        }
      } catch (error) {
        console.log(`❌ Calendar events error:`, error.message)
      }

      // 5. Test FreeBusy API
      console.log(`\n5️⃣ Testing FreeBusy API...`)
      try {
        const freeBusyResponse = await this.makeRequest('/open-apis/calendar/v4/freebusy/list', {
          method: 'POST',
          body: JSON.stringify({
            time_min: oct15Start.toISOString(),
            time_max: oct15End.toISOString(),
            user_id: trainerEmail,
            only_busy: true,
            include_external_calendar: true
          }),
          userEmail: trainerEmail
        })

        if (freeBusyResponse.code === 0) {
          const busyTimes = freeBusyResponse.data?.freebusy_list || []
          console.log(`✅ FreeBusy API successful`)
          console.log(`⏰ Found ${busyTimes.length} busy periods on October 15th:`)
          
          if (busyTimes.length === 0) {
            console.log(`   📝 No busy times found - appears completely free`)
          } else {
            busyTimes.forEach((busy, idx) => {
              const startTime = new Date(busy.start_time)
              const endTime = new Date(busy.end_time)
              console.log(`   ${idx + 1}. ${startTime.toLocaleString('en-US', { timeZone: 'Asia/Singapore' })} - ${endTime.toLocaleString('en-US', { timeZone: 'Asia/Singapore' })}`)
            })
          }
        } else {
          console.log(`❌ FreeBusy API failed:`, freeBusyResponse)
        }
      } catch (error) {
        console.log(`❌ FreeBusy API error:`, error.message)
      }

    } catch (error) {
      console.log(`❌ Overall test failed for ${trainerName}:`, error.message)
    }
  }

  async runDiagnostics() {
    console.log(`🔍 CALENDAR INTEGRATION DIAGNOSTICS`)
    console.log(`==================================`)
    
    // Test both trainers
    await this.testTrainerCalendar('nezo.benardi@storehub.com', 'Nezo')
    await this.testTrainerCalendar('jiaen.chai@storehub.com', 'Jia En')
    
    console.log(`\n✅ Diagnostics complete!`)
    console.log(`\n📋 SUMMARY:`)
    console.log(`- If tokens are missing/expired: OAuth re-authorization needed`)
    console.log(`- If calendar access fails: Permission issues`)
    console.log(`- If events are empty: Calendar might be empty or wrong calendar ID`)
    console.log(`- If FreeBusy fails: Expected, system should fall back to events API`)
  }

  async cleanup() {
    await this.prisma.$disconnect()
  }
}

// Run diagnostics
async function main() {
  const calendarDebugger = new CalendarDebugger()
  try {
    await calendarDebugger.runDiagnostics()
  } catch (error) {
    console.error('Diagnostics failed:', error)
  } finally {
    await calendarDebugger.cleanup()
  }
}

if (require.main === module) {
  main()
}

module.exports = { CalendarDebugger }
