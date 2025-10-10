import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'

export async function GET(request: NextRequest) {
  try {
    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(7)
    
    // Get the authorization URL
    const authUrl = larkOAuthService.getAuthorizationUrl(state)
    
    // Redirect directly to Lark authorization
    return NextResponse.redirect(authUrl)
    
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