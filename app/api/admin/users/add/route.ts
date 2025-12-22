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

    const { type, email, name, location, languages } = await request.json()

    if (!type || !email || !name) {
      return NextResponse.json(
        { error: 'Type, email, and name are required' },
        { status: 400 }
      )
    }

    // Check if user already exists in database
    const existingUser = await prisma.larkAuthToken.findUnique({
      where: { userEmail: email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: `${type.charAt(0).toUpperCase() + type.slice(1)} already exists` },
        { status: 400 }
      )
    }

    if (type === 'trainer') {
      // Create trainer entry in database (without OAuth tokens - they'll authorize later)
      const languagesArray = languages || ['English']
      const locationArray = location ? [location] : ['Within Klang Valley']

      await prisma.larkAuthToken.create({
        data: {
          userEmail: email,
          userName: name,
          userType: 'trainer',
          languages: JSON.stringify(languagesArray),
          location: JSON.stringify(locationArray),
          isActive: true,
          // OAuth fields are null until trainer authorizes
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          calendarId: null
        }
      })

      return NextResponse.json({
        success: true,
        message: `Trainer ${name} added successfully. They need to authorize via Lark to be available for booking.`
      })

    } else if (type === 'installer') {
      // Validate location
      const validLocations = ['Within Klang Valley', 'Penang', 'Johor Bahru']
      const installerLocation = location || 'Within Klang Valley'

      if (!validLocations.includes(installerLocation)) {
        return NextResponse.json(
          { error: 'Invalid location. Must be Within Klang Valley, Penang, or Johor Bahru' },
          { status: 400 }
        )
      }

      // Create installer entry in database
      await prisma.larkAuthToken.create({
        data: {
          userEmail: email,
          userName: name,
          userType: 'installer',
          location: JSON.stringify([installerLocation]),
          isActive: true,
          // OAuth fields are null until installer authorizes
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          calendarId: null,
          languages: null,
          scopes: null
        }
      })

      return NextResponse.json({
        success: true,
        message: `Installer ${name} added successfully. They need to authorize via Lark to be available for booking.`
      })

    } else {
      return NextResponse.json(
        { error: 'Invalid user type. Only trainers and installers can be added.' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Failed to add user:', error)
    return NextResponse.json(
      { error: 'Failed to add user' },
      { status: 500 }
    )
  }
}
