import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.notificationAdmin.update({
      where: { email },
      data: { isActive: false }
    })

    console.log(`✅ Notification admin revoked: ${email}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to revoke notification admin:', error)
    return NextResponse.json(
      { error: 'Failed to revoke authorization' },
      { status: 500 }
    )
  }
}
