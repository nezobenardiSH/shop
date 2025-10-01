import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncToSalesforce } from '@/lib/salesforce'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const merchant = await prisma.merchant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        companyName: true,
        email: true,
        address: true,
        phone: true,
        onboardingStage: true,
        installationDate: true,
        trainingDate: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(merchant)
  } catch (error) {
    console.error('Error fetching merchant:', error)
    return NextResponse.json(
      { error: 'Failed to fetch merchant' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const data = await request.json()

    // Prepare update data - only include fields that are provided
    const updateData: any = {}

    if (data.address !== undefined) updateData.address = data.address
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.installationDate !== undefined) {
      updateData.installationDate = data.installationDate ? new Date(data.installationDate) : null
    }
    if (data.trainingDate !== undefined) {
      updateData.trainingDate = data.trainingDate ? new Date(data.trainingDate) : null
    }
    if (data.onboardingStage !== undefined) updateData.onboardingStage = data.onboardingStage

    // Update in database using slug
    const merchant = await prisma.merchant.update({
      where: { slug },
      data: updateData,
      select: {
        id: true,
        slug: true,
        companyName: true,
        email: true,
        address: true,
        phone: true,
        onboardingStage: true,
        installationDate: true,
        trainingDate: true,
        updatedAt: true
      }
    })

    // Sync to Salesforce (fire and forget)
    syncToSalesforce(merchant).catch(console.error)

    return NextResponse.json(merchant)
  } catch (error) {
    console.error('Error updating merchant:', error)
    return NextResponse.json(
      { error: 'Update failed' },
      { status: 500 }
    )
  }
}
