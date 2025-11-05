import { NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function GET() {
  const results: any = {
    steps: [],
    error: null
  }

  try {
    results.steps.push('🔍 Starting calendar debug test for Faizul...')
    
    const installerEmail = 'norfaizul.salam@storehub.com'
    const startDate = new Date('2025-11-06T00:00:00+08:00')
    const endDate = new Date('2025-11-06T23:59:59+08:00')
    
    results.steps.push(`📧 Testing installer: ${installerEmail}`)
    results.steps.push(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    
    // Step 1: Check OAuth token
    results.steps.push('🔍 Step 1: Checking OAuth token...')
    const { larkOAuthService } = await import('@/lib/lark-oauth-service')
    const isAuthorized = await larkOAuthService.isUserAuthorized(installerEmail)
    
    if (!isAuthorized) {
      results.error = 'Installer not authorized'
      results.steps.push('❌ No OAuth token found')
      return NextResponse.json(results)
    }
    
    results.steps.push('✅ OAuth token found')

    // Step 1.5: Get Lark user ID from database
    results.steps.push('🔍 Step 1.5: Getting Lark user ID from database...')
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    const token = await prisma.larkAuthToken.findUnique({
      where: { userEmail: installerEmail },
      select: { larkUserId: true, calendarId: true }
    })

    await prisma.$disconnect()

    if (!token?.larkUserId) {
      results.error = 'No Lark user ID found'
      results.steps.push('❌ No Lark user ID in database')
      return NextResponse.json(results)
    }

    results.steps.push(`✅ Lark user ID: ${token.larkUserId}`)
    results.steps.push(`📋 Stored calendar ID: ${token.calendarId}`)
    results.larkUserId = token.larkUserId
    results.storedCalendarId = token.calendarId

    // Step 2: Get raw busy times
    results.steps.push('🔍 Step 2: Getting raw busy times from calendar...')
    results.steps.push('   This calls FreeBusy API with the Lark user ID above')
    const busyTimes = await larkService.getRawBusyTimes(
      installerEmail,
      startDate,
      endDate
    )
    
    results.steps.push(`✅ Found ${busyTimes.length} busy periods`)
    results.busyTimes = busyTimes.map((busy: any) => ({
      start: busy.start_time,
      end: busy.end_time,
      source: busy.source || 'unknown',
      startSGT: new Date(busy.start_time).toLocaleString('en-US', {
        timeZone: 'Asia/Singapore',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      endSGT: new Date(busy.end_time).toLocaleString('en-US', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    }))
    
    // Step 3: Check availability for specific time slots
    results.steps.push('🔍 Step 3: Checking availability for time slots...')
    const TIME_SLOTS = [
      { start: '10:00', end: '11:00' },
      { start: '12:00', end: '13:00' },
      { start: '15:00', end: '16:00' },
      { start: '17:00', end: '18:00' }
    ]
    
    const slotAvailability = TIME_SLOTS.map(slot => {
      const slotStart = new Date(`2025-11-06T${slot.start}:00+08:00`)
      const slotEnd = new Date(`2025-11-06T${slot.end}:00+08:00`)
      
      const isBlocked = busyTimes.some((busy: any) => {
        const busyStart = new Date(busy.start_time)
        const busyEnd = new Date(busy.end_time)
        // Check if busy period overlaps with this time slot
        return busyStart < slotEnd && busyEnd > slotStart
      })
      
      return {
        slot: `${slot.start} - ${slot.end}`,
        available: !isBlocked,
        blockedBy: isBlocked ? busyTimes.filter((busy: any) => {
          const busyStart = new Date(busy.start_time)
          const busyEnd = new Date(busy.end_time)
          return busyStart < slotEnd && busyEnd > slotStart
        }).map((b: any) => b.source) : []
      }
    })
    
    results.slotAvailability = slotAvailability
    results.steps.push(`✅ Slot availability calculated`)

    // Step 4: Check Calendar Events API to see ALL events (including Free ones)
    results.steps.push('🔍 Step 4: Checking Calendar Events API for ALL events (including Free)...')

    const { larkService } = await import('@/lib/lark')
    const timeMin = Math.floor(startDate.getTime() / 1000)
    const timeMax = Math.floor(endDate.getTime() / 1000)

    try {
      const eventsResponse = await larkService.makeRequest(
        `/open-apis/calendar/v4/calendars/primary/events?start_time=${timeMin}&end_time=${timeMax}`,
        {
          method: 'GET',
          userEmail: installerEmail
        }
      )

      if (eventsResponse.data?.items?.length > 0) {
        results.steps.push(`✅ Found ${eventsResponse.data.items.length} calendar events`)
        results.allEvents = eventsResponse.data.items.map((event: any) => ({
          summary: event.summary || 'No title',
          start: event.start_time?.timestamp ? new Date(parseInt(event.start_time.timestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }) : 'N/A',
          end: event.end_time?.timestamp ? new Date(parseInt(event.end_time.timestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }) : 'N/A',
          status: event.status,
          freeBusyStatus: event.free_busy_status || 'not set',
          isRecurring: !!event.recurrence
        }))

        const freeEvents = results.allEvents.filter((e: any) => e.freeBusyStatus === 'free')
        const busyEvents = results.allEvents.filter((e: any) => e.freeBusyStatus === 'busy')

        results.steps.push(`   📊 ${busyEvents.length} events marked as BUSY`)
        results.steps.push(`   📊 ${freeEvents.length} events marked as FREE`)

        if (freeEvents.length > 0) {
          results.steps.push(`   ⚠️ FREE events will NOT block availability!`)
          results.steps.push(`   💡 Solution: Mark these events as BUSY in Lark calendar`)
        }
      } else {
        results.steps.push(`⚠️ No calendar events found`)
      }
    } catch (error: any) {
      results.steps.push(`❌ Calendar Events API error: ${error.message}`)
    }

    return NextResponse.json(results, { status: 200 })
    
  } catch (error: any) {
    results.error = error.message
    results.steps.push(`❌ Error: ${error.message}`)
    return NextResponse.json(results, { status: 500 })
  }
}

