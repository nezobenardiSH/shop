#!/usr/bin/env node

/**
 * Test calendar integration for a specific date (October 15th, 2025)
 * This will help verify if the event filtering logic is working correctly
 */

const { PrismaClient } = require('@prisma/client')

class SpecificDateTester {
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
      return null
    }

    // Check if token is expired
    const now = new Date()
    const expiryBuffer = new Date(token.expiresAt.getTime() - 5 * 60 * 1000)
    
    if (now < expiryBuffer) {
      return token.accessToken
    } else {
      return null
    }
  }

  async testSpecificDate(trainerEmail, trainerName) {
    console.log(`\n🔍 === TESTING ${trainerName} for October 15th, 2025 ===`)
    
    try {
      // Get stored calendar ID
      const tokenData = await this.prisma.larkAuthToken.findUnique({
        where: { userEmail: trainerEmail },
        select: { calendarId: true }
      })
      const calendarId = tokenData?.calendarId
      console.log(`📅 Using calendar ID: ${calendarId}`)

      // Test with exact date range for October 15th only
      const oct15Start = new Date('2025-10-15T00:00:00+08:00')
      const oct15End = new Date('2025-10-15T23:59:59+08:00')
      
      console.log(`📅 Querying for: ${oct15Start.toISOString()} to ${oct15End.toISOString()}`)
      
      const timeMin = Math.floor(oct15Start.getTime() / 1000)
      const timeMax = Math.floor(oct15End.getTime() / 1000)

      const eventsResponse = await this.makeRequest(
        `/open-apis/calendar/v4/calendars/${calendarId}/events?start_time=${timeMin}&end_time=${timeMax}`,
        {
          method: 'GET',
          userEmail: trainerEmail
        }
      )

      if (eventsResponse.code === 0) {
        const allEvents = eventsResponse.data?.items || []
        console.log(`📋 Total events returned: ${allEvents.length}`)
        
        // Filter events that actually occur on October 15th
        const oct15Events = []
        
        for (const event of allEvents) {
          if (event.start_time?.timestamp && event.end_time?.timestamp && event.status !== 'cancelled') {
            const startMs = parseInt(event.start_time.timestamp) * 1000
            const endMs = parseInt(event.end_time.timestamp) * 1000
            
            const eventStart = new Date(startMs)
            const eventEnd = new Date(endMs)
            
            // Check if event actually occurs on October 15th, 2025
            const eventStartDate = eventStart.toISOString().split('T')[0]
            const eventEndDate = eventEnd.toISOString().split('T')[0]
            
            if (eventStartDate === '2025-10-15' || eventEndDate === '2025-10-15' || 
                (eventStart <= oct15End && eventEnd >= oct15Start)) {
              oct15Events.push({
                summary: event.summary || 'No title',
                start: eventStart,
                end: eventEnd,
                status: event.status,
                startLocal: eventStart.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
                endLocal: eventEnd.toLocaleString('en-US', { timeZone: 'Asia/Singapore' })
              })
            }
          }
        }
        
        console.log(`✅ Events actually on October 15th: ${oct15Events.length}`)
        
        if (oct15Events.length === 0) {
          console.log(`📝 No events on October 15th - trainer should be available`)
        } else {
          console.log(`🚫 Events on October 15th - trainer should be BUSY:`)
          oct15Events.forEach((event, idx) => {
            console.log(`   ${idx + 1}. ${event.summary}`)
            console.log(`      ${event.startLocal} - ${event.endLocal}`)
            console.log(`      Status: ${event.status}`)
          })
        }
        
        // Check specific training time slots
        console.log(`\n⏰ Checking training time slots:`)
        const timeSlots = [
          { start: '10:00', end: '11:00', startHour: 10, endHour: 11 },
          { start: '12:00', end: '13:00', startHour: 12, endHour: 13 },
          { start: '14:30', end: '15:30', startHour: 14, startMinute: 30, endHour: 15, endMinute: 30 },
          { start: '17:00', end: '18:00', startHour: 17, endHour: 18 }
        ]
        
        timeSlots.forEach(slot => {
          const slotStart = new Date('2025-10-15T' + slot.start + ':00+08:00')
          const slotEnd = new Date('2025-10-15T' + slot.end + ':00+08:00')
          
          const conflictingEvents = oct15Events.filter(event => {
            return event.start < slotEnd && event.end > slotStart
          })
          
          if (conflictingEvents.length === 0) {
            console.log(`   ✅ ${slot.start}-${slot.end}: AVAILABLE`)
          } else {
            console.log(`   🚫 ${slot.start}-${slot.end}: BUSY (${conflictingEvents.length} conflicts)`)
            conflictingEvents.forEach(event => {
              console.log(`      - ${event.summary} (${event.startLocal} - ${event.endLocal})`)
            })
          }
        })
        
      } else {
        console.log(`❌ Calendar events failed:`, eventsResponse)
      }

    } catch (error) {
      console.log(`❌ Test failed for ${trainerName}:`, error.message)
    }
  }

  async runTest() {
    console.log(`🔍 SPECIFIC DATE TEST: October 15th, 2025`)
    console.log(`=====================================`)
    
    // Test both trainers
    await this.testSpecificDate('nezo.benardi@storehub.com', 'Nezo')
    await this.testSpecificDate('jiaen.chai@storehub.com', 'Jia En')
    
    console.log(`\n✅ Test complete!`)
  }

  async cleanup() {
    await this.prisma.$disconnect()
  }
}

// Run test
async function main() {
  const tester = new SpecificDateTester()
  try {
    await tester.runTest()
  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await tester.cleanup()
  }
}

if (require.main === module) {
  main()
}

module.exports = { SpecificDateTester }
