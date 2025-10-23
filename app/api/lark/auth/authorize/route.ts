import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'

export async function GET(request: NextRequest) {
  try {
    // Get user type from query parameter
    const searchParams = request.nextUrl.searchParams
    const userType = searchParams.get('type') || 'trainer'
    
    // Generate state for CSRF protection and include user type
    const state = `${userType}_${Math.random().toString(36).substring(7)}`
    
    // Get the authorization URL
    const authUrl = larkOAuthService.getAuthorizationUrl(state)
    
    // Check if this is a fetch request (from installer page) or direct navigation (from trainer page)
    const acceptHeader = request.headers.get('accept') || ''
    const isFetchRequest = acceptHeader.includes('application/json')
    
    if (isFetchRequest) {
      // Return JSON for fetch requests (installer page)
      return NextResponse.json({ authUrl })
    } else {
      // Redirect directly for direct navigation (trainer page)
      return NextResponse.redirect(authUrl)
    }
    
  } catch (error: any) {
    console.error('Authorization initiation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initiate authorization',
        details: error.message 
      },
      { status: 500 }
    )
  }
}