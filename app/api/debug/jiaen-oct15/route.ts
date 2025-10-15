import { NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

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

    // Step 1: Check FreeBusy API
    results.steps.push('🔍 Step 1: Checking FreeBusy API...')
    let freeBusyTimes: any[] = []
    try {
      const freeBusyResponse = await larkService.getFreeBusySchedule(
        [trainerEmail],
        startDate,
        endDate,
        trainerEmail
      )

      if (freeBusyResponse.data?.freebusy_list?.[0]?.busy_time) {
        freeBusyTimes = freeBusyResponse.data.freebusy_list[0].busy_time
        results.steps.push(`✅ FreeBusy API returned ${freeBusyTimes.length} busy periods`)
      } else {
        results.steps.push(`⚠️ FreeBusy API returned no data`)
      }
    } catch (error) {
      results.steps.push(`❌ FreeBusy API error: ${error instanceof Error ? error.message : 'Unknown'}`)
    }

    results.freeBusyTimes = freeBusyTimes.map(busy => {
      const start = new Date(busy.start_time)
      const end = new Date(busy.end_time)
      return {
        start_utc: busy.start_time,
        end_utc: busy.end_time,
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

    // Step 2: Get raw busy times (combined)
    results.steps.push('🔍 Step 2: Calling getRawBusyTimes() (FreeBusy + Calendar Events)...')
    const busyTimes = await larkService.getRawBusyTimes(
      trainerEmail,
      startDate,
      endDate
    )
    
    results.steps.push(`📊 Found ${busyTimes.length} busy periods for Jia En on Oct 15`)
    
    // Convert to Singapore time for readability
    results.busyTimes = busyTimes.map(busy => {
      const start = new Date(busy.start_time)
      const end = new Date(busy.end_time)
      
      const startSGT = start.toLocaleString('en-US', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      
      const endSGT = end.toLocaleString('en-US', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      
      return {
        start_utc: busy.start_time,
        end_utc: busy.end_time,
        start_sgt: startSGT,
        end_sgt: endSGT,
        duration_minutes: (end.getTime() - start.getTime()) / (1000 * 60),
        source: (busy as any).source || 'unknown',
        event_id: (busy as any).event_id || null,
        recurrence: (busy as any).recurrence || null
      }
    })
    
    // Check overlap with each time slot
    const TIME_SLOTS = [
      { start: '10:00', end: '11:00', label: '10-11am' },
      { start: '12:00', end: '13:00', label: '12pm-1pm' },
      { start: '14:30', end: '15:30', label: '2:30-3:30pm' },
      { start: '17:00', end: '18:00', label: '5-6pm' }
    ]
    
    results.slotAnalysis = TIME_SLOTS.map(slot => {
      const slotStart = new Date(`2025-10-15T${slot.start}:00+08:00`)
      const slotEnd = new Date(`2025-10-15T${slot.end}:00+08:00`)
      
      const overlappingBusyTimes = busyTimes.filter(busy => {
        const busyStart = new Date(busy.start_time)
        const busyEnd = new Date(busy.end_time)
        return (slotStart < busyEnd && slotEnd > busyStart)
      })
      
      return {
        slot: slot.label,
        slotTime: `${slot.start}-${slot.end}`,
        available: overlappingBusyTimes.length === 0,
        overlappingBusyTimes: overlappingBusyTimes.map(busy => ({
          start: busy.start_time,
          end: busy.end_time
        }))
      }
    })
    
    results.expectedBehavior = {
      '9-11am': 'Should be BUSY (9:45-10am meeting on Mon/Wed/Fri)',
      '11am-1pm': 'Should be BUSY (11am-12pm meeting every Wed)',
      '2-4pm': 'Should be AVAILABLE (no events)',
      '4-6pm': 'Should be AVAILABLE (no events)'
    }

    results.correctBusyTimes = [
      '9:45-10:00 AM (Mon/Wed/Fri recurring)',
      '11:00 AM-12:00 PM (Every Wed recurring)'
    ]

    results.phantomBusyTimes = [
      '9:00-9:30 AM (should NOT exist)',
      '1:00-1:15 PM (should NOT exist)',
      '5:30-5:45 PM (should NOT exist)'
    ]
    
    return NextResponse.json(results, { status: 200 })
    
  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Unknown error'
    results.stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(results, { status: 500 })
  }
}

