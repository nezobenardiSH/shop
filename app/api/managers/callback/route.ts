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
    
    // Exchange code for access token
    console.log('Exchanging code for token with app_id:', process.env.LARK_APP_ID)
    const tokenResponse = await fetch('https://open.larksuite.com/open-apis/authen/v1/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET
      })
    })
    
    const tokenData = await tokenResponse.json()
    console.log('Token response:', { code: tokenData.code, msg: tokenData.msg })
    
    if (tokenData.code !== 0) {
      console.error('Token exchange failed:', tokenData)
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
    
    try {
      await prisma.larkAuthToken.upsert({
        where: { userEmail: userInfo.email },
        update: {
          larkUserId: userInfo.userId || userInfo.openId,
          accessToken: tokenData.data.access_token,
          refreshToken: tokenData.data.refresh_token,
          expiresAt: new Date(Date.now() + (tokenData.data.expire * 1000)),
          userName: userInfo.name
        },
        create: {
          userEmail: userInfo.email,
          larkUserId: userInfo.userId || userInfo.openId,
          accessToken: tokenData.data.access_token,
          refreshToken: tokenData.data.refresh_token,
          expiresAt: new Date(Date.now() + (tokenData.data.expire * 1000)),
          userName: userInfo.name
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authorization failed' },
      { status: 500 }
    )
  }
}