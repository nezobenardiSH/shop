import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email = 'azroll.jamil@storehub.com',
      testDescription = 'This is a test description to see if Lark accepts it'
    } = body
    
    // Get the calendar ID for the user
    const calendars = await larkService.getCalendarList(email)
    const primaryCalendar = calendars.find((cal: any) => cal.type === 'primary')
    
    if (!primaryCalendar) {
      return NextResponse.json({ error: 'No primary calendar found for user' }, { status: 404 })
    }
    
    // Create a test event with description
    const now = new Date()
    const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // 1 hour later
    
    const testEvent = {
      summary: 'TEST: Description Test Event',
      description: testDescription,
      start_time: {
        timestamp: Math.floor(startTime.getTime() / 1000).toString(),
        timezone: 'Asia/Singapore'
      },
      end_time: {
        timestamp: Math.floor(endTime.getTime() / 1000).toString(),
        timezone: 'Asia/Singapore'
      },
      visibility: 'default',
      need_notification: false
    }
    
    console.log('📤 Creating test event with description:')
    console.log(JSON.stringify(testEvent, null, 2))
    
    const result = await larkService.createCalendarEvent(
      primaryCalendar.calendar_id,
      testEvent,
      email
    )
    
    // Try to fetch the created event to see if description was saved
    let createdEvent = null
    try {
      const eventId = (result as any).event_id
      if (eventId) {
        const fetchResponse = await larkService.makeRequest(
          `/open-apis/calendar/v4/calendars/${primaryCalendar.calendar_id}/events/${eventId}`,
          {
            method: 'GET',
            userEmail: email
          }
        )
        createdEvent = fetchResponse.data?.event
      }
    } catch (e) {
      console.error('Could not fetch created event:', e)
    }

    return NextResponse.json({
      success: true,
      eventId: (result as any).event_id,
      descriptionSent: testDescription,
      descriptionLength: testDescription.length,
      createdEvent: createdEvent ? {
        summary: createdEvent.summary,
        hasDescription: !!createdEvent.description,
        descriptionReceived: createdEvent.description || '(NO DESCRIPTION IN RESPONSE)',
        descriptionMatches: createdEvent.description === testDescription
      } : null,
      fullResult: result
    })
    
  } catch (error: any) {
    console.error('Error creating test event:', error)
    return NextResponse.json({
      error: 'Failed to create test event',
      details: error.message
    }, { status: 500 })
  }
}