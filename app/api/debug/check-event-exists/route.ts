import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const eventId = searchParams.get('eventId')
  const calendarId = searchParams.get('calendarId')
  const userEmail = searchParams.get('userEmail')
  
  if (!eventId || !calendarId) {
    return NextResponse.json({ 
      error: 'Missing required parameters: eventId and calendarId' 
    }, { status: 400 })
  }

  try {
    console.log('🔍 Checking if event exists:', {
      eventId,
      calendarId,
      userEmail
    })

    // Try to fetch the event
    const response = await larkService.makeRequest(
      `/open-apis/calendar/v4/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'GET',
        userEmail: userEmail || undefined
      }
    )

    return NextResponse.json({
      exists: true,
      event: response.event,
      message: 'Event found in calendar'
    })
  } catch (error: any) {
    console.error('Event check failed:', error.message)
    
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return NextResponse.json({
        exists: false,
        message: 'Event does not exist in this calendar',
        error: error.message
      })
    }
    
    return NextResponse.json({
      exists: 'unknown',
      message: 'Failed to check event existence',
      error: error.message,
      details: {
        eventId,
        calendarId,
        userEmail
      }
    }, { status: 500 })
  }
}