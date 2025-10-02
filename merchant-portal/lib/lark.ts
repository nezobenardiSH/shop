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

  constructor() {
    this.baseUrl = process.env.LARK_DOMAIN || 'https://open.larksuite.com'
    this.appId = process.env.LARK_APP_ID || ''
    this.appSecret = process.env.LARK_APP_SECRET || ''
    
    if (!this.appId || !this.appSecret) {
      console.error('Lark credentials not configured in environment')
    }
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
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const token = await this.getAccessToken()
    
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
   * Get available time slots for a trainer
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
      const freeBusyResponse = await this.queryFreeBusy({
        time_min: timeMin,
        time_max: timeMax,
        user_id_list: [trainerEmail]
      })
      
      busyTimes = freeBusyResponse.data?.freebusy_list[0]?.busy_time || []
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
    event: LarkEvent
  ): Promise<{ event_id: string }> {
    console.log('Creating calendar event:', {
      calendarId,
      event
    })
    
    // If calendarId is 'primary', we need to get the actual calendar ID for the user
    // For now, let's try using the user's email as the calendar_id
    const actualCalendarId = calendarId === 'primary' ? 'primary_calendar' : calendarId
    
    const response = await this.makeRequest(`/open-apis/calendar/v4/calendars/${actualCalendarId}/events`, {
      method: 'POST',
      body: JSON.stringify(event)
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
    endTime: string
  ): Promise<string> {
    const startDateTime = new Date(`${date}T${startTime}:00`)
    const endDateTime = new Date(`${date}T${endTime}:00`)
    
    // Build detailed description with merchant information
    let description = `🏪 Onboarding Training Session\n\n`
    description += `📍 Merchant: ${merchantInfo.name}\n`
    if (merchantInfo.address) {
      description += `📮 Address: ${merchantInfo.address}\n`
    }
    if (merchantInfo.phone) {
      description += `📞 Phone: ${merchantInfo.phone}\n`
    }
    if (merchantInfo.contactPerson) {
      description += `👤 Contact Person: ${merchantInfo.contactPerson}\n`
    }
    if (merchantInfo.businessType) {
      description += `🏢 Business Type: ${merchantInfo.businessType}\n`
    }
    description += `\n📋 Training Topics:\n`
    description += `• System setup and configuration\n`
    description += `• POS operations training\n`
    description += `• Payment processing\n`
    description += `• Reporting and analytics\n`
    
    if (merchantInfo.salesforceId) {
      description += `\n🔗 Salesforce ID: ${merchantInfo.salesforceId}`
    }
    
    const event: LarkEvent = {
      summary: `Training: ${merchantInfo.name}`,
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
    
    const result = await this.createCalendarEvent(trainerCalendarId, event)
    
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