import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    // Get the user name from the token (stored during login)
    const userName = decoded.userName || decoded.trainerName || 'User'
    
    return NextResponse.json({
      success: true,
      user: {
        name: userName,
        merchantId: decoded.merchantId,
        trainerId: decoded.trainerId,
        trainerName: decoded.trainerName
      }
    })
    
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Authentication check failed' },
      { status: 500 }
    )
  }
}