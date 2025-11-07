import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const eventId = searchParams.get('eventId')
  const email = searchParams.get('email') || 'azroll.jamil@storehub.com'

  if (!eventId) {
    return NextResponse.json({
      error: 'Please provide eventId parameter',
      usage: '/api/debug/check-lark-event?eventId=YOUR_EVENT_ID&email=installer@storehub.com'
    }, { status: 400 })
  }
  
  try {
    // Get the calendar ID for the user
    const calendars = await larkService.getCalendarList(email)
    const primaryCalendar = calendars.find((cal: any) => cal.type === 'primary')
    
    if (!primaryCalendar) {
      return NextResponse.json({ error: 'No primary calendar found for user' }, { status: 404 })
    }
    
    // Try to fetch the event
    const response = await larkService.makeRequest(
      `/open-apis/calendar/v4/calendars/${primaryCalendar.calendar_id}/events/${eventId}`,
      {
        method: 'GET',
        userEmail: email
      }
    )
    
    const event = response.data?.event
    
    return NextResponse.json({
      eventId,
      calendar: primaryCalendar.calendar_id,
      event: {
        summary: event?.summary,
        description: event?.description || '(NO DESCRIPTION FOUND)',
        descriptionLength: event?.description?.length || 0,
        location: event?.location,
        startTime: event?.start_time,
        endTime: event?.end_time,
        attendees: event?.attendees,
        hasDescription: !!event?.description,
        fullEvent: event
      }
    })
    
  } catch (error: any) {
    console.error('Error fetching Lark event:', error)
    return NextResponse.json({
      error: 'Failed to fetch event',
      details: error.message,
      eventId
    }, { status: 500 })
  }
}