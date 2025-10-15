import { NextRequest, NextResponse } from 'next/server'
import { getCombinedAvailability } from '@/lib/trainer-availability'
import trainersConfig from '@/config/trainers.json'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('mode') || 'combined' // 'combined' or 'single'
    const trainerName = searchParams.get('trainerName')
    const merchantAddress = searchParams.get('merchantAddress') // For location-based filtering

    // Start from midnight of current day in Singapore timezone
    const now = new Date()
    const singaporeNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Singapore"}))

    const startDate = new Date(`${singaporeNow.getFullYear()}-${String(singaporeNow.getMonth() + 1).padStart(2, '0')}-${String(singaporeNow.getDate()).padStart(2, '0')}T00:00:00+08:00`)

    const endDateSingapore = new Date(singaporeNow)
    endDateSingapore.setDate(endDateSingapore.getDate() + 30)
    const endDate = new Date(`${endDateSingapore.getFullYear()}-${String(endDateSingapore.getMonth() + 1).padStart(2, '0')}-${String(endDateSingapore.getDate()).padStart(2, '0')}T23:59:59+08:00`)

    // Get combined availability from all trainers (with optional location filtering)
    const availability = await getCombinedAvailability(startDate, endDate, merchantAddress || undefined)
    
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