import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userEmail = searchParams.get('email') || 'suvisa.foo@storehub.com'
    const startDate = searchParams.get('startDate') || '2025-12-01'
    const endDate = searchParams.get('endDate') || '2025-12-07'
    
    const start = new Date(`${startDate}T00:00:00+08:00`)
    const end = new Date(`${endDate}T23:59:59+08:00`)
    
    console.log(`Checking busy times for ${userEmail} from ${startDate} to ${endDate}`)
    
    const busyTimes = await larkService.getRawBusyTimes(userEmail, start, end)
    
    // Convert to readable format
    const readable = busyTimes.map(busy => {
      const startTime = new Date(busy.start_time)
      const endTime = new Date(busy.end_time)
      return {
        date: startTime.toISOString().split('T')[0],
        start: startTime.toLocaleTimeString('en-US', { 
          timeZone: 'Asia/Singapore',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        end: endTime.toLocaleTimeString('en-US', { 
          timeZone: 'Asia/Singapore',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        duration: Math.round((endTime.getTime() - startTime.getTime()) / 60000) + ' mins'
      }
    })
    
    return NextResponse.json({
      userEmail,
      dateRange: { startDate, endDate },
      totalBusyPeriods: busyTimes.length,
      busyTimes: readable
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}