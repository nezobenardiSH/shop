import { larkService } from './lark'
import trainersConfig from '@/config/trainers.json'

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
 * Shows a slot as available if ANY trainer is free
 * @param startDate - Start date for availability check
 * @param endDate - End date for availability check
 * @param merchantAddress - Optional merchant address for location-based filtering
 */
export async function getCombinedAvailability(
  startDate: Date,
  endDate: Date,
  merchantAddress?: string
): Promise<DayAvailability[]> {
  console.log('Getting combined availability for all trainers...')
  if (merchantAddress) {
    console.log('Filtering by merchant address:', merchantAddress)
  }

  // Get all configured trainers
  let trainers = trainersConfig.trainers.filter(t =>
    t.email && t.name !== 'Nasi Lemak' // Exclude merchant entries
  )

  // Filter by location if merchant address is provided
  if (merchantAddress) {
    const { filterTrainersByLocation } = await import('./location-matcher')
    const filteredTrainers = filterTrainersByLocation(trainers, merchantAddress)
    console.log(`Location filtering: ${trainers.length} trainers → ${filteredTrainers.length} trainers`)
    console.log('Trainers after location filter:', filteredTrainers.map(t => t.name))
    trainers = filteredTrainers
  }
  
  console.log(`Checking availability for ${trainers.length} trainers:`, trainers.map(t => t.name))
  
  // Fetch availability for each trainer
  const trainerAvailabilities: Map<string, TrainerAvailability> = new Map()
  
  for (const trainer of trainers) {
    try {
      // First check if trainer has OAuth token
      const { larkOAuthService } = await import('./lark-oauth-service')
      const hasToken = await larkOAuthService.isUserAuthorized(trainer.email)
      
      if (!hasToken) {
        console.log(`⚠️ ${trainer.name} has no OAuth token - assuming available`)
        // If trainer hasn't authorized, assume they're available
        trainerAvailabilities.set(trainer.name, {
          trainerName: trainer.name,
          trainerEmail: trainer.email,
          busySlots: []
        })
        continue
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
      
      trainerAvailabilities.set(trainer.name, {
        trainerName: trainer.name,
        trainerEmail: trainer.email,
        busySlots
      })
    } catch (error) {
      console.error(`Failed to get availability for ${trainer.name}:`, error)
      // If we can't get availability, assume trainer is available
      trainerAvailabilities.set(trainer.name, {
        trainerName: trainer.name,
        trainerEmail: trainer.email,
        busySlots: []
      })
    }
  }
  
  // Now combine the availabilities
  const combinedAvailability: DayAvailability[] = []
  const TIME_SLOTS = [
    { start: '10:00', end: '11:00' },
    { start: '12:00', end: '13:00' },
    { start: '14:30', end: '15:30' },
    { start: '17:00', end: '18:00' }
  ]
  
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
      
      // Create slots based on real trainer availability
      const slots: TimeSlot[] = []
      
      TIME_SLOTS.forEach(slot => {
        // Create slot times in configured timezone
        const slotStart = createLocalDate(dateStr, slot.start)
        const slotEnd = createLocalDate(dateStr, slot.end)
        
        // Check which trainers are available for this slot
        const availableTrainers: string[] = []
        const availableLanguagesSet = new Set<string>()
        const availableLocationsSet = new Set<string>()
        
        trainerAvailabilities.forEach((trainerInfo, trainerName) => {
          // Special detailed logging for Nezo's slots on Oct 14
          if (dateStr === '2025-10-14' && (slot.start === '09:00' || slot.start === '13:00' || slot.start === '16:00') && (trainerName === 'Nezo' || trainerInfo.trainerEmail === 'nezo.benardi@storehub.com')) {
            console.log(`\n🔍 DETAILED CHECK: ${trainerName} for ${slot.start}-${slot.end} on ${dateStr}`)
            console.log(`  Number of busy slots to check: ${trainerInfo.busySlots.length}`)
            console.log(`  Slot time (local): ${slotStart.toISOString()} to ${slotEnd.toISOString()}`)
            
            trainerInfo.busySlots.forEach((busy, idx) => {
              const busyStart = new Date(busy.start)
              const busyEnd = new Date(busy.end)
              const overlaps = (slotStart < busyEnd && slotEnd > busyStart)
              
              // Convert to Singapore time for readability
              const busyStartLocal = busyStart.toLocaleString('en-US', { 
                timeZone: 'Asia/Singapore', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true,
                day: '2-digit',
                month: 'short'
              })
              const busyEndLocal = busyEnd.toLocaleString('en-US', { 
                timeZone: 'Asia/Singapore', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true
              })
              
              console.log(`  Busy period ${idx + 1}: ${busyStartLocal} - ${busyEndLocal}`)
              console.log(`    UTC: ${busy.start} to ${busy.end}`)
              if (overlaps) {
                console.log(`    ⚠️ OVERLAPS WITH 4-6PM! This is blocking the slot.`)
              }
            })
          }
          
          const isBusy = trainerInfo.busySlots.some(busy => {
            const busyStart = new Date(busy.start)
            const busyEnd = new Date(busy.end)
            const overlaps = (slotStart < busyEnd && slotEnd > busyStart)
            
            return overlaps
          })
          
          if (!isBusy) {
            availableTrainers.push(trainerName)

            // Add this trainer's languages and locations to the available sets
            const trainer = trainers.find(t => t.name === trainerName)
            if (trainer) {
              if (trainer.languages) {
                trainer.languages.forEach(lang => availableLanguagesSet.add(lang))
              }
              if (trainer.location) {
                trainer.location.forEach(loc => availableLocationsSet.add(loc))
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
 */
export async function getSlotAvailability(
  date: string,
  startTime: string,
  endTime: string
): Promise<{ available: boolean; availableTrainers: string[] }> {
  console.log(`\n=== Checking slot availability for ${date} ${startTime}-${endTime} ===`)

  const trainers = trainersConfig.trainers.filter(t =>
    t.email && t.name !== 'Nasi Lemak'
  )

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
        console.log(`⚠️ ${trainer.name} has no OAuth token - assuming available`)
        // If trainer hasn't authorized, assume they're available
        availableTrainers.push(trainer.name)
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
 * Intelligently assign a trainer based on availability
 */
export function assignTrainer(availableTrainers: string[]): {
  assigned: string;
  reason: string;
} {
  if (availableTrainers.length === 0) {
    throw new Error('No trainers available for this slot')
  }
  
  if (availableTrainers.length === 1) {
    // Only one trainer available
    return {
      assigned: availableTrainers[0],
      reason: `Only ${availableTrainers[0]} is available`
    }
  }
  
  // Multiple trainers available - random assignment
  const randomIndex = Math.floor(Math.random() * availableTrainers.length)
  const assigned = availableTrainers[randomIndex]
  
  return {
    assigned,
    reason: `Randomly selected from ${availableTrainers.length} available trainers`
  }
}

/**
 * Get trainer details by name
 */
export function getTrainerDetails(trainerName: string) {
  const trainer = trainersConfig.trainers.find(t => 
    t.name.toLowerCase() === trainerName.toLowerCase()
  )
  
  if (!trainer) {
    // Return default trainer if not found
    return {
      name: trainerName,
      email: trainersConfig.defaultTrainer?.email || trainersConfig.trainers[0].email,
      calendarId: trainersConfig.defaultCalendarId
    }
  }
  
  return {
    name: trainer.name,
    email: trainer.email,
    calendarId: trainer.calendarId || trainersConfig.defaultCalendarId
  }
}