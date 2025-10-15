import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    // Use production URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding-portal-b0ay.onrender.com'

    if (!code) {
      return NextResponse.redirect(
        new URL('/trainers/authorize?error=no_code', baseUrl)
      )
    }

    // Import dynamically to avoid initialization issues
    const { larkOAuthService } = await import('@/lib/lark-oauth-service')

    // Quick response to avoid timeout - process in background
    const response = NextResponse.redirect(
      new URL(`/trainers/authorize?processing=true&code=${code}`, baseUrl)
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
      new URL(`/trainers/authorize?error=${encodeURIComponent(error.message)}`, baseUrl)
    )
  }
}