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
    
    // Get raw busy times
    results.steps.push('🔍 Calling getRawBusyTimes()...')
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
        duration_minutes: (end.getTime() - start.getTime()) / (1000 * 60)
      }
    })
    
    // Check overlap with each time slot
    const TIME_SLOTS = [
      { start: '09:00', end: '11:00', label: '9-11am' },
      { start: '11:00', end: '13:00', label: '11am-1pm' },
      { start: '14:00', end: '16:00', label: '2-4pm' },
      { start: '16:00', end: '18:00', label: '4-6pm' }
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
      '9-11am': 'Should be AVAILABLE (no events)',
      '11am-1pm': 'Should be BUSY (11am-12pm meeting)',
      '2-4pm': 'Should be AVAILABLE (no events)',
      '4-6pm': 'Should be AVAILABLE (no events)'
    }
    
    return NextResponse.json(results, { status: 200 })
    
  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Unknown error'
    results.stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(results, { status: 500 })
  }
}

