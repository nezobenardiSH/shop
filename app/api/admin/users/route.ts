import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import trainersConfig from '@/config/trainers.json'
import installersConfig from '@/config/installers.json'

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

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminToken(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get all authorized users from database
    const allAuthorizedUsers = await prisma.larkAuthToken.findMany({
      select: {
        userEmail: true,
        userName: true,
        larkUserId: true,
        userType: true,
        expiresAt: true,
        calendarId: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        userType: 'asc'
      }
    })
    
    // Get configured trainers
    const configuredTrainers = trainersConfig.trainers.map(trainer => ({
      email: trainer.email,
      name: trainer.name,
      type: 'trainer' as const,
      location: trainer.location,
      languages: trainer.languages,
      inConfig: true,
      authorized: allAuthorizedUsers.some(
        u => u.userEmail === trainer.email && (u.userType === 'trainer' || !u.userType)
      ),
      authInfo: allAuthorizedUsers.find(
        u => u.userEmail === trainer.email && (u.userType === 'trainer' || !u.userType)
      )
    }))
    
    // Get configured installers from all locations
    const configuredInstallers: any[] = []
    for (const location of ['klangValley', 'penang', 'johorBahru']) {
      const locationConfig = (installersConfig as any)[location]
      if (locationConfig && locationConfig.installers) {
        locationConfig.installers.forEach((installer: any) => {
          if (installer.email && installer.isActive) {
            configuredInstallers.push({
              email: installer.email,
              name: installer.name,
              type: 'installer' as const,
              location: location,
              inConfig: true,
              authorized: allAuthorizedUsers.some(
                u => u.userEmail === installer.email && u.userType === 'installer'
              ),
              authInfo: allAuthorizedUsers.find(
                u => u.userEmail === installer.email && u.userType === 'installer'
              )
            })
          }
        })
      }
    }
    
    // Get managers (only from database, no config file)
    const managers = allAuthorizedUsers
      .filter(u => u.userType === 'manager')
      .map(manager => ({
        email: manager.userEmail,
        name: manager.userName || 'Unknown',
        type: 'manager' as const,
        inConfig: false,
        authorized: true,
        authInfo: manager
      }))
    
    return NextResponse.json({
      trainers: configuredTrainers,
      installers: configuredInstallers,
      managers: managers,
      summary: {
        totalTrainers: configuredTrainers.length,
        authorizedTrainers: configuredTrainers.filter(t => t.authorized).length,
        totalInstallers: configuredInstallers.length,
        authorizedInstallers: configuredInstallers.filter(i => i.authorized).length,
        totalManagers: managers.length,
        authorizedManagers: managers.length
      }
    })
    
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

