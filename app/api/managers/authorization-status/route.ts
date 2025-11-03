import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Get all authorized managers from the database
    const authorizedManagers = await prisma.larkAuthToken.findMany({
      select: {
        userEmail: true,
        userName: true,
        larkUserId: true,
        expiresAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // Transform the data for the frontend
    const managers = authorizedManagers.map(manager => ({
      email: manager.userEmail,
      name: manager.userName || 'Unknown',
      authorized: true,
      expiresAt: manager.expiresAt
    }))
    
    return NextResponse.json({
      managers,
      count: managers.length
    })
  } catch (error) {
    console.error('Failed to fetch manager authorization status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch authorization status' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}