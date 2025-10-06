import { larkService } from './lark'
import trainersConfig from '@/config/trainers.json'

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
      const availability = await larkService.getAvailableSlots(
        trainer.email,
        startDate,
        endDate
      )
      
      // Extract busy times for this trainer
      const busySlots: Array<{ start: string; end: string }> = []
      availability.forEach(day => {
        day.slots.forEach(slot => {
          if (!slot.available) {
            busySlots.push({
              start: `${day.date}T${slot.start}:00`,
              end: `${day.date}T${slot.end}:00`
            })
          }
        })
      })
      
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
    { start: '13:00', end: '15:00' },
    { start: '15:00', end: '17:00' },
    { start: '16:00', end: '18:00' }
  ]
  
  const current = new Date(startDate)
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    
    // Only weekdays
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = current.toISOString().split('T')[0]
      
      // For simplicity in testing, let's create mock slots with different languages
      const slots: TimeSlot[] = []
      
      TIME_SLOTS.forEach(slot => {
        const slotStart = new Date(`${dateStr}T${slot.start}:00`)
        const slotEnd = new Date(`${dateStr}T${slot.end}:00`)
        
        // Check which trainers are available for this slot
        const availableTrainers: string[] = []
        
        trainerAvailabilities.forEach((trainerInfo, trainerName) => {
          const isBusy = trainerInfo.busySlots.some(busy => {
            const busyStart = new Date(busy.start)
            const busyEnd = new Date(busy.end)
            return (slotStart < busyEnd && slotEnd > busyStart)
          })
          
          if (!isBusy) {
            availableTrainers.push(trainerName)
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
          // Create mock slots with different language combinations for testing
          // This simulates having multiple trainers with different language capabilities
          if (slot.start === '09:00' || slot.start === '13:00') {
            // Some slots have only Chinese
            slots.push({
              start: slot.start,
              end: slot.end,
              available: true,
              availableTrainers: [availableTrainers[0] || 'Trainer A'],
              availableLanguages: ['中文']
            })
          } else if (slot.start === '11:00') {
            // Some slots have English and Bahasa Malaysia
            slots.push({
              start: slot.start,
              end: slot.end,
              available: true,
              availableTrainers: [availableTrainers[0] || 'Trainer B'],
              availableLanguages: ['English', 'Bahasa Malaysia']
            })
          } else {
            // Most slots have all languages
            slots.push({
              start: slot.start,
              end: slot.end,
              available: true,
              availableTrainers: availableTrainers,
              availableLanguages: ['中文', 'Bahasa Malaysia', 'English']
            })
          }
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