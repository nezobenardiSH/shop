import { NextRequest, NextResponse } from 'next/server'
import { getCombinedAvailability } from '@/lib/trainer-availability'
import trainersConfig from '@/config/trainers.json'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('mode') || 'combined' // 'combined' or 'single'
    const trainerName = searchParams.get('trainerName')
    
    // Start from midnight of current day to include events that started earlier today
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0) // Set to midnight

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 30)
    endDate.setHours(23, 59, 59, 999) // Set to end of day

    // Get combined availability from all trainers
    const availability = await getCombinedAvailability(startDate, endDate)
    
    console.log(`Combined availability: ${availability.length} days with slots`)

    return NextResponse.json({
      mode: 'combined',
      trainers: trainersConfig.trainers
        .filter(t => t.email && t.name !== 'Nasi Lemak')
        .map(t => ({ name: t.name, email: t.email, languages: t.languages })),
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