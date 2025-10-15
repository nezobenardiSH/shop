

interface LarkTokenResponse {
  code: number
  msg: string
  tenant_access_token: string
  expire: number
}

interface LarkEvent {
  summary: string
  description?: string
  start_time: {
    timestamp: string
    timezone?: string
  }
  end_time: {
    timestamp: string
    timezone?: string
  }
  attendees?: Array<{
    user_id?: string
    email?: string
  }>
  location?: string
}

interface FreeBusyQuery {
  time_min: string
  time_max: string
  user_id_list?: string[]
  room_id_list?: string[]
}

interface FreeBusyResponse {
  code: number
  msg: string
  data?: {
    freebusy_list: Array<{
      user_id?: string
      room_id?: string
      busy_time: Array<{
        start_time: string
        end_time: string
      }>
    }>
  }
}

class LarkService {
  private baseUrl: string
  private appId: string
  private appSecret: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0
  private userTokens: Map<string, string> = new Map()

  constructor() {
    this.baseUrl = process.env.LARK_DOMAIN || 'https://open.larksuite.com'
    this.appId = process.env.LARK_APP_ID || ''
    this.appSecret = process.env.LARK_APP_SECRET || ''
    
    // Load manual user tokens from environment
    this.loadManualTokens()
    
    if (!this.appId || !this.appSecret) {
      console.error('Lark credentials not configured in environment')
    }
  }

  /**
   * Load manual user access tokens from environment
   */
  private loadManualTokens() {
    // Support multiple user tokens in format:
    // LARK_USER_TOKEN_email@domain.com=u-xxxxx
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('LARK_USER_TOKEN_')) {
        const email = key.replace('LARK_USER_TOKEN_', '').replace(/_/g, '.')
        const token = process.env[key]
        if (token) {
          this.userTokens.set(email, token)
          console.log(`Loaded user token for ${email}`)
        }
      }
    })

    // Also support a default user token
    if (process.env.LARK_USER_ACCESS_TOKEN) {
      const defaultEmail = process.env.LARK_DEFAULT_USER_EMAIL || 'default'
      this.userTokens.set(defaultEmail, process.env.LARK_USER_ACCESS_TOKEN)
      console.log(`Loaded default user token`)
    }
  }

  /**
   * Get user access token for a specific user
   */
  async getUserToken(userEmail: string): Promise<string | null> {
    console.log(`🔑 getUserToken called for: ${userEmail}`)
    
    // First check manual tokens (for development/testing)
    const manualToken = this.userTokens.get(userEmail) || this.userTokens.get('default')
    if (manualToken) {
      console.log(`🟢 Using manual token for ${userEmail}`)
      return manualToken
    }
    
    console.log('🔍 No manual token found, checking OAuth service...')

    // Production: Get from OAuth service
    try {
      const { larkOAuthService } = await import('./lark-oauth-service')
      console.log('🔎 Calling getValidAccessToken...')
      const token = await larkOAuthService.getValidAccessToken(userEmail)
      if (token) {
        console.log(`✅ Got OAuth token for ${userEmail}: ${token.substring(0, 20)}...`)
        return token
      } else {
        console.log(`❌ No OAuth token found for ${userEmail}`)
      }
    } catch (error) {
      console.error(`🚨 Failed to get OAuth token for ${userEmail}:`, error)
    }

    console.log(`🔴 Returning null - no token available for ${userEmail}`)
    return null
  }

  /**
   * Get tenant access token for API authentication
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now() / 1000
    
    if (this.accessToken && this.tokenExpiry > now + 60) {
      return this.accessToken
    }

    try {
      const response = await fetch(`${this.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret
        })
      })

      const data: LarkTokenResponse = await response.json()
      
      if (data.code !== 0) {
        throw new Error(`Lark auth failed: ${data.msg}`)
      }

      this.accessToken = data.tenant_access_token
      this.tokenExpiry = now + data.expire
      
      return this.accessToken
    } catch (error) {
      console.error('Failed to get Lark access token:', error)
      throw error
    }
  }

  /**
   * Make authenticated request to Lark API
   */
  private async makeRequest(endpoint: string, options: RequestInit & { userEmail?: string } = {}) {
    let token: string
    
    // Check if we should use a user token for this request
    if (options.userEmail) {
      const userToken = await this.getUserToken(options.userEmail)
      if (userToken) {
        token = userToken
        console.log(`Using user token for ${options.userEmail}`)
      } else {
        // Fallback to app token
        token = await this.getAccessToken()
        console.log(`No user token for ${options.userEmail}, using app token`)
      }
    } else {
      // Use app token by default
      token = await this.getAccessToken()
    }
    
    const url = `${this.baseUrl}${endpoint}`
    console.log(`Calling Lark API: ${options.method || 'GET'} ${url}`)
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    // Check if response is JSON
    const contentType = response.headers.get('content-type')
    let data: any
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      // Not JSON response, log the text for debugging
      const text = await response.text()
      console.error('Non-JSON response from Lark API:', text.substring(0, 500))
      throw new Error(`Invalid response from Lark API: ${text.substring(0, 100)}`)
    }
    
    if (data.code !== 0) {
      console.error(`Lark API error: ${data.msg}`, data)
      throw new Error(`Lark API error: ${data.msg}`)
    }

    return data
  }

  /**
   * Calculate occurrences of a recurring event within a date range
   */
  private getRecurringEventOccurrences(
    event: any, 
    rangeStart: Date, 
    rangeEnd: Date
  ): Array<{start_time: string; end_time: string}> {
    const occurrences: Array<{start_time: string; end_time: string}> = []
    
    try {
      // Parse the original event time
      const originalStart = new Date(parseInt(event.start_time.timestamp) * 1000)
      const originalEnd = new Date(parseInt(event.end_time.timestamp) * 1000)
      const duration = originalEnd.getTime() - originalStart.getTime()
      
      // Parse recurrence rule (e.g., "FREQ=WEEKLY;UNTIL=20260703T155959Z;INTERVAL=1;BYDAY=MO,TU,WE")
      const recurrenceRule = event.recurrence
      const rules = recurrenceRule.split(';').reduce((acc: any, rule: string) => {
        const [key, value] = rule.split('=')
        acc[key] = value
        return acc
      }, {})
      
      // Handle weekly recurrence
      if (rules.FREQ === 'WEEKLY') {
        const interval = parseInt(rules.INTERVAL || '1')
        const until = rules.UNTIL ? new Date(rules.UNTIL.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')) : rangeEnd
        
        if (event.summary?.includes('Design MY')) {
          console.log(`    📝 Weekly recurrence: interval=${interval}, until=${until.toISOString()}`)
          console.log(`    📝 BYDAY rule: ${rules.BYDAY || 'none (using original day)'}`)
        }
        
        // Parse BYDAY if present (e.g., "MO,TU,WE,TH,FR")
        let targetDays: number[] = []
        if (rules.BYDAY) {
          const dayMap: {[key: string]: number} = {
            'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
          }
          targetDays = rules.BYDAY.split(',').map((day: string) => dayMap[day.trim()]).filter((d: number) => d !== undefined)
        } else {
          // If no BYDAY, use the original event's day
          targetDays = [originalStart.getDay()]
        }
        
        if (event.summary?.includes('Design MY')) {
          console.log(`    📝 Target days: ${targetDays.join(', ')} (0=Sun, 1=Mon, ..., 6=Sat)`)
        }
        
        // Process each day in the range
        const current = new Date(rangeStart)
        current.setHours(0, 0, 0, 0)
        
        while (current <= rangeEnd && current <= until) {
          // Check if current day is one of the target days
          if (targetDays.includes(current.getDay())) {
            // Check if this occurrence follows the interval pattern
            const weeksSinceOriginal = Math.floor((current.getTime() - originalStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
            
            if (event.summary?.includes('Design MY') && current.toISOString().startsWith('2025-10-14')) {
              console.log(`    📝 Checking Oct 14: weeksSinceOriginal=${weeksSinceOriginal}, interval=${interval}, valid=${weeksSinceOriginal >= 0 && weeksSinceOriginal % interval === 0}`)
            }
            
            if (weeksSinceOriginal >= 0 && weeksSinceOriginal % interval === 0) {
              const occurrenceStart = new Date(current)
              occurrenceStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)
              const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)
              
              if (occurrenceStart >= rangeStart && occurrenceStart <= rangeEnd) {
                occurrences.push({
                  start_time: occurrenceStart.toISOString(),
                  end_time: occurrenceEnd.toISOString()
                })
                
                // Debug Oct 14 occurrence for Design meeting
                if (event.summary?.includes('Design MY') && 
                    occurrenceStart.toISOString().startsWith('2025-10-14')) {
                  console.log('  ✅ Found Oct 14 occurrence for Design meeting at 3pm:', {
                    start: occurrenceStart.toISOString(),
                    end: occurrenceEnd.toISOString()
                  })
                }
              }
            }
          }
          
          current.setDate(current.getDate() + 1)
        }
      }
      // Handle daily recurrence
      else if (rules.FREQ === 'DAILY') {
        const interval = parseInt(rules.INTERVAL || '1')
        const until = rules.UNTIL ? new Date(rules.UNTIL.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')) : rangeEnd
        
        // Handle BYDAY for daily recurrence (e.g., weekdays only)
        let targetDays: number[] | null = null
        if (rules.BYDAY) {
          const dayMap: {[key: string]: number} = {
            'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
          }
          targetDays = rules.BYDAY.split(',').map((day: string) => dayMap[day.trim()]).filter((d: number) => d !== undefined)
        }
        
        const current = new Date(Math.max(originalStart.getTime(), rangeStart.getTime()))
        current.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)
        
        let daysSinceOriginal = Math.floor((current.getTime() - originalStart.getTime()) / (24 * 60 * 60 * 1000))
        // Adjust to next interval occurrence
        if (daysSinceOriginal % interval !== 0) {
          const daysToAdd = interval - (daysSinceOriginal % interval)
          current.setDate(current.getDate() + daysToAdd)
        }
        
        while (current <= rangeEnd && current <= until) {
          // Check if we should include this day (if BYDAY is specified)
          if (!targetDays || targetDays.includes(current.getDay())) {
            const occurrenceEnd = new Date(current.getTime() + duration)
            
            if (current >= rangeStart) {
              occurrences.push({
                start_time: current.toISOString(),
                end_time: occurrenceEnd.toISOString()
              })
            }
          }
          
          current.setDate(current.getDate() + interval)
        }
      }
      // Handle monthly recurrence
      else if (rules.FREQ === 'MONTHLY') {
        const interval = parseInt(rules.INTERVAL || '1')
        const until = rules.UNTIL ? new Date(rules.UNTIL.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')) : rangeEnd
        
        // Handle BYDAY for monthly (e.g., "1WE" = first Wednesday)
        if (rules.BYDAY) {
          // Parse patterns like "1WE", "2MO", "-1FR" (last Friday)
          const match = rules.BYDAY.match(/^(-?\d)(\w{2})$/)
          if (match) {
            const weekNum = parseInt(match[1])
            const dayCode = match[2]
            const dayMap: {[key: string]: number} = {
              'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
            }
            const targetDay = dayMap[dayCode]
            
            if (targetDay !== undefined) {
              const current = new Date(rangeStart)
              current.setDate(1) // Start at beginning of month
              current.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)
              
              while (current <= rangeEnd && current <= until) {
                // Find the nth occurrence of the target day in this month
                const monthStart = new Date(current)
                monthStart.setDate(1)
                
                // Find first occurrence of target day
                while (monthStart.getDay() !== targetDay) {
                  monthStart.setDate(monthStart.getDate() + 1)
                }
                
                // Move to the nth occurrence
                if (weekNum > 0) {
                  monthStart.setDate(monthStart.getDate() + (weekNum - 1) * 7)
                } else {
                  // Negative means from end of month
                  const nextMonth = new Date(monthStart)
                  nextMonth.setMonth(nextMonth.getMonth() + 1)
                  nextMonth.setDate(0) // Last day of current month
                  
                  // Find last occurrence of target day
                  while (nextMonth.getDay() !== targetDay) {
                    nextMonth.setDate(nextMonth.getDate() - 1)
                  }
                  monthStart.setTime(nextMonth.getTime())
                }
                
                if (monthStart >= rangeStart && monthStart <= rangeEnd) {
                  const occurrenceEnd = new Date(monthStart.getTime() + duration)
                  occurrences.push({
                    start_time: monthStart.toISOString(),
                    end_time: occurrenceEnd.toISOString()
                  })
                }
                
                current.setMonth(current.getMonth() + interval)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing recurrence rule:', error)
    }
    
    return occurrences
  }

  /**
   * Convert busy times to availability format
   */
  private convertBusyTimesToAvailability(
    busyTimes: Array<{start_time: string; end_time: string}>,
    startDate: Date,
    endDate: Date
  ): Array<{ date: string; slots: Array<{ start: string; end: string; available: boolean }> }> {
    const result: Array<{ date: string; slots: Array<{ start: string; end: string; available: boolean }> }> = []

    const TIME_SLOTS = [
      { start: '10:00', end: '11:00' },
      { start: '12:00', end: '13:00' },
      { start: '14:30', end: '15:30' },
      { start: '17:00', end: '18:00' }
    ]

    const current = new Date(startDate)
    while (current <= endDate) {
      const dayOfWeek = current.getDay()

      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dateStr = current.toISOString().split('T')[0]
        const slots = TIME_SLOTS.map(slot => {
          // Create slot times as Singapore timezone dates
          const slotStart = new Date(`${dateStr}T${slot.start}:00+08:00`)
          const slotEnd = new Date(`${dateStr}T${slot.end}:00+08:00`)

          console.log(`🔍 Checking slot ${slot.start}-${slot.end} on ${dateStr}`)
          console.log(`  Slot range: ${slotStart.toISOString()} to ${slotEnd.toISOString()}`)

          const isAvailable = !busyTimes.some(busy => {
            const busyStart = new Date(busy.start_time)
            const busyEnd = new Date(busy.end_time)
            const overlaps = (slotStart < busyEnd && slotEnd > busyStart)

            if (overlaps) {
              console.log(`  🚫 OVERLAP FOUND with busy time:`)
              console.log(`    Busy: ${busyStart.toISOString()} to ${busyEnd.toISOString()}`)
              console.log(`    Slot: ${slotStart.toISOString()} to ${slotEnd.toISOString()}`)
            }

            return overlaps
          })
          
          return {
            start: slot.start,
            end: slot.end,
            available: isAvailable
          }
        })
        
        result.push({
          date: dateStr,
          slots
        })
      }
      
      current.setDate(current.getDate() + 1)
    }
    
    return result
  }

  /**
   * Query free/busy times for users
   */
  async queryFreeBusy(query: FreeBusyQuery): Promise<FreeBusyResponse> {
    // Note: The correct endpoint is 'list' not 'query' according to Lark docs
    return await this.makeRequest('/open-apis/calendar/v4/freebusy/list', {
      method: 'POST',
      body: JSON.stringify(query)
    })
  }

  /**
   * Get raw busy times from calendar events only (no TIME_SLOTS conversion)
   */
  async getRawBusyTimes(
    trainerEmail: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{start_time: string; end_time: string}>> {
    console.log(`\n=== Getting RAW busy times for ${trainerEmail} ===`)
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    let busyTimes: Array<{start_time: string; end_time: string}> = []

    try {
      // STRATEGY: Combine results from BOTH APIs to get complete busy times
      // 1. FreeBusy API - Gets busy times from ALL calendars (external, group meetings, etc.)
      // 2. Calendar Events API - Gets events from primary calendar (including recurring events)
      // We need BOTH because:
      //    - FreeBusy API might miss recurring events
      //    - Calendar Events API only shows primary calendar
      console.log('📊 Using COMBINED approach: FreeBusy API + Calendar Events API')

      let freeBusyTimes: Array<{start_time: string; end_time: string}> = []

      // Step 1: Try FreeBusy API first (gets ALL calendars)
      try {
        console.log('🔍 Step 1: Querying FreeBusy API for all calendar busy times...')
        const freeBusyResponse = await this.getFreeBusySchedule(
          [trainerEmail],
          startDate,
          endDate,
          trainerEmail
        )

        if (freeBusyResponse.data?.freebusy_list && freeBusyResponse.data.freebusy_list.length > 0) {
          const userFreeBusy = freeBusyResponse.data.freebusy_list[0]
          if (userFreeBusy.busy_time && userFreeBusy.busy_time.length > 0) {
            freeBusyTimes = userFreeBusy.busy_time.map(busy => ({
              start_time: busy.start_time,
              end_time: busy.end_time
            }))
            console.log(`✅ FreeBusy API returned ${freeBusyTimes.length} busy periods`)
          } else {
            console.log('⚠️ FreeBusy API returned no busy times')
          }
        } else {
          console.log('⚠️ FreeBusy API returned empty response')
        }
      } catch (error) {
        console.error('❌ FreeBusy API failed:', error)
      }

      // Add FreeBusy times to our collection
      busyTimes.push(...freeBusyTimes)

      // Step 2: Query Calendar Events API (gets primary calendar with recurring events)
      console.log('🔍 Step 2: Querying Calendar Events API for primary calendar events...')

      let calendarId: string
      try {
        console.log(`🔍 Resolving calendar ID for availability checking using CalendarIdManager...`)
        const { CalendarIdManager } = await import('@/lib/calendar-id-manager')
        calendarId = await CalendarIdManager.getResolvedCalendarId(trainerEmail)
        console.log(`📅 Using resolved calendar ID for availability: ${calendarId}`)
      } catch (error) {
        console.log(`⚠️ CalendarIdManager failed, using fallback logic:`, error)
        // Fallback to old logic if CalendarIdManager fails
        const tokenData = await import('@/lib/lark-oauth-service').then(m =>
          m.larkOAuthService.getAuthorizedTrainers()
        )
        const trainer = tokenData.find(t => t.email === trainerEmail)
        calendarId = trainer?.calendarId || 'primary'
      }

      const timeMin = Math.floor(startDate.getTime() / 1000)
      const timeMax = Math.floor(endDate.getTime() / 1000)

      // Query calendar events - the API should automatically expand recurring events within the time range
      const eventsResponse = await this.makeRequest(
        `/open-apis/calendar/v4/calendars/${calendarId}/events?start_time=${timeMin}&end_time=${timeMax}`,
        {
          method: 'GET',
          userEmail: trainerEmail
        }
      )

      console.log(`📅 Calendar Events API returned: ${eventsResponse.data?.items?.length || 0} events`)
      console.log(`📅 First 3 events:`, JSON.stringify(eventsResponse.data?.items?.slice(0, 3), null, 2))

      if (eventsResponse.data?.items?.length > 0) {
        const allEvents = eventsResponse.data.items
        console.log(`📅 Found ${allEvents.length} calendar events for ${trainerEmail}`)

        for (const event of allEvents) {
          // Check if this is a recurring event DEFINITION (has recurrence rule)
          if (event.recurrence && event.event_id) {
            console.log(`🔁 RECURRING EVENT DEFINITION: "${event.summary || 'No title'}"`)
            console.log(`   Recurrence rule: ${event.recurrence}`)
            console.log(`   Event ID: ${event.event_id}`)
            console.log(`   🔍 Fetching instances for this recurring event...`)

            // For recurring events, we MUST fetch the instances using the /instances endpoint
            try {
              const instancesResponse = await this.makeRequest(
                `/open-apis/calendar/v4/calendars/${calendarId}/events/${event.event_id}/instances?start_time=${timeMin}&end_time=${timeMax}`,
                {
                  method: 'GET',
                  userEmail: trainerEmail
                }
              )

              if (instancesResponse.data?.items?.length > 0) {
                console.log(`   ✅ Found ${instancesResponse.data.items.length} instances of recurring event "${event.summary}"`)

                for (const instance of instancesResponse.data.items) {
                  // Check free_busy_status: "busy" or "free"
                  const freeBusyStatus = instance.free_busy_status || event.free_busy_status || 'busy'

                  // Only include confirmed events that are marked as "busy", skip cancelled/tentative/declined/free
                  if (instance.start_time?.timestamp && instance.end_time?.timestamp &&
                      instance.status === 'confirmed' && freeBusyStatus === 'busy') {
                    const startMs = parseInt(instance.start_time.timestamp) * 1000
                    const endMs = parseInt(instance.end_time.timestamp) * 1000

                    const instanceStart = new Date(startMs)
                    const instanceEnd = new Date(endMs)

                    const withinRange = instanceEnd >= startDate && instanceStart <= endDate

                    // Log in Singapore time for readability
                    const startSGT = instanceStart.toLocaleString('en-US', {
                      timeZone: 'Asia/Singapore',
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                    const endSGT = instanceEnd.toLocaleString('en-US', {
                      timeZone: 'Asia/Singapore',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })

                    console.log(`   📍 Instance: ${startSGT} - ${endSGT} (UTC: ${instanceStart.toISOString()})`)
                    console.log(`      Status: ${instance.status}, Free/Busy: ${freeBusyStatus}, Within range: ${withinRange}`)

                    if (withinRange) {
                      busyTimes.push({
                        start_time: instanceStart.toISOString(),
                        end_time: instanceEnd.toISOString(),
                        source: `recurring:${event.summary}`,
                        recurrence: event.recurrence
                      } as any)
                      console.log(`      ✅ Added RECURRING instance to busy times: "${event.summary}"`)
                    } else {
                      console.log(`      ⏭️  Skipped (outside range)`)
                    }
                  } else {
                    const skipReason = !instance.start_time?.timestamp ? 'missing timestamp' :
                                      instance.status !== 'confirmed' ? `status: ${instance.status}` :
                                      freeBusyStatus === 'free' ? 'marked as FREE' : 'unknown'
                    console.log(`   ⏭️  Skipped instance: ${skipReason}`)
                  }
                }
              } else {
                console.log(`   ⚠️ No instances returned for recurring event`)
              }
            } catch (error) {
              console.error(`   ❌ Error fetching instances for recurring event:`, error)
            }
          } else if (event.start_time?.timestamp && event.end_time?.timestamp && event.status !== 'cancelled') {
            // Non-recurring event (one-time event)
            const freeBusyStatus = event.free_busy_status || 'busy'

            // Only include events marked as "busy"
            if (freeBusyStatus === 'busy') {
              const startMs = parseInt(event.start_time.timestamp) * 1000
              const endMs = parseInt(event.end_time.timestamp) * 1000

              const eventStart = new Date(startMs)
              const eventEnd = new Date(endMs)

              // Check if event is within our date range
              const withinRange = eventEnd >= startDate && eventStart <= endDate

              // Log in Singapore time for readability
              const startSGT = eventStart.toLocaleString('en-US', {
                timeZone: 'Asia/Singapore',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })
              const endSGT = eventEnd.toLocaleString('en-US', {
                timeZone: 'Asia/Singapore',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })

              console.log(`🔍 ONE-TIME Event: "${event.summary || 'No title'}"`)
              console.log(`   Time: ${startSGT} - ${endSGT} (UTC: ${eventStart.toISOString()})`)
              console.log(`   Status: ${event.status}, Free/Busy: ${freeBusyStatus}`)
              console.log(`   Within range: ${withinRange}`)

              if (withinRange) {
                busyTimes.push({
                  start_time: eventStart.toISOString(),
                  end_time: eventEnd.toISOString(),
                  source: `one-time:${event.summary || 'No title'}`,
                  event_id: event.event_id
                } as any)
                console.log(`   ✅ Added ONE-TIME event to busy times: "${event.summary || 'No title'}"`)
              } else {
                console.log(`   ❌ Skipped (outside date range)`)
              }
            } else {
              console.log(`🔍 Skipping ONE-TIME event: "${event.summary || 'No title'}" (marked as FREE)`)
            }
          } else {
            console.log(`🔍 Skipping event: "${event.summary || 'No title'}" (missing timestamp or cancelled)`)
          }
        }

        console.log(`📊 Calendar Events API added ${busyTimes.length - freeBusyTimes.length} additional busy periods`)
      } else {
        console.log('⚠️ Calendar Events API returned no events')
      }

      // Step 3: Deduplicate and merge overlapping busy times
      console.log(`🔍 Step 3: Deduplicating and merging ${busyTimes.length} busy periods...`)

      if (busyTimes.length > 0) {
        // Sort by start time
        busyTimes.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

        // Merge overlapping periods (preserve source metadata)
        const merged: Array<any> = []
        let current = busyTimes[0]

        for (let i = 1; i < busyTimes.length; i++) {
          const next = busyTimes[i]
          const currentEnd = new Date(current.end_time).getTime()
          const nextStart = new Date(next.start_time).getTime()

          // If overlapping or adjacent, merge
          if (nextStart <= currentEnd) {
            const nextEnd = new Date(next.end_time).getTime()
            if (nextEnd > currentEnd) {
              current = {
                ...current,
                end_time: next.end_time
              }
            }
          } else {
            // No overlap, save current and move to next
            merged.push(current)
            current = next
          }
        }
        merged.push(current)

        busyTimes = merged
        console.log(`✅ After deduplication: ${busyTimes.length} unique busy periods`)
      }

    } catch (error) {
      console.error('❌ CRITICAL ERROR in getRawBusyTimes:', error)
      console.error('❌ This error causes trainer to appear available when they should be busy!')
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        trainerEmail,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      })
    }

    console.log(`\n📊 FINAL RESULT: Returning ${busyTimes.length} busy periods for ${trainerEmail}`)
    console.log(`   Sources: FreeBusy API + Calendar Events API (combined & deduplicated)`)
    return busyTimes
  }




  /**
   * Create calendar event
   */
  async createCalendarEvent(
    calendarId: string,
    event: LarkEvent,
    userEmail?: string
  ): Promise<{ event_id: string }> {
    console.log('🎯 createCalendarEvent called:', {
      calendarId,
      userEmail,
      eventSummary: event.summary,
      startTime: event.start_time,
      endTime: event.end_time
    })
    
    // Use the calendar ID as-is - don't try to fetch a different one
    let actualCalendarId = calendarId
    console.log(`Using calendar ID as provided: ${actualCalendarId}`)
    
    console.log(`Creating event in calendar ${actualCalendarId} for user ${userEmail}`)
    const response = await this.makeRequest(`/open-apis/calendar/v4/calendars/${actualCalendarId}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
      userEmail: userEmail
    })

    return response.data
  }

  /**
   * Delete calendar event
   */
  async deleteCalendarEvent(
    calendarId: string,
    eventId: string
  ): Promise<void> {
    await this.makeRequest(`/open-apis/calendar/v4/calendars/${calendarId}/events/${eventId}`, {
      method: 'DELETE'
    })
  }

  /**
   * Send notification message
   */
  async sendNotification(
    receiverId: string,
    message: string
  ): Promise<void> {
    await this.makeRequest('/open-apis/im/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        receive_id: receiverId,
        msg_type: 'text',
        content: JSON.stringify({ text: message })
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Lark-Receive-Id-Type': 'user_id'
      }
    })
  }

  /**
   * Get user info by email
   */
  async getUserByEmail(email: string): Promise<{ user_id: string; name: string }> {
    try {
      // First try to get user by email
      const response = await this.makeRequest(`/open-apis/contact/v3/users/batch/get?user_ids=${encodeURIComponent(email)}&user_id_type=email`, {
        method: 'GET'
      })
      
      const users = response.data?.items || []
      if (users.length > 0) {
        return {
          user_id: users[0].user_id || users[0].open_id,
          name: users[0].name
        }
      }
    } catch (error) {
      console.log('Failed to get user by email, trying alternative method:', error)
    }
    
    // Alternative: Return a placeholder since we might not need user lookup for calendar operations
    console.log('Using email as user identifier directly')
    return {
      user_id: email,
      name: email.split('@')[0]
    }
  }

  /**
   * Get list of calendars for a user
   */
  async getCalendarList(userEmail: string): Promise<any[]> {
    try {
      console.log('Fetching calendar list for:', userEmail)
      
      // First get user ID from email
      const user = await this.getUserByEmail(userEmail)
      
      // Get calendar list - using the calendars endpoint with user token
      const response = await this.makeRequest('/open-apis/calendar/v4/calendars', {
        method: 'GET',
        userEmail: userEmail,
        headers: {
          'X-Lark-User-Id': user.user_id
        }
      })
      
      console.log('Calendar list response:', response)
      
      return response.data?.calendar_list || []
    } catch (error) {
      console.error('Failed to get calendar list:', error)
      // Return empty array if we can't get calendars
      return []
    }
  }

  /**
   * Get primary calendar ID for a user
   */
  async getPrimaryCalendarId(userEmail: string): Promise<string> {
    try {
      const calendars = await this.getCalendarList(userEmail)
      
      // Look for primary calendar
      const primaryCalendar = calendars.find(cal => 
        cal.type === 'primary' || 
        cal.role === 'owner' ||
        cal.summary?.toLowerCase().includes('primary')
      )
      
      if (primaryCalendar) {
        console.log(`Found primary calendar for ${userEmail}:`, primaryCalendar.calendar_id)
        return primaryCalendar.calendar_id
      }
      
      // If no primary found, use the first calendar
      if (calendars.length > 0) {
        console.log(`Using first calendar for ${userEmail}:`, calendars[0].calendar_id)
        return calendars[0].calendar_id
      }
      
      // Fallback to 'primary' string
      console.log(`No calendars found for ${userEmail}, using 'primary' as fallback`)
      return 'primary'
    } catch (error) {
      console.error('Failed to get primary calendar ID:', error)
      // Fallback to 'primary' if there's an error
      return 'primary'
    }
  }

  /**
   * Get free/busy information for multiple users
   */
  async getFreeBusySchedule(
    userEmails: string[],
    startTime: Date,
    endTime: Date,
    requestingUserEmail?: string
  ): Promise<FreeBusyResponse> {
    try {
      console.log('Fetching FreeBusy for user:', userEmails[0]);
      
      // For organizational accounts, we can try using the email directly
      // Lark might accept the email as user_id
      const userId = userEmails[0]
      
      // Format times in RFC 3339 with timezone offset for Singapore (GMT+8)
      const formatRFC3339 = (date: Date): string => {
        // Get Singapore time components
        const sgTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Singapore"}))
        const year = sgTime.getFullYear()
        const month = String(sgTime.getMonth() + 1).padStart(2, '0')
        const day = String(sgTime.getDate()).padStart(2, '0')
        const hours = String(sgTime.getHours()).padStart(2, '0')
        const minutes = String(sgTime.getMinutes()).padStart(2, '0')
        const seconds = String(sgTime.getSeconds()).padStart(2, '0')
        
        // Singapore is GMT+8
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`
      }
      
      // FreeBusy API only supports querying one user at a time
      // For now, we'll query the first user
      const requestBody = {
        time_min: formatRFC3339(startTime),
        time_max: formatRFC3339(endTime),
        user_id: userId, // Use user_id, not user_id_list
        only_busy: true,
        include_external_calendar: true
      };
      
      console.log('FreeBusy request:', requestBody);
      
      const response = await this.makeRequest('/open-apis/calendar/v4/freebusy/list', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        userEmail: requestingUserEmail || userEmails[0]
      });
      
      // Log the response for debugging
      if (response.code === 0 && response.data?.freebusy_list) {
        console.log(`FreeBusy response: ${response.data.freebusy_list.length} busy periods`)
        // The response format is different - freebusy_list is an array of busy times directly
        response.data.freebusy_list.slice(0, 5).forEach((busy: any, idx: number) => {
          const start = new Date(busy.start_time)
          const end = new Date(busy.end_time)
          console.log(`  ${idx + 1}. ${start.toISOString()} to ${end.toISOString()}`)
          console.log(`     (Local: ${start.toLocaleString('en-US', { timeZone: 'Asia/Singapore' })} to ${end.toLocaleString('en-US', { timeZone: 'Asia/Singapore' })})`)
        })
      }
      
      return response;
    } catch (error) {
      console.error('Failed to get FreeBusy schedule:', error);
      // Return empty freebusy list on error
      return {
        code: 0,
        msg: 'error',
        data: { freebusy_list: [] }
      };
    }
  }

  /**
   * Book a training session with full merchant details
   */
  async bookTraining(
    merchantInfo: {
      name: string
      address?: string
      phone?: string
      contactPerson?: string
      businessType?: string
      salesforceId?: string
    },
    trainerEmail: string,
    trainerCalendarId: string,
    date: string,
    startTime: string,
    endTime: string,
    bookingType: string = 'training'
  ): Promise<string> {
    console.log('🔍 bookTraining called with:', {
      trainerEmail,
      trainerCalendarId,
      date,
      startTime,
      endTime,
      bookingType
    })
    const startDateTime = new Date(`${date}T${startTime}:00`)
    const endDateTime = new Date(`${date}T${endTime}:00`)
    
    console.log('📅 Parsed dates:', {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      startTimestamp: Math.floor(startDateTime.getTime() / 1000),
      endTimestamp: Math.floor(endDateTime.getTime() / 1000)
    })
    
    // Build detailed description with merchant information based on booking type
    let eventTitle: string
    let description: string
    
    switch(bookingType) {
      case 'hardware-fulfillment':
        eventTitle = `Hardware Delivery: ${merchantInfo.name}`
        description = `Hardware Fulfillment\n\n`
        description += `Merchant: ${merchantInfo.name}\n`
        if (merchantInfo.address) {
          description += `Delivery Address: ${merchantInfo.address}\n`
        }
        if (merchantInfo.phone) {
          description += `Phone: ${merchantInfo.phone}\n`
        }
        if (merchantInfo.contactPerson) {
          description += `Contact Person: ${merchantInfo.contactPerson}\n`
        }
        description += `\nHardware Delivery Checklist:\n`
        description += `• POS terminals\n`
        description += `• Receipt printers\n`
        description += `• Cash drawers\n`
        description += `• Network equipment\n`
        break
        
      case 'installation':
        eventTitle = `Installation: ${merchantInfo.name}`
        description = `Hardware Installation\n\n`
        description += `Merchant: ${merchantInfo.name}\n`
        if (merchantInfo.address) {
          description += `Installation Site: ${merchantInfo.address}\n`
        }
        if (merchantInfo.phone) {
          description += `Phone: ${merchantInfo.phone}\n`
        }
        if (merchantInfo.contactPerson) {
          description += `Contact Person: ${merchantInfo.contactPerson}\n`
        }
        description += `\nInstallation Tasks:\n`
        description += `• Hardware setup and configuration\n`
        description += `• Network connectivity\n`
        description += `• System integration\n`
        description += `• Testing and verification\n`
        break
        
      case 'go-live':
        eventTitle = `Go-Live: ${merchantInfo.name}`
        description = `Go-Live Session\n\n`
        description += `Merchant: ${merchantInfo.name}\n`
        if (merchantInfo.address) {
          description += `Address: ${merchantInfo.address}\n`
        }
        if (merchantInfo.phone) {
          description += `Phone: ${merchantInfo.phone}\n`
        }
        if (merchantInfo.contactPerson) {
          description += `Contact Person: ${merchantInfo.contactPerson}\n`
        }
        description += `\nGo-Live Checklist:\n`
        description += `• Final system checks\n`
        description += `• Live transaction testing\n`
        description += `• Staff readiness verification\n`
        description += `• Support handover\n`
        break
        
      case 'training':
      default:
        eventTitle = `Training: ${merchantInfo.name}`
        description = `Onboarding Training Session\n\n`
        description += `Merchant: ${merchantInfo.name}\n`
        if (merchantInfo.address) {
          description += `Address: ${merchantInfo.address}\n`
        }
        if (merchantInfo.phone) {
          description += `Phone: ${merchantInfo.phone}\n`
        }
        if (merchantInfo.contactPerson) {
          description += `Contact Person: ${merchantInfo.contactPerson}\n`
        }
        if (merchantInfo.businessType) {
          description += `Business Type: ${merchantInfo.businessType}\n`
        }
        description += `\nTraining Topics:\n`
        description += `• System setup and configuration\n`
        description += `• POS operations training\n`
        description += `• Payment processing\n`
        description += `• Reporting and analytics\n`
        break
    }
    
    if (merchantInfo.salesforceId) {
      description += `\n🔗 Salesforce ID: ${merchantInfo.salesforceId}`
    }
    
    // Add location to description if available
    let finalDescription = description
    if (merchantInfo.address) {
      finalDescription = `📍 Location: ${merchantInfo.address}\n\n${description}`
    }
    
    const event: LarkEvent = {
      summary: eventTitle,
      description: finalDescription,
      // Temporarily removing location as it's causing validation errors
      // location: merchantInfo.address,
      start_time: {
        timestamp: Math.floor(startDateTime.getTime() / 1000).toString(),
        timezone: 'Asia/Singapore'
      },
      end_time: {
        timestamp: Math.floor(endDateTime.getTime() / 1000).toString(),
        timezone: 'Asia/Singapore'
      },
      attendees: [
        { email: trainerEmail }
      ]
    }
    
    console.log('📝 Event object to create:', JSON.stringify(event, null, 2))
    
    console.log('🚀 Calling createCalendarEvent...')
    let result: any
    try {
      result = await this.createCalendarEvent(trainerCalendarId, event, trainerEmail)
      console.log('✅ Calendar event creation result:', result)
    } catch (createError: any) {
      console.error('❌ createCalendarEvent threw error:', createError.message)
      throw createError
    }
    
    if (!result || !result.event_id) {
      console.error('Failed to create calendar event - no event_id returned')
      throw new Error('Calendar event creation failed - no event_id in response')
    }
    
    try {
      const user = await this.getUserByEmail(trainerEmail)
      await this.sendNotification(
        user.user_id,
        `New training session booked for ${merchantInfo.name} on ${date} from ${startTime} to ${endTime}`
      )
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError)
    }
    
    return result.event_id
  }

  /**
   * Cancel a training session
   */
  async cancelTraining(
    trainerEmail: string,
    trainerCalendarId: string,
    eventId: string,
    merchantName: string
  ): Promise<void> {
    await this.deleteCalendarEvent(trainerCalendarId, eventId)
    
    try {
      const user = await this.getUserByEmail(trainerEmail)
      await this.sendNotification(
        user.user_id,
        `Training session for ${merchantName} has been cancelled`
      )
    } catch (notifyError) {
      console.error('Failed to send cancellation notification:', notifyError)
    }
  }
}

export const larkService = new LarkService()