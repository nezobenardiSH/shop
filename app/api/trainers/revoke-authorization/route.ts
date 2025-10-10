import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    
    await larkOAuthService.revokeAuthorization(email)
    
    return NextResponse.json({
      success: true,
      message: `Authorization revoked for ${email}`
    })
    
  } catch (error: any) {
    console.error('Failed to revoke authorization:', error)
    return NextResponse.json(
      { 
        error: 'Failed to revoke authorization',
        details: error.message 
      },
      { status: 500 }
    )
  }
}