import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import { getCombinedAvailability } from '@/lib/trainer-availability'

export async function GET(request: NextRequest) {
  const results: any = {
    success: false,
    steps: [],
    error: null
  }

  try {
    results.steps.push('🔍 Starting calendar debug test for Jia En...')
    
    const trainerEmail = 'jiaen.chai@storehub.com'
    const startDate = new Date('2025-10-15T00:00:00+08:00')
    const endDate = new Date('2025-10-15T23:59:59+08:00')
    
    results.steps.push(`📧 Testing trainer: ${trainerEmail}`)
    results.steps.push(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    
    // Step 1: Check OAuth token
    results.steps.push('🔍 Step 1: Checking OAuth token...')
    const { larkOAuthService } = await import('@/lib/lark-oauth-service')
    const isAuthorized = await larkOAuthService.isUserAuthorized(trainerEmail)
    
    if (!isAuthorized) {
      results.error = 'Trainer not authorized'
      results.steps.push('❌ No OAuth token found')
      return NextResponse.json(results)
    }
    
    const tokenData = await larkOAuthService.getValidAccessToken(trainerEmail)
    results.steps.push(`✅ OAuth token found: ${!!tokenData}`)
    if (tokenData) {
      results.steps.push(`📝 Token is a string of length: ${tokenData.length}`)
    }
    
    // Get calendar ID
    const { CalendarIdManager } = await import('@/lib/calendar-id-manager')
    const calendarId = await CalendarIdManager.getResolvedCalendarId(trainerEmail)
    results.steps.push(`📝 Calendar ID: ${calendarId}`)
    
    // Step 2: Test Calendar API directly
    results.steps.push('🔍 Step 2: Testing Calendar API directly...')
    
    const startTimestamp = Math.floor(startDate.getTime() / 1000)
    const endTimestamp = Math.floor(endDate.getTime() / 1000)
    
    const apiUrl = `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events?start_time=${startTimestamp}&end_time=${endTimestamp}`
    results.steps.push(`🌐 API URL: ${apiUrl}`)
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData}`,
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    results.steps.push(`📡 API Response Status: ${response.status}`)
    results.steps.push(`📊 API Response Code: ${data.code}`)
    
    const allEvents = data.data?.items || []
    results.steps.push(`📅 Found ${allEvents.length} total events`)
    
    // Step 3: Filter events for October 15th
    results.steps.push('🔍 Step 3: Filtering events for October 15th...')
    
    const oct15Events = allEvents.filter((event: any) => {
      if (!event.start_time?.timestamp) return false
      const eventDate = new Date(parseInt(event.start_time.timestamp) * 1000)
      const eventDateStr = eventDate.toISOString().split('T')[0]
      return eventDateStr === '2025-10-15'
    })
    
    results.steps.push(`✅ Found ${oct15Events.length} events on October 15th`)
    
    // Step 4: Test getRawBusyTimes function
    results.steps.push('🔍 Step 4: Testing getRawBusyTimes function...')
    const busyTimes = await larkService.getRawBusyTimes(trainerEmail, startDate, endDate)
    results.steps.push(`📊 getRawBusyTimes returned ${busyTimes.length} busy periods`)
    
    // Step 5: Test full availability logic
    results.steps.push('🔍 Step 5: Testing full availability logic...')
    const availability = await getCombinedAvailability(startDate, endDate)
    const oct15Availability = availability.find(day => day.date === '2025-10-15')
    
    results.steps.push(`📅 Oct 15th availability found: ${!!oct15Availability}`)
    
    if (oct15Availability) {
      const slot0900 = oct15Availability.slots.find(s => s.start === '09:00')
      const slot1100 = oct15Availability.slots.find(s => s.start === '11:00')
      
      results.steps.push(`🕐 09:00-11:00 slot available: ${slot0900?.available}`)
      results.steps.push(`👥 Available trainers for 09:00 slot: ${slot0900?.availableTrainers?.join(', ') || 'none'}`)
      results.steps.push(`🌐 Available languages for 09:00 slot: ${slot0900?.availableLanguages?.join(', ') || 'none'}`)
      
      results.steps.push(`🕐 11:00-13:00 slot available: ${slot1100?.available}`)
      results.steps.push(`👥 Available trainers for 11:00 slot: ${slot1100?.availableTrainers?.join(', ') || 'none'}`)
      results.steps.push(`🌐 Available languages for 11:00 slot: ${slot1100?.availableLanguages?.join(', ') || 'none'}`)
    }
    
    results.success = true
    results.summary = {
      trainerEmail,
      tokenValid: !!tokenData,
      calendarId,
      totalEvents: allEvents.length,
      oct15Events: oct15Events.length,
      busyTimesFromFunction: busyTimes.length,
      oct15EventDetails: oct15Events.map((event: any) => ({
        summary: event.summary,
        start: new Date(parseInt(event.start_time.timestamp) * 1000).toISOString(),
        end: new Date(parseInt(event.end_time.timestamp) * 1000).toISOString(),
        startLocal: new Date(parseInt(event.start_time.timestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
        endLocal: new Date(parseInt(event.end_time.timestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
        status: event.status,
        recurrence: event.recurrence || 'none'
      })),
      busyTimesDetails: busyTimes,
      availabilityTest: {
        oct15Found: !!oct15Availability,
        slot0900Trainers: oct15Availability?.slots.find(s => s.start === '09:00')?.availableTrainers || [],
        slot0900Languages: oct15Availability?.slots.find(s => s.start === '09:00')?.availableLanguages || [],
        slot1100Trainers: oct15Availability?.slots.find(s => s.start === '11:00')?.availableTrainers || [],
        slot1100Languages: oct15Availability?.slots.find(s => s.start === '11:00')?.availableLanguages || []
      }
    }
    
    return NextResponse.json(results)
  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Unknown error'
    results.steps.push(`❌ Error: ${results.error}`)
    return NextResponse.json(results, { status: 500 })
  }
}

