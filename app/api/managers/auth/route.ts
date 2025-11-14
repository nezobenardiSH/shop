import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex')
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/managers/authorize`

  // Manager-specific scope: only bitable permission (for creating Lark Base records)
  const scope = 'bitable:app'

  // Store state in a cookie for verification
  const response = NextResponse.redirect(
    `https://open.larksuite.com/open-apis/authen/v1/authorize?` +
    `app_id=${process.env.LARK_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${state}` +
    `&scope=${encodeURIComponent(scope)}`
  )
  
  response.cookies.set('manager_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  })
  
  return response
}