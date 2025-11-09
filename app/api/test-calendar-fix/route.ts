import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email') || 'nezo.benardi@storehub.com'
    
    console.log('🔧 Testing calendar fetch for:', email)
    
    // Test 1: Get user by email
    const userInfo = await larkService.getUserByEmail(email)
    console.log('User info retrieved:', userInfo)
    
    // Test 2: Get calendar list
    const calendars = await larkService.getCalendarList(email)
    console.log('Calendars retrieved:', calendars.length)
    
    return NextResponse.json({
      success: true,
      userInfo,
      calendarCount: calendars.length,
      calendars: calendars.map(cal => ({
        id: cal.calendar_id,
        summary: cal.summary,
        type: cal.type,
        role: cal.role
      }))
    })
  } catch (error: any) {
    console.error('Test failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 })
  }
}