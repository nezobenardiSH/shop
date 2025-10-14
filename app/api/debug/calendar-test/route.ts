import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Starting calendar test...')
    
    const trainerEmail = 'nezo.benardi@storehub.com'
    const startDate = new Date('2025-10-15T00:00:00+08:00')
    const endDate = new Date('2025-10-15T23:59:59+08:00')
    
    console.log(`🔍 Testing calendar for ${trainerEmail}`)
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    
    // Import lark service
    const { larkService } = await import('@/lib/lark')
    
    // Test getRawBusyTimes
    console.log('🔍 Calling getRawBusyTimes...')
    const busyTimes = await larkService.getRawBusyTimes(
      trainerEmail,
      startDate,
      endDate
    )
    
    console.log(`📊 getRawBusyTimes returned ${busyTimes.length} busy periods`)
    
    return NextResponse.json({
      success: true,
      trainerEmail,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      busyTimesCount: busyTimes.length,
      busyTimes: busyTimes.map(bt => ({
        start: bt.start_time,
        end: bt.end_time,
        startLocal: new Date(bt.start_time).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
        endLocal: new Date(bt.end_time).toLocaleString('en-US', { timeZone: 'Asia/Singapore' })
      })),
      message: busyTimes.length === 0 ? 'No busy times found - check logs for errors' : `Found ${busyTimes.length} busy periods`
    })
    
  } catch (error) {
    console.error('❌ DEBUG: Calendar test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    }, { status: 500 })
  }
}
