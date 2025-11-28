import { NextRequest, NextResponse } from 'next/server'
import { getInstallerType, getInternalInstallersAvailability } from '@/lib/installer-availability'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const merchantId = searchParams.get('merchantId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeWeekends = searchParams.get('includeWeekends') === 'true' // For internal users

    if (!merchantId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: merchantId, startDate, endDate' },
        { status: 400 }
      )
    }

    console.log('📅 Installation availability request:', { merchantId, startDate, endDate, includeWeekends })

    // Check if merchant needs internal or external installer
    const installerType = await getInstallerType(merchantId)

    if (installerType === 'external') {
      return NextResponse.json({
        type: 'external',
        message: 'External vendor required. Please submit preferred date and time.',
        availability: []
      })
    }

    // Get availability for internal installers
    const availability = await getInternalInstallersAvailability(startDate, endDate, merchantId, includeWeekends)
    
    return NextResponse.json({
      type: 'internal',
      availability
    })
  } catch (error) {
    console.error('Error fetching installer availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch installer availability' },
      { status: 500 }
    )
  }
}