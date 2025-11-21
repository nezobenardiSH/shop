/**
 * Time Slot Configuration with Date-Based Logic
 *
 * This module manages training time slots that change based on date.
 * Starting December 1, 2025, time slots and session duration change.
 */

export interface TimeSlot {
  start: string;
  end: string;
}

export interface TimeSlotConfig {
  slots: TimeSlot[];
  sessionDurationMinutes: number;
}

/**
 * Get the appropriate time slots for a given date
 *
 * @param date - The date to check (defaults to current date)
 * @returns Time slot configuration including slots and duration
 *
 * Time slot changes:
 * - Before Dec 1, 2025: 4 slots x 60 minutes (10-11am, 12-1pm, 2:30-3:30pm, 5-6pm)
 * - Dec 1, 2025 onwards: 3 slots x 90 minutes (10-11:30am, 2-3:30pm, 4:30-6pm)
 */
export function getTimeSlotConfig(date?: Date): TimeSlotConfig {
  const checkDate = date || new Date();

  // Cutoff date: December 1, 2025 at midnight Singapore time (GMT+8)
  const cutoffDate = new Date('2025-12-01T00:00:00+08:00');

  if (checkDate >= cutoffDate) {
    // New time slots (December 1, 2025 onwards)
    return {
      slots: [
        { start: '10:00', end: '11:30' },  // 10:00 - 11:30 AM
        { start: '14:00', end: '15:30' },  // 2:00 - 3:30 PM
        { start: '16:30', end: '18:00' }   // 4:30 - 6:00 PM
      ],
      sessionDurationMinutes: 90
    };
  } else {
    // Current time slots (before December 1, 2025)
    return {
      slots: [
        { start: '10:00', end: '11:00' },  // 10-11am
        { start: '12:00', end: '13:00' },  // 12-1pm
        { start: '14:30', end: '15:30' },  // 2:30-3:30pm
        { start: '17:00', end: '18:00' }   // 5-6pm
      ],
      sessionDurationMinutes: 60
    };
  }
}

/**
 * Get just the time slots array (for backward compatibility)
 */
export function getTimeSlots(date?: Date): TimeSlot[] {
  return getTimeSlotConfig(date).slots;
}

/**
 * Get the session duration for a given date
 */
export function getSessionDuration(date?: Date): number {
  return getTimeSlotConfig(date).sessionDurationMinutes;
}
