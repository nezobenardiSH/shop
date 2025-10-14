import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function GET(request: NextRequest) {
  const results: any = {
    success: false,
    steps: [],
    error: null
  }

  try {
    results.steps.push('🔍 Comparing FreeBusy API vs Calendar Events API...')
    
    const trainerEmail = 'nezo.benardi@storehub.com'
    const startDate = new Date('2025-10-15T00:00:00+08:00')
    const endDate = new Date('2025-10-15T23:59:59+08:00')
    
    results.steps.push(`📧 Testing trainer: ${trainerEmail}`)
    results.steps.push(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    
    // Get OAuth token
    const { larkOAuthService } = await import('@/lib/lark-oauth-service')
    const accessToken = await larkOAuthService.getValidAccessToken(trainerEmail)

    if (!accessToken) {
      results.error = 'No valid token'
      return NextResponse.json(results, { status: 401 })
    }

    // Get calendar ID
    const { CalendarIdManager } = await import('@/lib/calendar-id-manager')
    const calendarId = await CalendarIdManager.getResolvedCalendarId(trainerEmail)
    results.steps.push(`📝 Calendar ID: ${calendarId}`)

    // Test 1: FreeBusy API
    results.steps.push('\n🔍 TEST 1: FreeBusy API')
    const freeBusyUrl = 'https://open.larksuite.com/open-apis/calendar/v4/freebusy/list'
    const freeBusyBody = {
      user_id_list: [trainerEmail],
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString()
    }

    const freeBusyResponse = await fetch(freeBusyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(freeBusyBody)
    })
    
    const freeBusyData = await freeBusyResponse.json()
    results.steps.push(`📡 FreeBusy Response Code: ${freeBusyData.code}`)
    
    const freeBusyList = freeBusyData.data?.freebusy_list || []
    const userFreeBusy = freeBusyList[0]
    const freeBusyTimes = userFreeBusy?.busy_time || []
    
    results.steps.push(`📊 FreeBusy API returned ${freeBusyTimes.length} busy periods`)
    
    // Test 2: Calendar Events API
    results.steps.push('\n🔍 TEST 2: Calendar Events API')
    const timeMin = Math.floor(startDate.getTime() / 1000)
    const timeMax = Math.floor(endDate.getTime() / 1000)
    
    const eventsUrl = `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events?start_time=${timeMin}&end_time=${timeMax}`
    
    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    const eventsData = await eventsResponse.json()
    results.steps.push(`📡 Events Response Code: ${eventsData.code}`)
    
    const allEvents = eventsData.data?.items || []
    results.steps.push(`📅 Calendar Events API returned ${allEvents.length} events`)
    
    // Filter for Oct 15th events
    const oct15Events = allEvents.filter((event: any) => {
      if (!event.start_time?.timestamp) return false
      const eventDate = new Date(parseInt(event.start_time.timestamp) * 1000)
      const eventDateStr = eventDate.toISOString().split('T')[0]
      return eventDateStr === '2025-10-15'
    })

    results.steps.push(`📅 Found ${oct15Events.length} events on October 15th`)

    // Log all events with their recurrence info
    results.steps.push('\n📋 ALL EVENTS DETAILS:')
    for (const event of allEvents) {
      const startTime = event.start_time?.timestamp ? new Date(parseInt(event.start_time.timestamp) * 1000).toISOString() : 'N/A'
      results.steps.push(`  - "${event.summary || 'No title'}"`)
      results.steps.push(`    Start: ${startTime}`)
      results.steps.push(`    Status: ${event.status}`)
      results.steps.push(`    Recurrence: ${event.recurrence || 'none'}`)
      results.steps.push(`    Event ID: ${event.event_id}`)
    }
    
    // Compare results
    results.steps.push('\n📊 COMPARISON:')
    results.steps.push(`FreeBusy API: ${freeBusyTimes.length} busy periods`)
    results.steps.push(`Calendar Events API: ${oct15Events.length} events on Oct 15th`)
    
    if (freeBusyTimes.length !== oct15Events.length) {
      results.steps.push(`⚠️ MISMATCH! FreeBusy API is missing ${oct15Events.length - freeBusyTimes.length} events`)
    }
    
    results.success = true
    results.summary = {
      trainerEmail,
      calendarId,
      freeBusy: {
        count: freeBusyTimes.length,
        periods: freeBusyTimes.map((busy: any) => ({
          start: busy.start_time,
          end: busy.end_time,
          startLocal: new Date(busy.start_time).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
          endLocal: new Date(busy.end_time).toLocaleString('en-US', { timeZone: 'Asia/Singapore' })
        }))
      },
      calendarEvents: {
        totalEvents: allEvents.length,
        oct15Events: oct15Events.length,
        events: oct15Events.map((event: any) => ({
          summary: event.summary,
          start: new Date(parseInt(event.start_time.timestamp) * 1000).toISOString(),
          end: new Date(parseInt(event.end_time.timestamp) * 1000).toISOString(),
          startLocal: new Date(parseInt(event.start_time.timestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
          endLocal: new Date(parseInt(event.end_time.timestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
          status: event.status,
          recurrence: event.recurrence || 'none'
        }))
      },
      mismatch: freeBusyTimes.length !== oct15Events.length
    }
    
    return NextResponse.json(results)
  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Unknown error'
    results.steps.push(`❌ Error: ${results.error}`)
    return NextResponse.json(results, { status: 500 })
  }
}

