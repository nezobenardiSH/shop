import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

// Helper function to verify admin token
function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get('admin-token')?.value
  
  if (!token) {
    return null
  }
  
  const decoded = verifyToken(token)
  if (!decoded || !decoded.isAdmin) {
    return null
  }
  
  return decoded
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminToken(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    
    // Revoke authorization from database
    try {
      await prisma.larkAuthToken.delete({
        where: { userEmail: email }
      })
      
      return NextResponse.json({
        success: true,
        message: `Authorization revoked for ${email}`
      })
    } catch (error) {
      return NextResponse.json(
        { error: 'User authorization not found' },
        { status: 404 }
      )
    }
    
  } catch (error) {
    console.error('Failed to revoke authorization:', error)
    return NextResponse.json(
      { error: 'Failed to revoke authorization' },
      { status: 500 }
    )
  }
}

