import { larkService } from './lark'
import trainersConfig from '@/config/trainers.json'

/**
 * Create a date in the local timezone
 * This ensures all date comparisons use the server's local timezone
 */
function createLocalDate(dateStr: string, timeStr: string): Date {
  // Parse the date components
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  
  // Create date in local timezone (month is 0-indexed in JS)
  return new Date(year, month - 1, day, hour, minute, 0)
}

export interface TimeSlot {
  start: string
  end: string
  available: boolean
  availableTrainers?: string[]
  availableLanguages?: string[]
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
 */
export async function getCombinedAvailability(
  startDate: Date,
  endDate: Date
): Promise<DayAvailability[]> {
  console.log('Getting combined availability for all trainers...')
  
  // Get all configured trainers
  const trainers = trainersConfig.trainers.filter(t => 
    t.email && t.name !== 'Nasi Lemak' // Exclude merchant entries
  )
  
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

        // SPECIAL CASE: Add Nezo's daily lunch meeting (12:30-1:30pm Singapore time)
        // This handles the recurring lunch meeting that isn't being detected properly
        if (trainer.email === 'nezo.benardi@storehub.com') {
          const currentDate = new Date(startDate)
          const endDateCheck = new Date(endDate)

          while (currentDate <= endDateCheck) {
            // Skip weekends (Saturday = 6, Sunday = 0)
            const dayOfWeek = currentDate.getDay()
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              // Add lunch meeting 12:30-1:30pm Singapore time (04:30-05:30 UTC)
              const lunchStart = new Date(currentDate)
              lunchStart.setUTCHours(4, 30, 0, 0) // 12:30pm Singapore = 04:30 UTC

              const lunchEnd = new Date(currentDate)
              lunchEnd.setUTCHours(5, 30, 0, 0) // 1:30pm Singapore = 05:30 UTC

              busySlots.push({
                start: lunchStart.toISOString(),
                end: lunchEnd.toISOString()
              })
            }
            currentDate.setDate(currentDate.getDate() + 1)
          }
        }

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
    { start: '09:00', end: '11:00' },
    { start: '11:00', end: '13:00' },
    { start: '14:00', end: '16:00' },
    { start: '16:00', end: '18:00' }
  ]
  
  const current = new Date(startDate)
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    
    // Only weekdays
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = current.toISOString().split('T')[0]
      
      // Create slots based on real trainer availability
      const slots: TimeSlot[] = []
      
      TIME_SLOTS.forEach(slot => {
        // Create slot times in configured timezone
        const slotStart = createLocalDate(dateStr, slot.start)
        const slotEnd = createLocalDate(dateStr, slot.end)
        
        // Check which trainers are available for this slot
        const availableTrainers: string[] = []
        const availableLanguagesSet = new Set<string>()
        
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
            
            // Add this trainer's languages to the available languages
            const trainer = trainers.find(t => t.name === trainerName)
            if (trainer && trainer.languages) {
              trainer.languages.forEach(lang => availableLanguagesSet.add(lang))
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
          // Slot is available with real trainer and language data
          const availableLanguages = Array.from(availableLanguagesSet)
          
          slots.push({
            start: slot.start,
            end: slot.end,
            available: true,
            availableTrainers: availableTrainers,
            availableLanguages: availableLanguages
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
 */
export async function getSlotAvailability(
  date: string,
  startTime: string,
  endTime: string
): Promise<{ available: boolean; availableTrainers: string[] }> {
  const trainers = trainersConfig.trainers.filter(t => 
    t.email && t.name !== 'Nasi Lemak'
  )
  
  const availableTrainers: string[] = []
  
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
      
      const startDate = new Date(date)
      const endDate = new Date(date)
      endDate.setDate(endDate.getDate() + 1)
      
      const availability = await larkService.getAvailableSlots(
        trainer.email,
        startDate,
        endDate
      )
      
      // Check if this specific slot is available
      const dayAvailability = availability.find(d => d.date === date)
      if (dayAvailability) {
        const slot = dayAvailability.slots.find(s => 
          s.start === startTime && s.end === endTime
        )
        if (slot?.available) {
          availableTrainers.push(trainer.name)
        }
      }
    } catch (error) {
      console.error(`Error checking ${trainer.name}:`, error)
      // On error, assume available
      availableTrainers.push(trainer.name)
    }
  }
  
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