import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Use production URL for redirects - define at function scope
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding-portal-b0ay.onrender.com'

  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    // Determine user type from state parameter
    const userType = state?.includes('installer') ? 'installer' : 'trainer'
    const authPage = userType === 'installer' ? '/installers/authorize' : '/trainers/authorize'

    console.log('OAuth callback received with code:', code?.substring(0, 10) + '...')
    console.log('User type:', userType)

    if (!code) {
      return NextResponse.redirect(
        new URL(`${authPage}?error=no_code`, baseUrl)
      )
    }

    // Import dynamically and ensure env vars are available
    console.log('Environment check in callback:', {
      LARK_APP_ID: process.env.LARK_APP_ID ? 'SET' : 'NOT SET',
      LARK_APP_SECRET: process.env.LARK_APP_SECRET ? 'SET' : 'NOT SET',
      LARK_REDIRECT_URI: process.env.LARK_REDIRECT_URI,
      NEXT_PUBLIC_APP_URL: baseUrl
    })

    const { larkOAuthService } = await import('@/lib/lark-oauth-service')

    try {
      // Exchange code for tokens and save to database
      console.log('Exchanging code for tokens...')
      const userEmail = await larkOAuthService.exchangeCodeForTokens(code, userType as 'trainer' | 'installer')
      console.log(`Successfully authorized Lark for ${userType}: ${userEmail}`)

      // Redirect with success
      return NextResponse.redirect(
        new URL(`${authPage}?success=true&email=${encodeURIComponent(userEmail)}`, baseUrl)
      )
    } catch (exchangeError: any) {
      console.error('OAuth token exchange error:', exchangeError)
      console.error('Error details:', exchangeError.message)

      // Redirect with error
      return NextResponse.redirect(
        new URL(`${authPage}?error=${encodeURIComponent(exchangeError.message)}`, baseUrl)
      )
    }

  } catch (error: any) {
    console.error('OAuth callback error:', error)
    // Default to trainer page if we can't determine user type
    const authPage = '/trainers/authorize'
    return NextResponse.redirect(
      new URL(`${authPage}?error=${encodeURIComponent(error.message)}`, baseUrl)
    )
  }
}