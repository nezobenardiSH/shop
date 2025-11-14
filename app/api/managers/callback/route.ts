import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json()
    console.log('Manager callback received:', { code: code?.substring(0, 10) + '...', state })
    
    // Verify state
    const cookieStore = await cookies()
    const savedState = cookieStore.get('manager_oauth_state')?.value
    console.log('State verification:', { savedState, receivedState: state, match: savedState === state })
    
    if (!savedState || savedState !== state) {
      console.error('State mismatch:', { savedState, receivedState: state })
      return NextResponse.json(
        { error: 'Invalid state parameter', savedState, receivedState: state },
        { status: 400 }
      )
    }
    
    // First, get app access token
    const appTokenResponse = await fetch('https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET
      })
    })
    
    const appTokenData = await appTokenResponse.json()
    if (appTokenData.code !== 0) {
      throw new Error(`Failed to get app token: ${appTokenData.msg}`)
    }
    
    // Exchange code for user access token using app token
    const tokenPayload = {
      grant_type: 'authorization_code',
      code
    }
    console.log('Exchanging code for token with payload:', {
      ...tokenPayload,
      code: code.substring(0, 10) + '...'
    })
    
    const tokenResponse = await fetch('https://open.larksuite.com/open-apis/authen/v1/oidc/access_token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appTokenData.app_access_token}`
      },
      body: JSON.stringify(tokenPayload)
    })
    
    const tokenData = await tokenResponse.json()
    console.log('Token response:', { 
      code: tokenData.code, 
      msg: tokenData.msg,
      data: tokenData.data ? 'exists' : 'missing',
      fullResponse: JSON.stringify(tokenData)
    })
    
    if (tokenData.code !== 0) {
      console.error('Token exchange failed with full response:', JSON.stringify(tokenData, null, 2))
      throw new Error(tokenData.msg || 'Failed to get access token')
    }
    
    // Get user info
    const userResponse = await fetch('https://open.larksuite.com/open-apis/authen/v1/user_info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.data.access_token}`
      }
    })
    
    const userData = await userResponse.json()
    
    if (userData.code !== 0) {
      throw new Error(userData.msg || 'Failed to get user info')
    }
    
    const userInfo = {
      email: userData.data.email,
      name: userData.data.name,
      userId: userData.data.user_id,
      openId: userData.data.open_id
    }

    // Store in database
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
    // Calculate expiry time - default to 7 days if not provided
    const expiresIn = tokenData.data.expire || tokenData.data.expires_in || 604800 // 7 days in seconds
    const expiresAt = new Date(Date.now() + (expiresIn * 1000))
    
    console.log('Token expiry calculation:', {
      expire: tokenData.data.expire,
      expires_in: tokenData.data.expires_in,
      calculatedExpiresIn: expiresIn,
      expiresAt: expiresAt.toISOString()
    })
    
    try {
      await prisma.larkAuthToken.upsert({
        where: { userEmail: userInfo.email },
        update: {
          larkUserId: userInfo.userId || userInfo.openId,
          userType: 'manager',
          accessToken: tokenData.data.access_token,
          refreshToken: tokenData.data.refresh_token,
          expiresAt: expiresAt,
          userName: userInfo.name,
          scopes: 'bitable:app contact:contact.base:readonly'
        },
        create: {
          userEmail: userInfo.email,
          larkUserId: userInfo.userId || userInfo.openId,
          userType: 'manager',
          accessToken: tokenData.data.access_token,
          refreshToken: tokenData.data.refresh_token,
          expiresAt: expiresAt,
          userName: userInfo.name,
          scopes: 'bitable:app contact:contact.base:readonly'
        }
      })
      
      console.log(`✅ Onboarding manager authorized: ${userInfo.email}`)
    } finally {
      await prisma.$disconnect()
    }
    
    // Create response with cleared cookie
    const response = NextResponse.json({
      success: true,
      userInfo
    })
    
    // Clear the state cookie by setting it with maxAge=0
    response.cookies.set('manager_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    })
    
    return response
  } catch (error) {
    console.error('Manager authorization failed:', error)
    const errorDetails = {
      error: error instanceof Error ? error.message : 'Authorization failed',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }
    return NextResponse.json(errorDetails, { status: 500 })
  }
}