import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const tokens = await prisma.larkAuthToken.findMany({
      select: {
        userEmail: true,
        userName: true,
        larkUserId: true,
        calendarId: true,
        expiresAt: true,
        scopes: true
      }
    })

    return NextResponse.json({
      count: tokens.length,
      tokens: tokens.map(t => ({
        ...t,
        isExpired: new Date(t.expiresAt) < new Date(),
        hasAccessToken: true, // We don't expose the actual token
        hasRefreshToken: true
      }))
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}