import { larkService } from './lark'
import { loadTrainersConfig } from './config-loader'
import { getTimeSlots } from './time-slot-config'

/**
 * Create a date in Singapore timezone
 * This ensures all date comparisons use Singapore timezone consistently
 */
function createLocalDate(dateStr: string, timeStr: string): Date {
  // Create date in Singapore timezone (+08:00)
  return new Date(`${dateStr}T${timeStr}:00+08:00`)
}

export interface TimeSlot {
  start: string
  end: string
  available: boolean
  availableTrainers?: string[]
  availableLanguages?: string[]
  availableLocations?: string[]
}

export interface DayAvailability {
  date: string
  slots: TimeSlot[]
}

export interface TrainerAvailability {
  trainerName: string
  trainerEmail: string
  busySlots: Array<{ start: string; end: string }>
}

/**
 * Get combined availability from all trainers
 * Shows a slot as available if ANY authorized trainer (with OAuth token) is free
 * Trainers without OAuth tokens are excluded from availability calculations
 * @param startDate - Start date for availability check
 * @param endDate - End date for availability check
 * @param merchantState - Optional merchant state for location-based filtering
 */
export async function getCombinedAvailability(
  startDate: Date,
  endDate: Date,
  merchantState?: string
): Promise<DayAvailability[]> {
  console.log('Getting combined availability for all trainers...')
  if (merchantState) {
    console.log('Filtering by merchant state:', merchantState)
  }

  // Read trainers config dynamically to pick up changes without restart
  const trainersConfig = await loadTrainersConfig()

  // Get all configured trainers
  let trainers = trainersConfig.trainers.filter((t: any) =>
    t.email && t.name !== 'Nasi Lemak' // Exclude merchant entries
  )

  // Filter by location if merchant state is provided
  // Note: merchantState is only passed for ONSITE training
  // For REMOTE training, merchantState will be undefined and no location filtering occurs
  if (merchantState) {
    const { getLocationCategoryFromState } = await import('./location-matcher')
    const locationCategory = getLocationCategoryFromState(merchantState)
    console.log(`📍 Onsite training - Merchant state "${merchantState}" → Location category: "${locationCategory}"`)

    // If location category cannot be determined, no trainers can be assigned
    if (!locationCategory) {
      console.log('❌ Location category could not be determined from state - no trainers available for onsite training')
      return [] // Return empty availability - no trainers can serve unknown locations
    }

    const filteredTrainers = trainers.filter((trainer: any) => {
      if (!trainer.location || trainer.location.length === 0) {
        // Trainer with no location restrictions can serve anywhere
        return true
      }
      return trainer.location.includes(locationCategory)
    })
    console.log(`Location filtering: ${trainers.length} trainers → ${filteredTrainers.length} trainers`)
    
    if (filteredTrainers.length === 0 && locationCategory === 'Outside of Klang Valley') {
      console.warn('⚠️ No trainers assigned to "Outside of Klang Valley" category')
      console.warn('   Affected areas include: Melaka, Perak, Terengganu, Pahang, Negeri Sembilan, etc.')
      console.warn('   Merchants in these areas cannot book onsite training')
    }
    
    console.log('Trainers after location filter:', filteredTrainers.map((t: any) => t.name))
    trainers = filteredTrainers
  } else {
    console.log('📍 Remote training or no location provided - showing all trainers')
  }
  
  console.log(`Checking availability for ${trainers.length} trainers:`, trainers.map((t: any) => t.name))
  
  // Fetch availability for all trainers in parallel
  const trainerAvailabilities: Map<string, TrainerAvailability> = new Map()
  
  // Process all trainers in parallel for better performance
  const availabilityPromises = trainers.map(async (trainer: any) => {
    try {
      // First check if trainer has OAuth token
      const { larkOAuthService } = await import('./lark-oauth-service')
      const hasToken = await larkOAuthService.isUserAuthorized(trainer.email)

      if (!hasToken) {
        console.log(`⚠️ ${trainer.name} has no OAuth token - SKIPPING (not available for booking)`)
        // If trainer hasn't authorized, they cannot be booked, so skip them
        return null
      }
      
      // Extract busy times for this trainer from actual calendar events only
      // Note: We should NOT convert unavailable slots to busy times here
      // The lark service already provides the actual busy times from calendar events
      const busySlots: Array<{ start: string; end: string }> = []

      // Get the actual busy times directly from the lark service
      // instead of converting TIME_SLOTS availability
      try {
        const { larkService } = await import('./lark')

        // Get raw busy times from calendar events only
        const rawBusyTimes = await larkService.getRawBusyTimes(
          trainer.email,
          startDate,
          endDate
        )

        rawBusyTimes.forEach((busy: {start_time: string; end_time: string}) => {
          busySlots.push({
            start: busy.start_time,
            end: busy.end_time
          })
        })

        console.log(`${trainer.name}: Found ${busySlots.length} busy periods (including recurring events)`)
      } catch (error) {
        console.error(`Failed to get raw busy times for ${trainer.name}:`, error)
        // Fallback to empty busy slots (assume available)
      }
      
      return {
        trainerName: trainer.name,
        trainerEmail: trainer.email,
        busySlots
      }
    } catch (error) {
      console.error(`Failed to get availability for ${trainer.name}:`, error)
      // If we can't get availability, assume trainer is available
      return {
        trainerName: trainer.name,
        trainerEmail: trainer.email,
        busySlots: []
      }
    }
  })

  // Wait for all trainer availability checks to complete
  console.log(`⏳ Checking availability for ${trainers.length} trainers in parallel...`)
  const results = await Promise.all(availabilityPromises)
  
  // Add results to the map (filtering out null results from unauthorized trainers)
  results.forEach(result => {
    if (result) {
      trainerAvailabilities.set(result.trainerName, result)
    }
  })
  
  console.log(`✅ Completed availability check for ${trainerAvailabilities.size} authorized trainers`)

  // Now combine the availabilities
  const combinedAvailability: DayAvailability[] = []

  const current = new Date(startDate)
  while (current <= endDate) {
    const dayOfWeek = current.getDay()

    // Only weekdays (Monday=1 to Friday=5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Extract date components directly from the Date object (which is already in Singapore timezone)
      // Don't use toISOString() as it converts to UTC and may shift the date
      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const day = String(current.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      // Get time slots for this specific date (supports date-based slot changes)
      const TIME_SLOTS = getTimeSlots(current)

      // Create slots based on real trainer availability
      const slots: TimeSlot[] = []

      TIME_SLOTS.forEach((slot: any) => {
        // Create slot times in configured timezone
        const slotStart = createLocalDate(dateStr, slot.start)
        const slotEnd = createLocalDate(dateStr, slot.end)
        
        // Check which trainers are available for this slot
        const availableTrainers: string[] = []
        const availableLanguagesSet = new Set<string>()
        const availableLocationsSet = new Set<string>()
        
        trainerAvailabilities.forEach((trainerInfo, trainerName) => {
          const isBusy = trainerInfo.busySlots.some(busy => {
            const busyStart = new Date(busy.start)
            const busyEnd = new Date(busy.end)
            const overlaps = (slotStart < busyEnd && slotEnd > busyStart)
            
            return overlaps
          })
          
          if (!isBusy) {
            availableTrainers.push(trainerName)

            // Add this trainer's languages and locations to the available sets
            const trainer = trainers.find((t: any) => t.name === trainerName)
            if (trainer) {
              if (trainer.languages) {
                trainer.languages.forEach((lang: any) => availableLanguagesSet.add(lang))
              }
              if (trainer.location) {
                trainer.location.forEach((loc: any) => availableLocationsSet.add(loc))
              }
            }
          }
        })
        
        if (availableTrainers.length === 0) {
          // No trainers available
          slots.push({
            start: slot.start,
            end: slot.end,
            available: false
          })
        } else {
          // Slot is available with real trainer, language, and location data
          const availableLanguages = Array.from(availableLanguagesSet)
          const availableLocations = Array.from(availableLocationsSet)

          slots.push({
            start: slot.start,
            end: slot.end,
            available: true,
            availableTrainers: availableTrainers,
            availableLanguages: availableLanguages,
            availableLocations: availableLocations
          })
        }
      })
      
      combinedAvailability.push({
        date: dateStr,
        slots
      })
    }
    
    current.setDate(current.getDate() + 1)
  }
  
  return combinedAvailability
}

/**
 * Check availability for a specific slot across all trainers
 * Uses the same logic as getCombinedAvailability() for consistency
 * Only considers trainers with OAuth tokens (authorized trainers)
 * @param date - Date string in YYYY-MM-DD format
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @param merchantState - Optional merchant state for location-based filtering (onsite training)
 */
export async function getSlotAvailability(
  date: string,
  startTime: string,
  endTime: string,
  merchantState?: string
): Promise<{ available: boolean; availableTrainers: string[] }> {
  console.log(`\n=== Checking slot availability for ${date} ${startTime}-${endTime} ===`)
  if (merchantState) {
    console.log('Filtering by merchant state:', merchantState)
  }

  // Read trainers config dynamically to pick up changes without restart
  const trainersConfig = await loadTrainersConfig()

  // Get all configured trainers
  let trainers = trainersConfig.trainers.filter((t: any) =>
    t.email && t.name !== 'Nasi Lemak'
  )

  // Filter by location if merchant state is provided
  // Note: merchantState is only passed for ONSITE training
  // For REMOTE training, merchantState will be undefined and no location filtering occurs
  if (merchantState) {
    const { getLocationCategoryFromState } = await import('./location-matcher')
    const locationCategory = getLocationCategoryFromState(merchantState)
    console.log(`📍 Onsite training - Merchant state "${merchantState}" → Location category: "${locationCategory}"`)

    // If location category cannot be determined, no trainers available for onsite training
    if (!locationCategory) {
      console.log('❌ Location category could not be determined - no trainers available for onsite training')
      return { available: false, availableTrainers: [] }
    }

    // Filter trainers by location category
    const filteredTrainers = trainers.filter((trainer: any) => {
      if (!trainer.location || trainer.location.length === 0) {
        // Trainer with no location restrictions can serve anywhere
        return true
      }
      return trainer.location.includes(locationCategory)
    })

    console.log(`Location filtering: ${trainers.length} trainers → ${filteredTrainers.length} trainers`)
    
    if (filteredTrainers.length === 0 && locationCategory === 'Outside of Klang Valley') {
      console.warn('⚠️ No trainers assigned to "Outside of Klang Valley" category')
      console.warn('   Merchant cannot book onsite training in this location')
    }
    
    console.log('Trainers after location filter:', filteredTrainers.map((t: any) => t.name))
    trainers = filteredTrainers
  } else {
    console.log('📍 Remote training or no location provided - showing all trainers')
  }

  const availableTrainers: string[] = []

  // Create slot time range in Singapore timezone
  const slotStart = new Date(`${date}T${startTime}:00+08:00`)
  const slotEnd = new Date(`${date}T${endTime}:00+08:00`)

  console.log(`Slot range: ${slotStart.toISOString()} to ${slotEnd.toISOString()}`)

  for (const trainer of trainers) {
    try {
      // First check if trainer has OAuth token
      const { larkOAuthService } = await import('./lark-oauth-service')
      const hasToken = await larkOAuthService.isUserAuthorized(trainer.email)

      if (!hasToken) {
        console.log(`⚠️ ${trainer.name} has no OAuth token - SKIPPING (not available for booking)`)
        // If trainer hasn't authorized, they cannot be booked, so skip them
        continue
      }

      // Use getRawBusyTimes() - same logic as getCombinedAvailability()
      // This includes FreeBusy + Calendar Events + Recurring Events expansion
      const startDate = new Date(date)
      const endDate = new Date(date)
      endDate.setDate(endDate.getDate() + 1)

      const busyTimes = await larkService.getRawBusyTimes(
        trainer.email,
        startDate,
        endDate
      )

      console.log(`${trainer.name}: ${busyTimes.length} busy periods`)

      // Check if any busy time overlaps with the requested slot
      const isAvailable = !busyTimes.some(busy => {
        const busyStart = new Date(busy.start_time)
        const busyEnd = new Date(busy.end_time)
        const overlaps = (slotStart < busyEnd && slotEnd > busyStart)

        if (overlaps) {
          console.log(`  ❌ ${trainer.name} is BUSY: ${busyStart.toISOString()} to ${busyEnd.toISOString()}`)
        }

        return overlaps
      })

      if (isAvailable) {
        console.log(`  ✅ ${trainer.name} is AVAILABLE`)
        availableTrainers.push(trainer.name)
      }
    } catch (error) {
      console.error(`Error checking ${trainer.name}:`, error)
      // On error, assume available
      availableTrainers.push(trainer.name)
    }
  }

  console.log(`\n📊 Slot availability result: ${availableTrainers.length > 0 ? 'AVAILABLE' : 'NOT AVAILABLE'}`)
  console.log(`Available trainers: ${availableTrainers.join(', ') || 'None'}`)

  return {
    available: availableTrainers.length > 0,
    availableTrainers
  }
}

/**
 * Intelligently assign a trainer based on availability and language requirements
 *
 * Assignment Strategy:
 * 1. Filter trainers by required language(s)
 * 2. Prioritize trainers with fewer language capabilities (specialists)
 * 3. Reserve multilingual trainers for sessions requiring their unique skills
 *
 * Example: For English-only training with John (English) and Vwie (English, Malay, Chinese) available:
 * - Assign John first (specialist)
 * - Reserve Vwie for Malay/Chinese sessions where John cannot serve
 *
 * @param availableTrainers - List of trainer names available for the slot
 * @param requiredLanguages - Languages required for the training session (optional)
 * @returns Assignment result with trainer name and reason
 */
export async function assignTrainer(
  availableTrainers: string[],
  requiredLanguages?: string[]
): Promise<{
  assigned: string;
  reason: string;
}> {
  if (availableTrainers.length === 0) {
    throw new Error('No trainers available for this slot')
  }

  // Get trainer details for all available trainers
  const trainerDetails = await Promise.all(
    availableTrainers.map(async name => ({
      name,
      details: await getTrainerDetails(name)
    }))
  )

  // Step 1: Filter by required languages if specified
  let qualifiedTrainers = trainerDetails
  if (requiredLanguages && requiredLanguages.length > 0) {
    qualifiedTrainers = trainerDetails.filter(({ details }) => {
      // Trainer must speak ALL required languages
      return requiredLanguages.every((reqLang: any) =>
        details.languages?.some((trainerLang: any) =>
          trainerLang.toLowerCase() === reqLang.toLowerCase()
        )
      )
    })

    console.log(`Language filtering: ${trainerDetails.length} trainers → ${qualifiedTrainers.length} trainers`)
    console.log(`Required languages: ${requiredLanguages.join(', ')}`)
    console.log(`Qualified trainers: ${qualifiedTrainers.map(t => t.name).join(', ')}`)

    if (qualifiedTrainers.length === 0) {
      // No trainers match ALL required languages
      // This is a critical issue - we should not assign trainers who don't speak the language
      console.error('❌ No trainers available who speak all required languages:', requiredLanguages.join(', '))
      console.log('Available trainers and their languages:')
      trainerDetails.forEach(({ name, details }) => {
        console.log(`  - ${name}: ${details.languages?.join(', ') || 'No languages specified'}`)
      })
      
      // Return error instead of assigning incompatible trainer
      throw new Error(`No trainers available who speak the required language(s): ${requiredLanguages.join(', ')}`)
    }
  }

  if (qualifiedTrainers.length === 1) {
    // Only one qualified trainer
    const reason = requiredLanguages && requiredLanguages.length > 0
      ? `Only ${qualifiedTrainers[0].name} speaks ${requiredLanguages.join(', ')}`
      : `Only ${qualifiedTrainers[0].name} is available`

    return {
      assigned: qualifiedTrainers[0].name,
      reason
    }
  }

  // Step 2: Prioritize trainers with fewer language capabilities (specialists first)
  // Sort by language count (ascending) - trainers with fewer languages first
  const sortedByLanguageCount = qualifiedTrainers.sort((a, b) => {
    const aLangCount = a.details.languages?.length || 0
    const bLangCount = b.details.languages?.length || 0
    return aLangCount - bLangCount
  })

  // Get the minimum language count
  const minLanguageCount = sortedByLanguageCount[0].details.languages?.length || 0

  // Get all trainers with the minimum language count (specialists)
  const specialists = sortedByLanguageCount.filter(
    t => (t.details.languages?.length || 0) === minLanguageCount
  )

  // Randomly select from specialists to distribute load evenly among them
  const randomIndex = Math.floor(Math.random() * specialists.length)
  const assigned = specialists[randomIndex]

  const languageInfo = requiredLanguages && requiredLanguages.length > 0
    ? ` for ${requiredLanguages.join(', ')} training`
    : ''

  const reason = specialists.length === 1
    ? `${assigned.name} is the specialist (${minLanguageCount} language${minLanguageCount > 1 ? 's' : ''})${languageInfo}, reserving multilingual trainers`
    : `Selected ${assigned.name} from ${specialists.length} specialists (${minLanguageCount} language${minLanguageCount > 1 ? 's' : ''} each)${languageInfo}`

  console.log(`✅ Trainer assignment: ${assigned.name}`)
  console.log(`   Reason: ${reason}`)
  console.log(`   Available: ${qualifiedTrainers.map(t => `${t.name} (${t.details.languages?.length || 0} langs)`).join(', ')}`)

  return {
    assigned: assigned.name,
    reason
  }
}

/**
 * Get availability for a single trainer across multiple days
 * Shows a slot as available only if the specific trainer is free
 * @param trainerName - Name of the trainer
 * @param startDate - Start date for availability check
 * @param endDate - End date for availability check
 * @param merchantState - Optional merchant state for location-based filtering
 */
export async function getSingleTrainerAvailability(
  trainerName: string,
  startDate: Date,
  endDate: Date,
  merchantState?: string
): Promise<DayAvailability[]> {
  console.log(`Getting availability for single trainer: ${trainerName}`)
  if (merchantState) {
    console.log('Filtering by merchant state:', merchantState)
  }

  // Get the specific trainer
  const trainer = await getTrainerDetails(trainerName)

  if (!trainer) {
    console.error(`Trainer ${trainerName} not found`)
    return []
  }

  console.log(`🎯 Trainer details for ${trainerName}:`, {
    name: trainer.name,
    email: trainer.email,
    languages: trainer.languages,
    location: trainer.location,
    hasLanguages: !!trainer.languages,
    languageCount: trainer.languages?.length || 0
  })

  // Check if trainer has OAuth token
  const { larkOAuthService } = await import('./lark-oauth-service')
  const hasToken = await larkOAuthService.isUserAuthorized(trainer.email)

  if (!hasToken) {
    console.log(`⚠️ ${trainer.name} has no OAuth token - cannot fetch availability`)
    return []
  }

  // Get busy times for this trainer
  const busySlots: Array<{ start: string; end: string }> = []

  try {
    const { larkService } = await import('./lark')
    const rawBusyTimes = await larkService.getRawBusyTimes(
      trainer.email,
      startDate,
      endDate
    )

    rawBusyTimes.forEach((busy: {start_time: string; end_time: string}) => {
      busySlots.push({
        start: busy.start_time,
        end: busy.end_time
      })
    })

    console.log(`${trainer.name}: Found ${busySlots.length} busy periods`)
  } catch (error) {
    console.error(`Failed to get busy times for ${trainer.name}:`, error)
    // Fallback to empty busy slots (assume available)
  }

  // Build availability for each day
  const singleTrainerAvailability: DayAvailability[] = []

  const current = new Date(startDate)
  while (current <= endDate) {
    const dayOfWeek = current.getDay()

    // Only weekdays (Monday=1 to Friday=5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const day = String(current.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      // Get time slots for this specific date (supports date-based slot changes)
      const TIME_SLOTS = getTimeSlots(current)

      const slots: TimeSlot[] = []

      TIME_SLOTS.forEach((slot: any) => {
        const slotStart = createLocalDate(dateStr, slot.start)
        const slotEnd = createLocalDate(dateStr, slot.end)

        // Check if this trainer is busy during this slot
        const isBusy = busySlots.some(busy => {
          const busyStart = new Date(busy.start)
          const busyEnd = new Date(busy.end)
          const overlaps = (slotStart < busyEnd && slotEnd > busyStart)
          return overlaps
        })

        if (!isBusy) {
          const availableSlot = {
            start: slot.start,
            end: slot.end,
            available: true,
            availableTrainers: [trainer.name],
            availableLanguages: trainer.languages || [],
            availableLocations: trainer.location || []
          }
          console.log(`✅ Available slot ${slot.start}-${slot.end}:`, {
            languages: availableSlot.availableLanguages,
            trainerName: trainer.name,
            trainerLanguagesFromConfig: trainer.languages
          })
          slots.push(availableSlot)
        } else {
          slots.push({
            start: slot.start,
            end: slot.end,
            available: false
          })
        }
      })

      singleTrainerAvailability.push({
        date: dateStr,
        slots
      })
    }

    current.setDate(current.getDate() + 1)
  }

  return singleTrainerAvailability
}

/**
 * Get trainer details by name
 */
export async function getTrainerDetails(trainerName: string) {
  // Read trainers config dynamically to pick up changes without restart
  const trainersConfig = await loadTrainersConfig()

  // First try exact match
  let trainer = trainersConfig.trainers.find((t: any) =>
    t.name.toLowerCase() === trainerName.toLowerCase()
  )

  // If no exact match, try partial match (e.g., "Nezo" matches "Nezo Benardi")
  if (!trainer) {
    trainer = trainersConfig.trainers.find((t: any) =>
      t.name.toLowerCase().includes(trainerName.toLowerCase()) ||
      trainerName.toLowerCase().includes(t.name.toLowerCase())
    )
  }

  if (!trainer) {
    // Return default trainer if not found - use first trainer as fallback
    const defaultTrainer = trainersConfig.trainers[0]
    return {
      name: trainerName,
      email: defaultTrainer?.email || 'nezo.benardi@storehub.com',
      calendarId: trainersConfig.defaultCalendarId,
      languages: defaultTrainer?.languages || [],
      location: defaultTrainer?.location || []
    }
  }
  
  // Return the found trainer with all properties
  return {
    name: trainer.name,
    email: trainer.email,
    calendarId: trainer.calendarId || trainersConfig.defaultCalendarId,
    languages: trainer.languages || [],
    location: trainer.location || []
  }
}