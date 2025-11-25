import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import { CalendarIdManager } from '@/lib/calendar-id-manager'

/**
 * Search for events in a trainer's calendar and optionally delete them
 *
 * POST /api/lark/search-and-delete
 * Body: {
 *   trainerEmail: string,
 *   searchTerm: string,      // Search in event title
 *   date: string,            // YYYY-MM-DD format
 *   deleteIfFound: boolean   // If true, delete matching events
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { trainerEmail, searchTerm, date, deleteIfFound } = await request.json()

    if (!trainerEmail || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: trainerEmail, date' },
        { status: 400 }
      )
    }

    console.log('🔍 Search and delete request:')
    console.log(`   Trainer: ${trainerEmail}`)
    console.log(`   Search term: ${searchTerm || 'any'}`)
    console.log(`   Date: ${date}`)
    console.log(`   Delete if found: ${deleteIfFound}`)

    // Get the trainer's calendar ID
    const calendarId = await CalendarIdManager.getResolvedCalendarId(trainerEmail)
    console.log(`   Calendar ID: ${calendarId}`)

    // Calculate date range (the specified date, full day)
    const startDate = new Date(`${date}T00:00:00+08:00`)
    const endDate = new Date(`${date}T23:59:59+08:00`)

    // Convert to Unix timestamps (seconds)
    const startTimestamp = Math.floor(startDate.getTime() / 1000).toString()
    const endTimestamp = Math.floor(endDate.getTime() / 1000).toString()

    console.log(`   Start: ${startTimestamp} (${startDate.toISOString()})`)
    console.log(`   End: ${endTimestamp} (${endDate.toISOString()})`)

    // Get events for this date range
    const eventsResponse = await larkService.listCalendarEvents(
      calendarId,
      startTimestamp,
      endTimestamp,
      trainerEmail
    )

    const events = eventsResponse?.items || []
    console.log(`📋 Found ${events.length} events on ${date}`)

    const matchingEvents: any[] = []
    const deletedEvents: any[] = []

    for (const event of events) {
      const title = event.summary || ''
      console.log(`   - ${title} (ID: ${event.event_id})`)

      // Check if event matches search term (if provided)
      if (!searchTerm || title.toLowerCase().includes(searchTerm.toLowerCase())) {
        matchingEvents.push({
          id: event.event_id,
          title: title,
          start: event.start_time,
          end: event.end_time
        })

        // Delete if requested
        if (deleteIfFound) {
          try {
            await larkService.deleteCalendarEvent(calendarId, event.event_id, trainerEmail)
            console.log(`   ✅ Deleted: ${title}`)
            deletedEvents.push({
              id: event.event_id,
              title: title
            })
          } catch (deleteError: any) {
            console.log(`   ❌ Failed to delete ${title}: ${deleteError.message}`)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      trainerEmail,
      date,
      searchTerm,
      totalEvents: events.length,
      matchingEvents,
      deletedEvents,
      message: deleteIfFound
        ? `Deleted ${deletedEvents.length} event(s)`
        : `Found ${matchingEvents.length} matching event(s)`
    })

  } catch (error: any) {
    console.error('❌ Search and delete failed:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search/delete events' },
      { status: 500 }
    )
  }
}
