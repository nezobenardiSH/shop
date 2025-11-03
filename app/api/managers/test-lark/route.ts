import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Test getting app access token with our credentials
    const tokenResponse = await fetch('https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET
      })
    })
    
    const tokenData = await tokenResponse.json()
    
    return NextResponse.json({
      success: tokenData.code === 0,
      appId: process.env.LARK_APP_ID,
      hasSecret: !!process.env.LARK_APP_SECRET,
      tokenResponse: {
        code: tokenData.code,
        msg: tokenData.msg,
        hasToken: !!tokenData.app_access_token
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Test failed'
    }, { status: 500 })
  }
}