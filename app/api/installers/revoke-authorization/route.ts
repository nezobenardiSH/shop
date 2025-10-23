import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'

export async function POST(request: NextRequest) {
  try {
    // Get email from request body or query
    const body = await request.json().catch(() => ({}))
    const email = body.email || request.nextUrl.searchParams.get('email')
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    
    // Revoke the authorization
    await larkOAuthService.revokeAuthorization(email)
    
    // Also clear from config file
    try {
      const { updateInstallerLarkIds } = await import('@/lib/update-config-with-lark-ids')
      await updateInstallerLarkIds(email, '', '') // Clear the IDs
    } catch (error) {
      console.error('Failed to clear installer config:', error)
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Authorization revoked successfully' 
    })
    
  } catch (error) {
    console.error('Error revoking installer authorization:', error)
    return NextResponse.json(
      { error: 'Failed to revoke authorization' },
      { status: 500 }
    )
  }
}