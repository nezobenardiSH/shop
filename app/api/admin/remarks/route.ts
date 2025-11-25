import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('admin-token')?.value

    if (!adminToken) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const decoded = verifyAdminToken(adminToken)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired admin token' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { merchantId, remark } = body

    if (!merchantId) {
      return NextResponse.json(
        { error: 'merchantId is required' },
        { status: 400 }
      )
    }

    // Upsert the remark (create or update)
    const result = await prisma.merchantRemark.upsert({
      where: { merchantId },
      update: {
        remark: remark || '',
        updatedBy: decoded.email || 'admin'
      },
      create: {
        merchantId,
        remark: remark || '',
        updatedBy: decoded.email || 'admin'
      }
    })

    return NextResponse.json({
      success: true,
      remark: result
    })

  } catch (error) {
    console.error('[Remarks API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save remark',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('admin-token')?.value

    if (!adminToken) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const decoded = verifyAdminToken(adminToken)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired admin token' },
        { status: 401 }
      )
    }

    // Get all remarks
    const remarks = await prisma.merchantRemark.findMany()

    // Convert to map for easy lookup
    const remarksMap: Record<string, string> = {}
    remarks.forEach(r => {
      remarksMap[r.merchantId] = r.remark
    })

    return NextResponse.json({
      success: true,
      remarks: remarksMap
    })

  } catch (error) {
    console.error('[Remarks API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch remarks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
