import { NextResponse } from 'next/server'

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
    // First check manual tokens (for development/testing)
    const manualToken = this.userTokens.get(userEmail) || this.userTokens.get('default')
    if (manualToken) {
      console.log(`Using manual token for ${userEmail}`)
      return manualToken
    }

    // Production: Get from OAuth service
    try {
      const { larkOAuthService } = await import('./lark-oauth-service')
      const token = await larkOAuthService.getValidAccessToken(userEmail)
      if (token) {
        console.log(`Using OAuth token for ${userEmail}`)
        return token
      }
    } catch (error) {
      console.log(`Failed to get OAuth token for ${userEmail}:`, error)
    }

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
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    const data = await response.json()
    
    if (data.code !== 0) {
      console.error(`Lark API error: ${data.msg}`, data)
      throw new Error(`Lark API error: ${data.msg}`)
    }

    return data
  }

  /**
   * Query free/busy times for users
   */
  async queryFreeBusy(query: FreeBusyQuery): Promise<FreeBusyResponse> {
    return await this.makeRequest('/open-apis/calendar/v4/freebusy/query', {
      method: 'POST',
      body: JSON.stringify(query)
    })
  }

  /**
   * Get available time slots for a trainer using FreeBusy API
   */
  async getAvailableSlots(
    trainerEmail: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; slots: Array<{ start: string; end: string; available: boolean }> }>> {
    const timeMin = startDate.toISOString()
    const timeMax = endDate.toISOString()

    let busyTimes: Array<{start_time: string; end_time: string}> = []
    
    try {
      // Use the new FreeBusy API method
      const freeBusyResponse = await this.getFreeBusySchedule(
        [trainerEmail],
        startDate,
        endDate,
        trainerEmail
      )
      
      if (freeBusyResponse.data?.freebusy_list && freeBusyResponse.data.freebusy_list.length > 0) {
        const trainerData = freeBusyResponse.data.freebusy_list[0]
        busyTimes = trainerData.busy_time || []
        console.log(`Found ${busyTimes.length} busy slots for ${trainerEmail}`)
      } else {
        console.log(`No busy times found for ${trainerEmail}, calendar might be free`)
      }
    } catch (error) {
      console.log('Could not fetch busy times, assuming all slots are available:', error)
      // Continue with empty busy times array (all slots will show as available)
    }
    
    const result: Array<{ date: string; slots: Array<{ start: string; end: string; available: boolean }> }> = []
    
    const TIME_SLOTS = [
      { start: '09:00', end: '11:00' },
      { start: '11:00', end: '13:00' },
      { start: '13:00', end: '15:00' },
      { start: '15:00', end: '17:00' },
      { start: '16:00', end: '18:00' }
    ]

    const current = new Date(startDate)
    while (current <= endDate) {
      const dayOfWeek = current.getDay()
      
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dateStr = current.toISOString().split('T')[0]
        const slots = TIME_SLOTS.map(slot => {
          const slotStart = new Date(`${dateStr}T${slot.start}:00`)
          const slotEnd = new Date(`${dateStr}T${slot.end}:00`)
          
          const isAvailable = !busyTimes.some(busy => {
            const busyStart = new Date(busy.start_time)
            const busyEnd = new Date(busy.end_time)
            return (slotStart < busyEnd && slotEnd > busyStart)
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
   * Create calendar event
   */
  async createCalendarEvent(
    calendarId: string,
    event: LarkEvent,
    userEmail?: string
  ): Promise<{ event_id: string }> {
    console.log('Creating calendar event:', {
      calendarId,
      event
    })
    
    // If calendarId is 'primary' and we have an email, try to get the real calendar ID
    let actualCalendarId = calendarId
    if (calendarId === 'primary' && userEmail) {
      try {
        actualCalendarId = await this.getPrimaryCalendarId(userEmail)
        console.log(`Using fetched calendar ID: ${actualCalendarId}`)
      } catch (error) {
        console.log('Could not fetch calendar ID, using primary')
        actualCalendarId = 'primary'
      }
    }
    
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
      console.log('Fetching FreeBusy for users:', userEmails);
      
      // Get user IDs for all emails
      const userPromises = userEmails.map(email => this.getUserByEmail(email));
      const users = await Promise.all(userPromises);
      
      const userIds = users.map(u => u.user_id).filter(id => id);
      
      if (userIds.length === 0) {
        console.log('No valid user IDs found');
        return {
          code: 0,
          msg: 'success',
          data: { freebusy_list: [] }
        };
      }
      
      const requestBody = {
        time_min: startTime.toISOString(),
        time_max: endTime.toISOString(),
        user_id_list: userIds
      };
      
      console.log('FreeBusy request:', requestBody);
      
      const response = await this.makeRequest('/open-apis/calendar/v4/freebusy/query', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        userEmail: requestingUserEmail || userEmails[0]
      });
      
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
    const startDateTime = new Date(`${date}T${startTime}:00`)
    const endDateTime = new Date(`${date}T${endTime}:00`)
    
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
    
    const event: LarkEvent = {
      summary: eventTitle,
      description,
      location: merchantInfo.address,
      start_time: {
        timestamp: (startDateTime.getTime() / 1000).toString(),
        timezone: 'Asia/Singapore'
      },
      end_time: {
        timestamp: (endDateTime.getTime() / 1000).toString(),
        timezone: 'Asia/Singapore'
      },
      attendees: [
        { email: trainerEmail }
      ]
    }
    
    const result = await this.createCalendarEvent(trainerCalendarId, event, trainerEmail)
    
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