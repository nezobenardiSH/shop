import { NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import { CalendarIdManager } from '@/lib/calendar-id-manager'
import { larkOAuthService } from '@/lib/lark-oauth-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    trainerEmail: 'jiaen.chai@storehub.com',
    date: '2025-10-15',
    steps: []
  }

  try {
    const trainerEmail = 'jiaen.chai@storehub.com'

    // Test date: Oct 15, 2025
    const startDate = new Date('2025-10-15T00:00:00+08:00')
    const endDate = new Date('2025-10-15T23:59:59+08:00')

    results.steps.push(`Testing date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Get calendar ID
    const calendarId = await CalendarIdManager.getResolvedCalendarId(trainerEmail)
    results.calendarId = calendarId
    results.steps.push(`Using calendar ID: ${calendarId}`)

    // Get access token
    const accessToken = await larkOAuthService.getValidAccessToken(trainerEmail)

    // Get raw calendar events
    const timeMin = Math.floor(startDate.getTime() / 1000)
    const timeMax = Math.floor(endDate.getTime() / 1000)

    results.steps.push(`Querying Calendar Events API...`)
    results.steps.push(`Time range: ${timeMin} to ${timeMax}`)

    const eventsResponse = await fetch(
      `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events?start_time=${timeMin}&end_time=${timeMax}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    ).then(res => res.json())
    
    if (eventsResponse.data?.items) {
      const allEvents = eventsResponse.data.items
      results.steps.push(`✅ Found ${allEvents.length} calendar events`)
      
      // Categorize events
      const recurringEvents: any[] = []
      const oneTimeEvents: any[] = []
      
      for (const event of allEvents) {
        const eventInfo: any = {
          event_id: event.event_id,
          summary: event.summary || 'No title',
          status: event.status,
          has_recurrence: !!event.recurrence,
          recurrence_rule: event.recurrence || null
        }
        
        if (event.start_time?.timestamp && event.end_time?.timestamp) {
          const startMs = parseInt(event.start_time.timestamp) * 1000
          const endMs = parseInt(event.end_time.timestamp) * 1000
          const start = new Date(startMs)
          const end = new Date(endMs)
          
          eventInfo.start_utc = start.toISOString()
          eventInfo.end_utc = end.toISOString()
          eventInfo.start_sgt = start.toLocaleString('en-US', {
            timeZone: 'Asia/Singapore',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
          eventInfo.end_sgt = end.toLocaleString('en-US', {
            timeZone: 'Asia/Singapore',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        }
        
        if (event.recurrence) {
          recurringEvents.push(eventInfo)
        } else {
          oneTimeEvents.push(eventInfo)
        }
      }
      
      results.recurringEvents = recurringEvents
      results.oneTimeEvents = oneTimeEvents
      results.steps.push(`📊 ${recurringEvents.length} recurring events, ${oneTimeEvents.length} one-time events`)
      
      // For each recurring event, fetch instances
      results.recurringEventInstances = []
      
      for (const recEvent of recurringEvents) {
        results.steps.push(`🔍 Fetching instances for: "${recEvent.summary}"`)
        
        try {
          const instancesResponse = await fetch(
            `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events/${recEvent.event_id}/instances?start_time=${timeMin}&end_time=${timeMax}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          ).then(res => res.json())
          
          if (instancesResponse.data?.items) {
            const instances = instancesResponse.data.items.map((inst: any) => {
              const startMs = parseInt(inst.start_time.timestamp) * 1000
              const endMs = parseInt(inst.end_time.timestamp) * 1000
              const start = new Date(startMs)
              const end = new Date(endMs)
              
              return {
                event_id: inst.event_id,
                status: inst.status,
                start_utc: start.toISOString(),
                end_utc: end.toISOString(),
                start_sgt: start.toLocaleString('en-US', {
                  timeZone: 'Asia/Singapore',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                }),
                end_sgt: end.toLocaleString('en-US', {
                  timeZone: 'Asia/Singapore',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })
              }
            })
            
            results.recurringEventInstances.push({
              event_summary: recEvent.summary,
              event_id: recEvent.event_id,
              recurrence_rule: recEvent.recurrence_rule,
              instances_count: instances.length,
              instances: instances
            })
            
            results.steps.push(`  ✅ Found ${instances.length} instances`)
          } else {
            results.steps.push(`  ⚠️ No instances returned`)
          }
        } catch (error) {
          results.steps.push(`  ❌ Error fetching instances: ${error instanceof Error ? error.message : 'Unknown'}`)
        }
      }
      
      // Summary
      results.summary = {
        total_events: allEvents.length,
        recurring_events: recurringEvents.length,
        one_time_events: oneTimeEvents.length,
        expected_on_oct15: [
          '9:45-10:00 AM (recurring Mon, Wed, Fri)',
          '11:00 AM-12:00 PM (recurring every Wed)'
        ]
      }
      
    } else {
      results.steps.push(`❌ No events returned from Calendar Events API`)
    }
    
    return NextResponse.json(results, { status: 200 })
    
  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Unknown error'
    results.stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(results, { status: 500 })
  }
}

