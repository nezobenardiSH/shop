import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex')
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/admins/authorize`

  // Minimal scope - we only need user info for notification admins
  const scope = 'contact:user.email:readonly'

  const response = NextResponse.redirect(
    `https://open.larksuite.com/open-apis/authen/v1/authorize?` +
    `app_id=${process.env.LARK_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${state}` +
    `&scope=${encodeURIComponent(scope)}`
  )

  response.cookies.set('admin_notification_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  })

  return response
}
