import { NextRequest, NextResponse } from 'next/server'
import { getCombinedAvailability } from '@/lib/trainer-availability'
import trainersConfig from '@/config/trainers.json'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('mode') || 'combined' // 'combined' or 'single'
    const trainerName = searchParams.get('trainerName')
    
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 30)

    // Get combined availability from all trainers
    const availability = await getCombinedAvailability(startDate, endDate)
    
    console.log(`Combined availability: ${availability.length} days with slots`)

    return NextResponse.json({
      mode: 'combined',
      trainers: trainersConfig.trainers
        .filter(t => t.email && t.name !== 'Nasi Lemak')
        .map(t => ({ name: t.name, email: t.email })),
      availability,
      timezone: trainersConfig.timezone,
      message: 'Showing combined availability from all trainers'
    })
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}