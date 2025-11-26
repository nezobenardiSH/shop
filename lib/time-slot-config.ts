/**
 * Time Slot Configuration with Date-Based Logic
 *
 * This module manages training time slots that change based on date.
 * Starting December 1, 2025, time slots and session duration change.
 *
 * Feature-based slot variations (Dec 2025+):
 * - Normal merchants: 4:00 PM - 5:30 PM (90 min)
 * - Special merchants (Membership, Engage, Composite Inventory, Superbundle): 4:00 PM - 6:00 PM (120 min)
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
 * - Dec 1, 2025 onwards: 3 slots x 90 minutes (10-11:30am, 1:30-3pm, 4-5:30pm)
 *   - Special merchants get 4-6pm instead of 4-5:30pm
 */
export function getTimeSlotConfig(date?: Date): TimeSlotConfig {
  const checkDate = date || new Date();

  // Cutoff date: December 1, 2025 at midnight Singapore time (GMT+8)
  const cutoffDate = new Date('2025-12-01T00:00:00+08:00');

  if (checkDate >= cutoffDate) {
    // New time slots (December 1, 2025 onwards)
    // Note: 4-5:30pm is for normal merchants, special merchants get 4-6pm (handled in DatePickerModal)
    return {
      slots: [
        { start: '10:00', end: '11:30' },  // 10:00 - 11:30 AM
        { start: '13:30', end: '15:00' },  // 1:30 - 3:00 PM
        { start: '16:00', end: '17:30' }   // 4:00 - 5:30 PM (normal merchants)
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

/**
 * Features that require the extended 4-6pm training slot
 * These features need more training time and are only available in the last slot
 */
const EXTENDED_TRAINING_FEATURES = [
  'membership',
  'engage',
  'composite', // Matches both "Composite" and "Composite Inventory"
  'superbundle'
];

/**
 * Check if merchant has features that require the extended training slot (4-6pm only)
 *
 * @param requiredFeatures - The Required_Features_by_Merchant__c field value
 * @returns true if merchant requires extended training slot
 */
export function requiresExtendedTrainingSlot(requiredFeatures?: string | null): boolean {
  if (!requiredFeatures) return false;

  const featuresLower = requiredFeatures.toLowerCase();
  return EXTENDED_TRAINING_FEATURES.some(feature => featuresLower.includes(feature));
}

/**
 * The extended training slot time (4:00 PM - 6:00 PM)
 * Used for merchants with Membership, Engage, Composite Inventory, or Superbundle
 */
export const EXTENDED_TRAINING_SLOT = { start: '16:00', end: '18:00' };
