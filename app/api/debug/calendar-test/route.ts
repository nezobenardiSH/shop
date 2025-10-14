import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const results: any = {
    success: false,
    steps: [],
    error: null
  }

  try {
    results.steps.push('🔍 Starting calendar debug test...')

    const trainerEmail = 'nezo.benardi@storehub.com'
    const startDate = new Date('2025-10-15T00:00:00+08:00')
    const endDate = new Date('2025-10-15T23:59:59+08:00')

    results.steps.push(`📧 Testing trainer: ${trainerEmail}`)
    results.steps.push(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Step 1: Check OAuth token
    results.steps.push('🔍 Step 1: Checking OAuth token...')
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    const token = await prisma.larkAuthToken.findUnique({
      where: { userEmail: trainerEmail }
    })

    if (!token) {
      results.steps.push('❌ No OAuth token found!')
      results.error = 'No OAuth token found'
      return NextResponse.json(results)
    }

    const now = new Date()
    const isExpired = now >= token.expiresAt
    results.steps.push(`✅ OAuth token found. Expired: ${isExpired}`)
    results.steps.push(`📅 Token expires: ${token.expiresAt.toISOString()}`)
    results.steps.push(`📝 Calendar ID: ${token.calendarId}`)

    if (isExpired) {
      results.steps.push('❌ OAuth token is expired!')
      results.error = 'OAuth token expired'
      return NextResponse.json(results)
    }

    // Step 2: Test Calendar API directly
    results.steps.push('🔍 Step 2: Testing Calendar API directly...')

    const timeMin = Math.floor(startDate.getTime() / 1000)
    const timeMax = Math.floor(endDate.getTime() / 1000)
    const calendarId = token.calendarId

    const url = `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events?start_time=${timeMin}&end_time=${timeMax}`

    results.steps.push(`🌐 API URL: ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    results.steps.push(`📡 API Response Status: ${response.status}`)
    results.steps.push(`📊 API Response Code: ${data.code}`)

    if (data.code !== 0) {
      results.steps.push(`❌ API Error: ${data.msg || 'Unknown error'}`)
      results.error = `Calendar API error: ${data.msg}`
      return NextResponse.json(results)
    }

    const events = data.data?.items || []
    results.steps.push(`📅 Found ${events.length} total events`)

    // Step 3: Filter events for Oct 15th
    results.steps.push('🔍 Step 3: Filtering events for October 15th...')

    const oct15Events = []
    for (const event of events) {
      if (event.start_time?.timestamp && event.end_time?.timestamp && event.status !== 'cancelled') {
        const eventStart = new Date(parseInt(event.start_time.timestamp) * 1000)
        const eventEnd = new Date(parseInt(event.end_time.timestamp) * 1000)

        // Check if event overlaps with Oct 15th
        if (eventEnd >= startDate && eventStart <= endDate) {
          oct15Events.push({
            summary: event.summary || 'No title',
            start: eventStart.toISOString(),
            end: eventEnd.toISOString(),
            startLocal: eventStart.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
            endLocal: eventEnd.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }),
            status: event.status
          })
        }
      }
    }

    results.steps.push(`✅ Found ${oct15Events.length} events on October 15th`)

    // Step 4: Test getRawBusyTimes
    results.steps.push('🔍 Step 4: Testing getRawBusyTimes function...')

    try {
      const { larkService } = await import('@/lib/lark')
      const busyTimes = await larkService.getRawBusyTimes(trainerEmail, startDate, endDate)

      results.steps.push(`📊 getRawBusyTimes returned ${busyTimes.length} busy periods`)

      // Step 5: Test the full availability API logic
      results.steps.push('🔍 Step 5: Testing full availability logic...')

      try {
        // Test the trainer availability function directly
        const { getCombinedAvailability } = await import('@/lib/trainer-availability')
        const availability = await getCombinedAvailability(startDate, endDate)

        // Find Oct 15th data
        const oct15Availability = availability.find(day => day.date === '2025-10-15')
        const slot1400 = oct15Availability?.slots.find(slot => slot.start === '14:00')

        results.steps.push(`📅 Oct 15th availability found: ${!!oct15Availability}`)
        results.steps.push(`🕐 14:00-16:00 slot available: ${slot1400?.available}`)
        results.steps.push(`👥 Available trainers for 14:00 slot: ${slot1400?.availableTrainers?.join(', ') || 'none'}`)
        results.steps.push(`🌐 Available languages for 14:00 slot: ${slot1400?.availableLanguages?.join(', ') || 'none'}`)

        results.summary = {
          trainerEmail,
          tokenValid: !isExpired,
          calendarId: token.calendarId,
          totalEvents: events.length,
          oct15Events: oct15Events.length,
          busyTimesFromFunction: busyTimes.length,
          oct15EventDetails: oct15Events,
          busyTimesDetails: busyTimes,
          availabilityTest: {
            oct15Found: !!oct15Availability,
            slot1400Available: slot1400?.available,
            slot1400Trainers: slot1400?.availableTrainers || [],
            slot1400Languages: slot1400?.availableLanguages || []
          }
        }

      } catch (availabilityError) {
        results.steps.push(`❌ getCombinedAvailability failed: ${availabilityError instanceof Error ? availabilityError.message : 'Unknown error'}`)
        results.error = `getCombinedAvailability error: ${availabilityError instanceof Error ? availabilityError.message : 'Unknown error'}`

        results.summary = {
          trainerEmail,
          tokenValid: !isExpired,
          calendarId: token.calendarId,
          totalEvents: events.length,
          oct15Events: oct15Events.length,
          busyTimesFromFunction: busyTimes.length,
          oct15EventDetails: oct15Events,
          busyTimesDetails: busyTimes,
          availabilityError: availabilityError instanceof Error ? availabilityError.message : 'Unknown error'
        }
      }

      results.success = true

    } catch (funcError) {
      results.steps.push(`❌ getRawBusyTimes failed: ${funcError instanceof Error ? funcError.message : 'Unknown error'}`)
      results.error = `getRawBusyTimes error: ${funcError instanceof Error ? funcError.message : 'Unknown error'}`
    }

    await prisma.$disconnect()
    return NextResponse.json(results)

  } catch (error) {
    results.steps.push(`❌ Overall test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    results.error = error instanceof Error ? error.message : 'Unknown error'
    results.stack = error instanceof Error ? error.stack : 'No stack trace'

    return NextResponse.json(results, { status: 500 })
  }
}
