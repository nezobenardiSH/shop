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
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'calendar:calendar calendar:calendar.event:create calendar:calendar.event:read calendar:calendar.event:update calendar:calendar.event:delete calendar:calendar.free_busy:read',
      state: state || ''
    })

    return `${this.baseUrl}/open-apis/authen/v1/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens and store in database
   */
  async exchangeCodeForTokens(code: string): Promise<string> {
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
        larkUserId: userInfo.data.user_id || userInfo.data.open_id,
        accessToken: tokenData.data.access_token,
        refreshToken: tokenData.data.refresh_token,
        expiresAt,
        calendarId,
        scopes: 'calendar:calendar calendar:calendar.event:create calendar:calendar.event:read calendar:calendar.event:update calendar:calendar.event:delete calendar:calendar.free_busy:read'
      },
      update: {
        accessToken: tokenData.data.access_token,
        refreshToken: tokenData.data.refresh_token,
        expiresAt,
        calendarId,
        userName: userInfo.data.name,
        larkUserId: userInfo.data.user_id || userInfo.data.open_id
      }
    })

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
        const primary = calendars.find((cal: any) => 
          cal.type === 'primary' || 
          cal.role === 'owner' ||
          cal.summary?.toLowerCase().includes('primary')
        )
        
        return primary?.calendar_id || calendars[0]?.calendar_id || 'primary'
      }
    } catch (error) {
      console.error('Failed to get calendar ID:', error)
    }
    
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
    const token = await prisma.larkAuthToken.findUnique({
      where: { userEmail }
    })
    
    return !!token
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