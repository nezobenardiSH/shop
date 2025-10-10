import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    if (!code) {
      return NextResponse.redirect(
        new URL('/trainers/authorize?error=no_code', request.url)
      )
    }

    // Import dynamically to avoid initialization issues
    const { larkOAuthService } = await import('@/lib/lark-oauth-service')
    
    // Quick response to avoid timeout - process in background
    const response = NextResponse.redirect(
      new URL(`/trainers/authorize?processing=true&code=${code}`, request.url)
    )
    
    // Process token exchange asynchronously
    larkOAuthService.exchangeCodeForTokens(code).then(
      (userEmail) => {
        console.log(`Successfully authorized Lark for user: ${userEmail}`)
      },
      (error) => {
        console.error('OAuth token exchange error:', error)
      }
    )
    
    return response
    
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/trainers/authorize?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }
}