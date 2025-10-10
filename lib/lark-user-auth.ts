/**
 * Lark User Authentication Service
 * Handles user-level authentication for calendar operations
 */

interface UserToken {
  access_token: string
  refresh_token: string
  expires_at: number
  user_id: string
}

class LarkUserAuthService {
  private baseUrl: string
  private appId: string
  private appSecret: string
  private userTokens: Map<string, UserToken> = new Map()

  constructor() {
    this.baseUrl = process.env.LARK_DOMAIN || 'https://open.larksuite.com'
    this.appId = process.env.LARK_APP_ID || ''
    this.appSecret = process.env.LARK_APP_SECRET || ''
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'calendar:calendar calendar:calendar.event:create calendar:calendar.event:read calendar:calendar.event:update calendar:calendar.event:delete calendar:calendar.free_busy:read',
      state: state || ''
    })

    return `${this.baseUrl}/open-apis/authen/v1/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<UserToken> {
    const response = await fetch(`${this.baseUrl}/open-apis/authen/v1/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.appId,
        client_secret: this.appSecret,
        code: code,
        redirect_uri: redirectUri
      })
    })

    const data = await response.json()
    
    if (data.code !== 0) {
      throw new Error(`Failed to exchange code: ${data.msg}`)
    }

    const token: UserToken = {
      access_token: data.data.access_token,
      refresh_token: data.data.refresh_token,
      expires_at: Date.now() + (data.data.expires_in * 1000),
      user_id: data.data.open_id
    }

    // Store token for the user
    this.userTokens.set(data.data.open_id, token)

    return token
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<UserToken> {
    const response = await fetch(`${this.baseUrl}/open-apis/authen/v1/refresh_access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    const data = await response.json()
    
    if (data.code !== 0) {
      throw new Error(`Failed to refresh token: ${data.msg}`)
    }

    const token: UserToken = {
      access_token: data.data.access_token,
      refresh_token: data.data.refresh_token,
      expires_at: Date.now() + (data.data.expires_in * 1000),
      user_id: data.data.open_id
    }

    // Update stored token
    this.userTokens.set(data.data.open_id, token)

    return token
  }

  /**
   * Get valid access token for a user
   */
  async getUserAccessToken(userId: string): Promise<string> {
    const token = this.userTokens.get(userId)
    
    if (!token) {
      throw new Error(`No token found for user ${userId}. User needs to authorize the app.`)
    }

    // Check if token is expired
    if (Date.now() >= token.expires_at - 60000) { // Refresh 1 minute before expiry
      const newToken = await this.refreshAccessToken(token.refresh_token)
      return newToken.access_token
    }

    return token.access_token
  }

  /**
   * Make authenticated request with user token
   */
  async makeUserRequest(userId: string, endpoint: string, options: RequestInit = {}): Promise<any> {
    const accessToken = await this.getUserAccessToken(userId)

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    const data = await response.json()
    
    if (data.code !== 0) {
      throw new Error(`API request failed: ${data.msg}`)
    }

    return data
  }

  /**
   * Store user token (for initial setup or migration)
   */
  storeUserToken(userId: string, accessToken: string, refreshToken: string, expiresIn: number = 7200) {
    this.userTokens.set(userId, {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Date.now() + (expiresIn * 1000),
      user_id: userId
    })
  }
}

export const larkUserAuthService = new LarkUserAuthService()