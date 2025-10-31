import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    // For managers, we check based on email from a session/cookie
    // You might want to implement a proper session management here
    const cookieStore = cookies()
    const managerEmail = cookieStore.get('manager_email')?.value
    
    if (!managerEmail) {
      return NextResponse.json({
        isAuthorized: false,
        message: 'No manager session found'
      })
    }
    
    // Check if this manager has authorized
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
    try {
      const authToken = await prisma.larkAuthToken.findUnique({
        where: { userEmail: managerEmail },
        select: {
          userEmail: true,
          userName: true,
          larkUserId: true,
          expiresAt: true
        }
      })
      
      if (authToken && authToken.expiresAt > new Date()) {
        return NextResponse.json({
          isAuthorized: true,
          userInfo: {
            email: authToken.userEmail,
            name: authToken.userName
          }
        })
      }
      
      return NextResponse.json({
        isAuthorized: false,
        message: 'Authorization expired or not found'
      })
    } finally {
      await prisma.$disconnect()
    }
  } catch (error) {
    console.error('Failed to check manager authorization:', error)
    return NextResponse.json(
      { 
        isAuthorized: false,
        error: 'Failed to check authorization status' 
      },
      { status: 500 }
    )
  }
}