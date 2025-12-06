import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const admins = await prisma.notificationAdmin.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        larkUserId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      admins: admins.map(admin => ({
        email: admin.email,
        name: admin.name,
        larkUserId: admin.larkUserId,
        authorized: true,
        createdAt: admin.createdAt
      }))
    })
  } catch (error) {
    console.error('Failed to fetch notification admins:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification admins' },
      { status: 500 }
    )
  }
}
