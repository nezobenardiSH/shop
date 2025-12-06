import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json()
    console.log('Admin notification callback received:', { code: code?.substring(0, 10) + '...', state })

    // Verify state
    const cookieStore = await cookies()
    const savedState = cookieStore.get('admin_notification_oauth_state')?.value

    if (!savedState || savedState !== state) {
      console.error('State mismatch:', { savedState, receivedState: state })
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      )
    }

    // Get app access token
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

    // Exchange code for user access token
    const tokenResponse = await fetch('https://open.larksuite.com/open-apis/authen/v1/oidc/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appTokenData.app_access_token}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code
      })
    })

    const tokenData = await tokenResponse.json()
    if (tokenData.code !== 0) {
      console.error('Token exchange failed:', JSON.stringify(tokenData, null, 2))
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

    // Store in NotificationAdmin table
    await prisma.notificationAdmin.upsert({
      where: { email: userInfo.email },
      update: {
        name: userInfo.name,
        larkUserId: userInfo.userId || userInfo.openId,
        isActive: true
      },
      create: {
        email: userInfo.email,
        name: userInfo.name,
        larkUserId: userInfo.userId || userInfo.openId,
        isActive: true
      }
    })

    console.log(`✅ Notification admin authorized: ${userInfo.email}`)

    // Clear the state cookie
    const response = NextResponse.json({
      success: true,
      userInfo
    })

    response.cookies.set('admin_notification_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    })

    return response
  } catch (error) {
    console.error('Admin notification authorization failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authorization failed' },
      { status: 500 }
    )
  }
}
