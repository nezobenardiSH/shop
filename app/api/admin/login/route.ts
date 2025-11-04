import { NextRequest, NextResponse } from 'next/server'
import { generateToken } from '@/lib/auth-utils'

const ADMIN_EMAIL = 'product@storehub.com'
const ADMIN_PASSWORD = 'faithhopelove1'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }
    
    // Check credentials
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    // Generate admin token
    const token = generateToken({
      email: ADMIN_EMAIL,
      role: 'admin',
      isAdmin: true
    })
    
    // Set httpOnly cookie
    const response = NextResponse.json({
      success: true,
      email: ADMIN_EMAIL
    })
    
    response.cookies.set('admin-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    })
    
    return response
    
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}

