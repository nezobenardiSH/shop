import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    
    // Delete the authorization record
    await prisma.larkAuthToken.delete({
      where: { userEmail: email }
    })
    
    console.log(`✅ Revoked authorization for manager: ${email}`)
    
    return NextResponse.json({ 
      success: true,
      message: `Authorization revoked for ${email}`
    })
  } catch (error) {
    console.error('Failed to revoke authorization:', error)
    return NextResponse.json(
      { error: 'Failed to revoke authorization' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}