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

    const { type, email } = await request.json()

    if (!type || !email) {
      return NextResponse.json(
        { error: 'Type and email are required' },
        { status: 400 }
      )
    }

    // Find the user in database
    const user = await prisma.larkAuthToken.findUnique({
      where: { userEmail: email }
    })

    if (!user) {
      return NextResponse.json(
        { error: `${type.charAt(0).toUpperCase() + type.slice(1)} not found` },
        { status: 404 }
      )
    }

    // Verify the user type matches
    if (user.userType !== type) {
      return NextResponse.json(
        { error: `User is not a ${type}` },
        { status: 400 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.larkAuthToken.update({
      where: { userEmail: email },
      data: { isActive: false }
    })

    return NextResponse.json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} ${email} removed successfully`
    })

  } catch (error) {
    console.error('Failed to remove user:', error)
    return NextResponse.json(
      { error: 'Failed to remove user' },
      { status: 500 }
    )
  }
}
