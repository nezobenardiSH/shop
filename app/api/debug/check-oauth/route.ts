import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
  }

  try {
    const isAuthorized = await larkOAuthService.isUserAuthorized(email)
    const hasToken = await larkOAuthService.getValidAccessToken(email)

    return NextResponse.json({
      email,
      isAuthorized,
      hasValidToken: !!hasToken,
      message: hasToken
        ? '✅ User has valid OAuth token'
        : '❌ No valid OAuth token found'
    })
  } catch (error: any) {
    return NextResponse.json({
      email,
      error: error.message
    }, { status: 500 })
  }
}
