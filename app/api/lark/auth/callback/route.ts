import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Use production URL for redirects - define at function scope
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding-portal-b0ay.onrender.com'

  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    // Determine user type from state parameter (format: "trainer_xxx" or "installer_xxx")
    const userType = state?.startsWith('installer_') ? 'installer' : 'trainer'
    const redirectPath = userType === 'installer' ? '/installers/authorize' : '/trainers/authorize'

    console.log('🔙 OAuth Callback Received:', {
      hasCode: !!code,
      state: state,
      stateStartsWith: state?.substring(0, 10),
      detectedUserType: userType,
      redirectPath: redirectPath,
      allParams: Object.fromEntries(searchParams.entries())
    })

    if (!code) {
      return NextResponse.redirect(
        new URL(`${redirectPath}?error=no_code`, baseUrl)
      )
    }

    // Import dynamically to avoid initialization issues
    const { larkOAuthService } = await import('@/lib/lark-oauth-service')

    // Quick response to avoid timeout - process in background
    const response = NextResponse.redirect(
      new URL(`${redirectPath}?processing=true&code=${code}`, baseUrl)
    )

    // Process token exchange asynchronously with user type
    larkOAuthService.exchangeCodeForTokens(code, userType).then(
      (userEmail) => {
        console.log(`Successfully authorized Lark for ${userType}: ${userEmail}`)
      },
      (error) => {
        console.error('OAuth token exchange error:', error)
      }
    )

    return response

  } catch (error: any) {
    console.error('OAuth callback error:', error)
    // Default to trainers page if we can't determine type
    const state = request.nextUrl.searchParams.get('state')
    const userType = state?.startsWith('installer_') ? 'installer' : 'trainer'
    const redirectPath = userType === 'installer' ? '/installers/authorize' : '/trainers/authorize'

    return NextResponse.redirect(
      new URL(`${redirectPath}?error=${encodeURIComponent(error.message)}`, baseUrl)
    )
  }
}