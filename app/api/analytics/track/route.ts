import { NextRequest, NextResponse } from 'next/server'
import { trackPageView, generateSessionId, getClientInfo, isSessionExpired } from '@/lib/analytics'
import { verifyToken } from '@/lib/auth-utils'
import { cookies } from 'next/headers'

/**
 * POST /api/analytics/track
 * Client-side tracking endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { merchantId, merchantName, page, action, metadata } = body

    // Get or create session ID with inactivity timeout check
    const cookieStore = await cookies()
    const existingSessionId = cookieStore.get('analytics-session-id')?.value
    const lastActivity = cookieStore.get('analytics-last-activity')?.value

    // Check if session has expired due to inactivity (30 min timeout)
    let sessionId: string
    if (existingSessionId && !isSessionExpired(lastActivity)) {
      sessionId = existingSessionId
    } else {
      sessionId = generateSessionId(request)
    }
    
    // Get client info
    const { userAgent, ipAddress, deviceType } = getClientInfo(request)
    
    // Get user info from auth token if available
    let isInternalUser = false
    let userType = 'merchant'
    
    const authToken = cookieStore.get('auth-token')?.value
    if (authToken) {
      const decoded = verifyToken(authToken)
      if (decoded) {
        isInternalUser = decoded.isInternalUser || false
        userType = decoded.userType || 'merchant'
      }
    }
    
    // Track the page view/event
    await trackPageView({
      merchantId,
      merchantName,
      page,
      action,
      sessionId,
      userAgent,
      deviceType,
      ipAddress,
      isInternalUser,
      userType,
      metadata
    })
    
    // Set session cookie and update last activity timestamp
    const response = NextResponse.json({ success: true })
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 // 24 hours
    }

    response.cookies.set('analytics-session-id', sessionId, cookieOptions)
    response.cookies.set('analytics-last-activity', Date.now().toString(), cookieOptions)

    return response
    
  } catch (error) {
    console.error('[Analytics API] Error tracking:', error)
    // Return success even on error - don't break client-side code
    return NextResponse.json({ success: true })
  }
}

