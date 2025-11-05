import { NextRequest, NextResponse } from 'next/server'
import { trackPageView, generateSessionId, getClientInfo } from '@/lib/analytics'
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
    
    // Get or create session ID
    const cookieStore = await cookies()
    let sessionId = cookieStore.get('analytics-session-id')?.value
    
    if (!sessionId) {
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
    
    // Set session cookie (24 hour expiry)
    const response = NextResponse.json({ success: true })
    response.cookies.set('analytics-session-id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    })
    
    return response
    
  } catch (error) {
    console.error('[Analytics API] Error tracking:', error)
    // Return success even on error - don't break client-side code
    return NextResponse.json({ success: true })
  }
}

