import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function GET(request: NextRequest) {
  try {
    // Get access token first
    const token = await larkService.getAccessToken()
    
    // Try to list calendars (if this API exists)
    const baseUrl = process.env.LARK_DOMAIN || 'https://open.larksuite.com'
    
    // Test 1: Try to get user's primary calendar
    try {
      const response1 = await fetch(`${baseUrl}/open-apis/calendar/v4/calendars/primary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data1 = await response1.json()
      console.log('Primary calendar response:', data1)
    } catch (error) {
      console.log('Could not get primary calendar:', error)
    }
    
    // Test 2: Try to list all calendars
    try {
      const response2 = await fetch(`${baseUrl}/open-apis/calendar/v4/calendars`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data2 = await response2.json()
      console.log('Calendar list response:', data2)
    } catch (error) {
      console.log('Could not list calendars:', error)
    }
    
    // Test 3: Try creating a simple test event with minimal data
    const testEvent = {
      summary: 'Test Event from Portal',
      start_time: {
        timestamp: String(Math.floor(Date.now() / 1000) + 3600) // 1 hour from now
      },
      end_time: {
        timestamp: String(Math.floor(Date.now() / 1000) + 7200) // 2 hours from now
      }
    }
    
    // Try different calendar IDs
    const calendarIdsToTry = ['primary', 'primary_calendar', 'nezo.benardi@storehub.com']
    const results: any = {}
    
    for (const calId of calendarIdsToTry) {
      try {
        const response = await fetch(`${baseUrl}/open-apis/calendar/v4/calendars/${calId}/events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testEvent)
        })
        const data = await response.json()
        results[calId] = {
          success: data.code === 0,
          response: data
        }
      } catch (error: any) {
        results[calId] = {
          success: false,
          error: error.message
        }
      }
    }
    
    return NextResponse.json({
      message: 'Calendar API tests',
      token: token ? 'Valid' : 'Invalid',
      testResults: results,
      hint: 'Check which calendar ID format works'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test failed',
      details: error.message
    }, { status: 500 })
  }
}