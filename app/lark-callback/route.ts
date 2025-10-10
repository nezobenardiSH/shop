import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    console.log('OAuth callback received with code:', code?.substring(0, 10) + '...')
    
    if (!code) {
      return NextResponse.redirect(
        new URL('/trainers/authorize?error=no_code', request.url)
      )
    }

    // Import dynamically and ensure env vars are available
    console.log('Environment check in callback:', {
      LARK_APP_ID: process.env.LARK_APP_ID ? 'SET' : 'NOT SET',
      LARK_APP_SECRET: process.env.LARK_APP_SECRET ? 'SET' : 'NOT SET',
      LARK_REDIRECT_URI: process.env.LARK_REDIRECT_URI
    })
    
    const { larkOAuthService } = await import('@/lib/lark-oauth-service')
    
    try {
      // Exchange code for tokens and save to database
      console.log('Exchanging code for tokens...')
      const userEmail = await larkOAuthService.exchangeCodeForTokens(code)
      console.log(`Successfully authorized Lark for user: ${userEmail}`)
      
      // Redirect with success
      return NextResponse.redirect(
        new URL(`/trainers/authorize?success=true&email=${encodeURIComponent(userEmail)}`, request.url)
      )
    } catch (exchangeError: any) {
      console.error('OAuth token exchange error:', exchangeError)
      console.error('Error details:', exchangeError.message)
      
      // Redirect with error
      return NextResponse.redirect(
        new URL(`/trainers/authorize?error=${encodeURIComponent(exchangeError.message)}`, request.url)
      )
    }
    
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/trainers/authorize?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }
}