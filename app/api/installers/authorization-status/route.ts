import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'

export async function GET(request: NextRequest) {
  try {
    // For now, we'll just check if any installer is authorized
    // In a real app, you'd identify the specific installer
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')
    
    if (!email) {
      // Could check based on session/auth
      return NextResponse.json({
        authorized: false,
        message: 'No email provided'
      })
    }
    
    const isAuthorized = await larkOAuthService.isUserAuthorized(email)
    
    if (isAuthorized) {
      return NextResponse.json({
        authorized: true,
        userEmail: email
      })
    }
    
    return NextResponse.json({
      authorized: false,
      message: 'Not authorized'
    })
    
  } catch (error) {
    console.error('Error checking installer authorization status:', error)
    return NextResponse.json(
      { 
        authorized: false,
        error: 'Failed to check authorization status' 
      },
      { status: 500 }
    )
  }
}