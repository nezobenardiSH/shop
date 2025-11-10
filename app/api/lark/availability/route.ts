import { NextRequest, NextResponse } from 'next/server'
import { getCombinedAvailability, getSingleTrainerAvailability } from '@/lib/trainer-availability'
import { loadTrainersConfig } from '@/lib/config-loader'

export async function GET(request: NextRequest) {
  try {
    // Read trainers config dynamically to pick up changes without restart
    // Uses config/local.json if available, otherwise falls back to config/trainers.json
    const trainersConfig = await loadTrainersConfig()

    const searchParams = request.nextUrl.searchParams
    const trainerName = searchParams.get('trainerName')
    const merchantState = searchParams.get('merchantState') // For location-based filtering

    // Start from midnight of current day in Singapore timezone
    const now = new Date()
    const singaporeNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Singapore"}))

    const startDate = new Date(`${singaporeNow.getFullYear()}-${String(singaporeNow.getMonth() + 1).padStart(2, '0')}-${String(singaporeNow.getDate()).padStart(2, '0')}T00:00:00+08:00`)

    const endDateSingapore = new Date(singaporeNow)
    endDateSingapore.setDate(endDateSingapore.getDate() + 14)
    const endDate = new Date(`${endDateSingapore.getFullYear()}-${String(endDateSingapore.getMonth() + 1).padStart(2, '0')}-${String(endDateSingapore.getDate()).padStart(2, '0')}T23:59:59+08:00`)

    let availability
    let mode = 'combined'

    // If trainerName is provided, get single trainer availability
    if (trainerName) {
      console.log(`📅 Fetching availability for single trainer: ${trainerName}`)
      availability = await getSingleTrainerAvailability(trainerName, startDate, endDate, merchantState || undefined)
      mode = 'single'
      console.log(`Single trainer availability: ${availability.length} days with slots`)

      // Debug: Log first 3 days of availability
      if (availability.length > 0) {
        console.log('📊 First 3 days of availability:')
        availability.slice(0, 3).forEach(day => {
          console.log(`  ${day.date}: ${day.slots.length} slots`)
          day.slots.forEach(slot => {
            console.log(`    ${slot.start}-${slot.end}: available=${slot.available}, trainers=${slot.availableTrainers?.join(',')}`)
          })
        })
      }
    } else {
      // Otherwise get combined availability from all trainers
      console.log('📅 Fetching combined availability from all trainers')
      availability = await getCombinedAvailability(startDate, endDate, merchantState || undefined)
      console.log(`Combined availability: ${availability.length} days with slots`)

      // Debug: Log first 3 days of availability
      if (availability.length > 0) {
        console.log('📊 First 3 days of availability:')
        availability.slice(0, 3).forEach(day => {
          console.log(`  ${day.date}: ${day.slots.length} slots`)
          day.slots.forEach(slot => {
            console.log(`    ${slot.start}-${slot.end}: available=${slot.available}, trainers=${slot.availableTrainers?.join(',')}`)
          })
        })
      }
    }

    // Filter trainers list based on merchantState if provided
    let trainersToShow = trainersConfig.trainers.filter((t: any) => t.email && t.name !== 'Nasi Lemak')

    if (merchantState) {
      // Apply location filtering to the trainers list
      const { getLocationCategoryFromState } = await import('@/lib/location-matcher')
      const locationCategory = getLocationCategoryFromState(merchantState)
      console.log(`📍 Merchant state "${merchantState}" → Location category: "${locationCategory}"`)

      trainersToShow = trainersToShow.filter((trainer: any) => {
        if (!trainer.location || trainer.location.length === 0) {
          // Trainer with no location restrictions can serve anywhere
          return true
        }
        return trainer.location.includes(locationCategory)
      })
      console.log(`📍 Location filtering trainers list: ${trainersConfig.trainers.length} → ${trainersToShow.length} trainers`)
    }

    return NextResponse.json({
      mode,
      trainers: trainersToShow.map((t: any) => ({
        name: t.name,
        email: t.email,
        languages: t.languages,
        location: t.location 
      })),
      availability,
      timezone: trainersConfig.timezone,
      message: mode === 'single'
        ? `Showing availability for ${trainerName}`
        : merchantState
          ? `Showing availability for trainers in: ${merchantState}`
          : 'Showing combined availability from all trainers'
    })
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}