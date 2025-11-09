import { NextRequest, NextResponse } from 'next/server'
import { detectServiceType, shouldFilterByLocation } from '@/lib/service-type-detector'
import { getSlotAvailability } from '@/lib/trainer-availability'
import { getLocationCategory } from '@/lib/location-matcher'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      merchantAddress,
      onboardingServicesBought,
      date,
      startTime,
      endTime
    } = body

    console.log('🔍 DEBUG: Testing booking flow')
    console.log('================================')
    
    // Step 1: Detect service type
    const serviceType = detectServiceType(onboardingServicesBought)
    console.log(`1. Service Type Detection:`)
    console.log(`   Input: "${onboardingServicesBought}"`)
    console.log(`   Detected: ${serviceType}`)
    
    // Step 2: Should filter by location?
    const filterByLocation = shouldFilterByLocation(serviceType, 'training')
    console.log(`\n2. Location Filtering:`)
    console.log(`   Should filter: ${filterByLocation}`)
    
    // Step 3: Get location category
    const locationCategory = getLocationCategory(merchantAddress)
    console.log(`\n3. Location Category:`)
    console.log(`   Merchant Address: "${merchantAddress}"`)
    console.log(`   Category: ${locationCategory}`)
    
    // Step 4: Get available trainers
    const addressForFiltering = filterByLocation ? merchantAddress : undefined
    console.log(`\n4. Address for Filtering:`)
    console.log(`   ${addressForFiltering || 'NONE (remote training)'}`)
    
    const slotResult = await getSlotAvailability(
      date,
      startTime,
      endTime,
      addressForFiltering
    )
    
    console.log(`\n5. Available Trainers:`)
    console.log(`   Count: ${slotResult.availableTrainers.length}`)
    console.log(`   Trainers: ${slotResult.availableTrainers.join(', ')}`)
    
    return NextResponse.json({
      serviceType,
      filterByLocation,
      locationCategory,
      addressForFiltering,
      availableTrainers: slotResult.availableTrainers,
      available: slotResult.available
    })
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}