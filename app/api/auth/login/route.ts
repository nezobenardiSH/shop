import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    const merchant = await prisma.merchant.findUnique({
      where: { email }
    })
    
    if (!merchant) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    const valid = await verifyPassword(password, merchant.passwordHash)
    
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    const token = generateToken({ 
      id: merchant.id, 
      email: merchant.email,
      slug: merchant.slug 
    })
    
    return NextResponse.json({ 
      token, 
      merchant: {
        id: merchant.id,
        companyName: merchant.companyName,
        slug: merchant.slug
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
