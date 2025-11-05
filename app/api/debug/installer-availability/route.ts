import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import { getInternalInstallersAvailability } from '@/lib/installer-availability'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get('date') || '2025-11-06'
  const installerEmail = searchParams.get('email') || 'norfaizul.salam@storehub.com'
  
  const results: any = {
    date,
    installerEmail,
    steps: [],
    error: null
  }

  try {
    results.steps.push('🔍 Starting installer availability debug...')
    
    const startDate = new Date(`${date}T00:00:00+08:00`)
    const endDate = new Date(`${date}T23:59:59+08:00`)
    
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

    // Step 2: Get Lark user ID
    results.steps.push('🔍 Step 2: Getting Lark user ID...')
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
    results.larkUserId = token.larkUserId

    // Step 3: Test FreeBusy API directly
    results.steps.push('🔍 Step 3: Testing FreeBusy API directly...')
    
    try {
      const freeBusyResponse = await larkService.getFreeBusySchedule(
        [installerEmail],
        startDate,
        endDate,
        installerEmail
      )
      
      results.steps.push(`✅ FreeBusy API call successful`)
      results.freeBusyResponse = {
        code: freeBusyResponse.code,
        msg: freeBusyResponse.msg,
        dataExists: !!freeBusyResponse.data,
        freebusyListLength: freeBusyResponse.data?.freebusy_list?.length || 0
      }
      
      if (freeBusyResponse.data?.freebusy_list) {
        // Handle both nested and flat response formats
        const rawList = freeBusyResponse.data.freebusy_list
        let busyPeriods: any[] = []
        
        if (rawList.length > 0) {
          const firstItem = rawList[0]
          
          // Check if it's nested format (with user_id and busy_time array)
          if (firstItem.busy_time && Array.isArray(firstItem.busy_time)) {
            for (const userFreeBusy of rawList) {
              if (userFreeBusy.busy_time && Array.isArray(userFreeBusy.busy_time)) {
                busyPeriods.push(...userFreeBusy.busy_time)
              }
            }
            results.freeBusyFormat = 'nested (user_id with busy_time array)'
          } 
          // Check if it's flat format (direct busy times)
          else if ((firstItem as any).start_time && (firstItem as any).end_time) {
            busyPeriods = rawList
            results.freeBusyFormat = 'flat (direct busy times)'
          }
        }
        
        results.freeBusyData = busyPeriods.slice(0, 10).map((busy: any) => ({
          start: busy.start_time,
          end: busy.end_time,
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
      }
    } catch (error: any) {
      results.steps.push(`❌ FreeBusy API error: ${error.message}`)
      results.freeBusyError = error.message
    }

    // Step 4: Get raw busy times (combined approach)
    results.steps.push('🔍 Step 4: Getting raw busy times (FreeBusy + Calendar Events)...')
    const busyTimes = await larkService.getRawBusyTimes(
      installerEmail,
      startDate,
      endDate
    )
    
    results.steps.push(`✅ Found ${busyTimes.length} total busy periods`)
    results.busyTimes = busyTimes.slice(0, 10).map((busy: any) => ({
      start: busy.start_time,
      end: busy.end_time,
      source: busy.source || 'combined',
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

    // Step 5: Check Calendar Events API
    results.steps.push('🔍 Step 5: Checking Calendar Events API for ALL events...')
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
        results.calendarEvents = eventsResponse.data.items.map((event: any) => ({
          summary: event.summary || 'No title',
          start: event.start_time?.timestamp ? new Date(parseInt(event.start_time.timestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }) : 'N/A',
          end: event.end_time?.timestamp ? new Date(parseInt(event.end_time.timestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }) : 'N/A',
          status: event.status,
          freeBusyStatus: event.free_busy_status || 'not set',
          isRecurring: !!event.recurrence
        }))

        const freeEvents = results.calendarEvents.filter((e: any) => e.freeBusyStatus === 'free')
        const busyEvents = results.calendarEvents.filter((e: any) => e.freeBusyStatus === 'busy')

        results.steps.push(`   📊 ${busyEvents.length} events marked as BUSY`)
        results.steps.push(`   📊 ${freeEvents.length} events marked as FREE`)

        if (freeEvents.length > 0) {
          results.steps.push(`   ⚠️ CRITICAL: FREE events will NOT block availability!`)
          results.steps.push(`   💡 SOLUTION: Change these events to BUSY in Lark calendar`)
          results.criticalIssue = 'Events marked as FREE instead of BUSY'
          results.freeEvents = freeEvents
        }
      } else {
        results.steps.push(`⚠️ No calendar events found`)
      }
    } catch (error: any) {
      results.steps.push(`❌ Calendar Events API error: ${error.message}`)
    }

    // Step 6: Check availability using the installer-availability module
    results.steps.push('🔍 Step 6: Checking installer availability for time slots...')
    const availability = await getInternalInstallersAvailability(
      date,
      date,
      undefined // No merchant ID for general check
    )
    
    if (availability.length > 0) {
      const dayAvailability = availability[0]
      results.computedAvailability = dayAvailability.slots.map(slot => ({
        time: slot.time.label,
        isAvailable: slot.isAvailable,
        availableInstallers: slot.availableInstallers,
        shouldBeBlocked: busyTimes.some((busy: any) => {
          const slotStart = new Date(`${date}T${slot.time.start}:00+08:00`)
          const slotEnd = new Date(`${date}T${slot.time.end}:00+08:00`)
          const busyStart = new Date(busy.start_time)
          const busyEnd = new Date(busy.end_time)
          return busyStart < slotEnd && busyEnd > slotStart
        })
      }))
      
      // Identify mismatches
      const mismatches = results.computedAvailability.filter((slot: any) => 
        slot.isAvailable && slot.shouldBeBlocked
      )
      
      if (mismatches.length > 0) {
        results.steps.push(`   ⚠️ MISMATCH: ${mismatches.length} slots showing available but should be blocked`)
        results.mismatches = mismatches
      }
    }

    return NextResponse.json(results, { status: 200 })
    
  } catch (error: any) {
    results.error = error.message
    results.steps.push(`❌ Error: ${error.message}`)
    return NextResponse.json(results, { status: 500 })
  }
}