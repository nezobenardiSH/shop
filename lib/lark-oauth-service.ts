/**
 * Production-ready Lark OAuth Service
 * Handles OAuth flow, token storage in database, and automatic refresh
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface LarkTokenResponse {
  code: number
  msg: string
  data: {
    access_token: string
    refresh_token: string
    expires_in: number
    open_id: string
    user_id?: string
    tenant_key?: string
  }
}

interface LarkUserInfoResponse {
  code: number
  msg: string
  data: {
    name: string
    en_name?: string
    avatar_url?: string
    email?: string
    user_id: string
    open_id: string
  }
}

export class LarkOAuthService {
  private baseUrl: string
  private appId: string
  private appSecret: string
  private redirectUri: string

  constructor() {
    this.baseUrl = process.env.LARK_DOMAIN || 'https://open.larksuite.com'
    this.appId = process.env.LARK_APP_ID || ''
    this.appSecret = process.env.LARK_APP_SECRET || ''
    
    // Support multiple redirect URI patterns
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding-portal-b0ay.onrender.com'
    
    // Try the configured redirect URI, or fall back to common patterns
    if (process.env.LARK_REDIRECT_URI) {
      this.redirectUri = process.env.LARK_REDIRECT_URI
    } else {
      // Try without /api first since Lark might not accept it
      this.redirectUri = `${baseUrl}/lark-callback`
    }
    
    console.log('Lark OAuth Service initialized:')
    console.log('- App ID:', this.appId ? `${this.appId.substring(0, 10)}...` : 'NOT SET')
    console.log('- App Secret:', this.appSecret ? 'SET' : 'NOT SET')
    console.log('- Redirect URI:', this.redirectUri)
    console.log('- Base URL:', this.baseUrl)
    
    if (!this.appId || !this.appSecret) {
      console.error('ERROR: Lark OAuth credentials not configured properly!')
      console.error('Please check LARK_APP_ID and LARK_APP_SECRET in .env.local')
    }
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const scope = 'calendar:calendar calendar:calendar.event:create calendar:calendar.event:read calendar:calendar.event:update calendar:calendar.event:delete calendar:calendar.free_busy:read bitable:app contact:contact.base:readonly'

    console.log('🔐 OAuth scope being requested:', scope)

    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scope,
      state: state || ''
    })

    const authUrl = `${this.baseUrl}/open-apis/authen/v1/authorize?${params.toString()}`
    console.log('🔗 Full authorization URL:', authUrl)

    return authUrl
  }

  /**
   * Exchange authorization code for tokens and store in database
   */
  async exchangeCodeForTokens(code: string, userType: 'trainer' | 'installer' | 'manager' = 'trainer'): Promise<string> {
    // Check credentials before making the request
    if (!this.appId || !this.appSecret) {
      console.error('Missing credentials:', {
        appId: this.appId ? 'SET' : 'MISSING',
        appSecret: this.appSecret ? 'SET' : 'MISSING'
      })
      throw new Error('Failed to exchange code: missing app id or app secret')
    }
    
    // Lark OAuth uses 'app_id' and 'app_secret' not 'client_id' and 'client_secret'
    const requestBody = {
      grant_type: 'authorization_code',
      app_id: this.appId,
      app_secret: this.appSecret,
      code: code,
      redirect_uri: this.redirectUri
    }
    
    console.log('Exchanging code for tokens with:', {
      appId: this.appId,
      appSecretLength: this.appSecret.length,
      redirectUri: this.redirectUri,
      codePrefix: code.substring(0, 10) + '...',
      url: `${this.baseUrl}/open-apis/authen/v1/access_token`,
      requestBody: JSON.stringify(requestBody)
    })
    
    // Exchange code for tokens
    const response = await fetch(`${this.baseUrl}/open-apis/authen/v1/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    const tokenData: LarkTokenResponse = await response.json()
    
    console.log('Lark token exchange response:', {
      code: tokenData.code,
      msg: tokenData.msg,
      hasData: !!tokenData.data
    })
    
    if (tokenData.code !== 0) {
      console.error('Full error response from Lark:', JSON.stringify(tokenData, null, 2))
      throw new Error(`Failed to exchange code: ${tokenData.msg}`)
    }

    // Get user info
    const userInfo = await this.getUserInfo(tokenData.data.access_token)
    
    const userEmail = userInfo.data.email || `${userInfo.data.open_id}@lark.user`
    const expiresAt = new Date(Date.now() + (tokenData.data.expires_in * 1000))
    const larkUserId = userInfo.data.user_id || ''
    const larkOpenId = userInfo.data.open_id || tokenData.data.open_id || ''

    // Get user's primary calendar ID
    const calendarId = await this.getPrimaryCalendarId(
      tokenData.data.access_token, 
      userEmail
    )

    // Store or update in database
    await prisma.larkAuthToken.upsert({
      where: { userEmail },
      create: {
        userEmail,
        userName: userInfo.data.name,
        larkUserId: larkUserId || larkOpenId,
        userType,
        accessToken: tokenData.data.access_token,
        refreshToken: tokenData.data.refresh_token,
        expiresAt,
        calendarId,
        scopes: 'calendar:calendar calendar:calendar.event:create calendar:calendar.event:read calendar:calendar.event:update calendar:calendar.event:delete calendar:calendar.free_busy:read'
      },
      update: {
        userType,
        accessToken: tokenData.data.access_token,
        refreshToken: tokenData.data.refresh_token,
        expiresAt,
        calendarId,
        userName: userInfo.data.name,
        larkUserId: larkUserId || larkOpenId
      }
    })

    // Also update the config files with Lark IDs
    try {
      const { updateConfigWithLarkIds } = await import('./update-config-with-lark-ids')
      await updateConfigWithLarkIds(userEmail, larkUserId, larkOpenId, userType)
      console.log(`✅ Updated ${userType} config with Lark IDs for ${userEmail}`)
    } catch (error) {
      console.error(`Failed to update ${userType} config:`, error)
      // Don't fail the whole process if config update fails
    }

    return userEmail
  }

  /**
   * Get user info using access token
   */
  private async getUserInfo(accessToken: string): Promise<LarkUserInfoResponse> {
    const response = await fetch(`${this.baseUrl}/open-apis/authen/v1/user_info`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    const data = await response.json()
    if (data.code !== 0) {
      throw new Error(`Failed to get user info: ${data.msg}`)
    }

    return data
  }

  /**
   * Get primary calendar ID for a user
   * Finds a writable calendar (native Lark calendar, not synced Google calendar)
   */
  private async getPrimaryCalendarId(accessToken: string, userEmail: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/open-apis/calendar/v4/calendars`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const data = await response.json()

      if (data.code === 0 && data.data?.calendar_list) {
        const calendars = data.data.calendar_list

        console.log(`🔍 Finding writable calendar for ${userEmail} during OAuth...`)
        console.log(`   Total calendars: ${calendars.length}`)

        // PRIORITY 1: Find PRIMARY type calendar (native Lark calendar, not synced from Google)
        // Google synced calendars (type: 'google') cannot be written to via Lark API
        const primaryCalendar = calendars.find((cal: any) =>
          cal.type === 'primary' &&
          cal.role === 'owner'
        )

        if (primaryCalendar) {
          console.log(`✅ Found primary Lark calendar: ${primaryCalendar.calendar_id}`)
          console.log(`   Summary: ${primaryCalendar.summary}`)
          console.log(`   Type: ${primaryCalendar.type}`)
          console.log(`   Role: ${primaryCalendar.role}`)
          return primaryCalendar.calendar_id
        }

        // PRIORITY 2: Find any owner calendar that is NOT a Google sync
        const nativeCalendar = calendars.find((cal: any) =>
          cal.role === 'owner' &&
          cal.type !== 'google'
        )

        if (nativeCalendar) {
          console.log(`✅ Found native Lark calendar: ${nativeCalendar.calendar_id}`)
          console.log(`   Type: ${nativeCalendar.type}`)
          return nativeCalendar.calendar_id
        }

        // PRIORITY 3: Fallback to any owner calendar (may be Google sync - might not work)
        const ownerCalendar = calendars.find((cal: any) => cal.role === 'owner')
        if (ownerCalendar) {
          console.log(`⚠️ Using owner calendar (may be Google sync): ${ownerCalendar.calendar_id}`)
          console.log(`   Type: ${ownerCalendar.type}`)
          return ownerCalendar.calendar_id
        }

        // PRIORITY 4: Fallback to first calendar
        if (calendars[0]) {
          console.log(`⚠️ Using first calendar: ${calendars[0].calendar_id}`)
          return calendars[0].calendar_id
        }
      }
    } catch (error) {
      console.error('Failed to get calendar ID:', error)
    }

    console.log(`⚠️ No calendar found, using 'primary' as fallback`)
    return 'primary'
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string
    expiresAt: Date
  }> {
    const response = await fetch(`${this.baseUrl}/open-apis/authen/v1/refresh_access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        app_id: this.appId,
        app_secret: this.appSecret
      })
    })

    const data: LarkTokenResponse = await response.json()
    
    if (data.code !== 0) {
      throw new Error(`Failed to refresh token: ${data.msg}`)
    }

    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: new Date(Date.now() + (data.data.expires_in * 1000))
    }
  }

  /**
   * Get valid access token for a user (refreshes if needed)
   */
  async getValidAccessToken(userEmail: string): Promise<string | null> {
    const token = await prisma.larkAuthToken.findUnique({
      where: { userEmail }
    })

    if (!token) {
      console.log(`No token found for ${userEmail}`)
      return null
    }

    // Check if token is expired (with 5 minute buffer)
    const now = new Date()
    const expiryBuffer = new Date(token.expiresAt.getTime() - 5 * 60 * 1000)
    
    if (now < expiryBuffer) {
      // Token is still valid
      return token.accessToken
    }

    // Token needs refresh
    console.log(`Refreshing token for ${userEmail}`)
    
    try {
      const newTokens = await this.refreshAccessToken(token.refreshToken)
      
      // Update in database
      await prisma.larkAuthToken.update({
        where: { userEmail },
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresAt: newTokens.expiresAt
        }
      })

      return newTokens.accessToken
    } catch (error) {
      console.error(`Failed to refresh token for ${userEmail}:`, error)
      
      // Mark token as invalid
      await prisma.larkAuthToken.delete({
        where: { userEmail }
      })
      
      return null
    }
  }

  /**
   * Check if a user has authorized the app
   */
  async isUserAuthorized(userEmail: string): Promise<boolean> {
    try {
      const token = await prisma.larkAuthToken.findUnique({
        where: { userEmail }
      })

      return !!token
    } catch (error) {
      console.error(`⚠️ Database error checking authorization for ${userEmail}:`, error)
      // In case of database connection error, return false
      // This prevents the system from crashing but means the user won't be available
      return false
    }
  }

  /**
   * Get all authorized trainers
   */
  async getAuthorizedTrainers(): Promise<Array<{
    email: string
    name: string
    calendarId: string
    authorized: boolean
  }>> {
    const tokens = await prisma.larkAuthToken.findMany({
      where: {
        OR: [
          { userType: 'trainer' },
          { userType: null }  // Include legacy records without userType
        ]
      },
      select: {
        userEmail: true,
        userName: true,
        calendarId: true
      }
    })

    return tokens.map(t => ({
      email: t.userEmail,
      name: t.userName || t.userEmail,
      calendarId: t.calendarId || 'primary',
      authorized: true
    }))
  }

  /**
   * Get all authorized installers
   */
  async getAuthorizedInstallers(): Promise<Array<{
    email: string
    name: string
    calendarId: string
    authorized: boolean
  }>> {
    const tokens = await prisma.larkAuthToken.findMany({
      where: {
        userType: 'installer'
      },
      select: {
        userEmail: true,
        userName: true,
        calendarId: true
      }
    })

    return tokens.map(t => ({
      email: t.userEmail,
      name: t.userName || t.userEmail,
      calendarId: t.calendarId || 'primary',
      authorized: true
    }))
  }

  /**
   * Revoke authorization for a user
   */
  async revokeAuthorization(userEmail: string): Promise<void> {
    await prisma.larkAuthToken.delete({
      where: { userEmail }
    })
  }
}

// Extend global type to include our service instance
declare global {
  var larkOAuthServiceInstance: LarkOAuthService | undefined
}

// Create a getter function to ensure environment variables are loaded
function getLarkOAuthService() {
  // In Next.js, we need to ensure env vars are loaded before instantiation
  if (!global.larkOAuthServiceInstance) {
    global.larkOAuthServiceInstance = new LarkOAuthService()
  }
  return global.larkOAuthServiceInstance as LarkOAuthService
}

export const larkOAuthService = getLarkOAuthService()