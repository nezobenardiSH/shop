/**
 * Date utility functions for calculating working days
 * and Singapore timezone handling
 */

// Singapore timezone offset: UTC+8
const SINGAPORE_TZ = 'Asia/Singapore'

/**
 * Get the current date/time in Singapore timezone
 * Returns an object with year, month, day, hours, minutes, seconds
 * This avoids the pitfalls of Date.toLocaleString() parsing
 */
export function getSingaporeDateParts(date?: Date): {
  year: number
  month: number  // 0-indexed (0 = January)
  day: number
  hours: number
  minutes: number
  seconds: number
} {
  const d = date || new Date()

  // Use Intl.DateTimeFormat to get accurate Singapore timezone parts
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SINGAPORE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const parts = formatter.formatToParts(d)
  const getPart = (type: string) => {
    const part = parts.find(p => p.type === type)
    return part ? parseInt(part.value, 10) : 0
  }

  return {
    year: getPart('year'),
    month: getPart('month') - 1, // Convert to 0-indexed
    day: getPart('day'),
    hours: getPart('hour'),
    minutes: getPart('minute'),
    seconds: getPart('second')
  }
}

/**
 * Get today's date string in Singapore timezone (YYYY-MM-DD format)
 */
export function getSingaporeTodayString(): string {
  const { year, month, day } = getSingaporeDateParts()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Get a date string (YYYY-MM-DD) from a Date object in Singapore timezone
 */
export function getDateStringInSingapore(date: Date): string {
  const { year, month, day } = getSingaporeDateParts(date)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Create a Date object for a specific date at midnight Singapore time
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object representing midnight Singapore time
 */
export function createSingaporeMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`)
}

/**
 * Create a Date object for a specific date at end of day (23:59:59) Singapore time
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object representing end of day Singapore time
 */
export function createSingaporeEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59+08:00`)
}

/**
 * Add days to a date and return the new date string in Singapore timezone
 * @param dateStr - Starting date string in YYYY-MM-DD format
 * @param days - Number of days to add
 * @returns New date string in YYYY-MM-DD format
 */
export function addDaysInSingapore(dateStr: string, days: number): string {
  const date = createSingaporeMidnight(dateStr)
  date.setDate(date.getDate() + days)
  return getDateStringInSingapore(date)
}

/**
 * Add working days (Mon-Fri only) to a date and return the new date string in Singapore timezone
 * Weekends are skipped when counting days, but the resulting date range will include weekends
 * @param dateStr - Starting date string in YYYY-MM-DD format
 * @param workingDays - Number of working days to add
 * @returns New date string in YYYY-MM-DD format (the Nth working day from start)
 */
export function addWorkingDaysInSingapore(dateStr: string, workingDays: number): string {
  const date = createSingaporeMidnight(dateStr)
  let daysAdded = 0

  // Start counting from the first day (if it's a working day)
  const startDayOfWeek = new Date(`${dateStr}T12:00:00+08:00`).getDay()
  if (startDayOfWeek >= 1 && startDayOfWeek <= 5) {
    daysAdded = 1 // First day counts if it's a working day
  }

  while (daysAdded < workingDays) {
    date.setDate(date.getDate() + 1)
    const currentDateStr = getDateStringInSingapore(date)
    const sgDate = new Date(`${currentDateStr}T12:00:00+08:00`)
    const dayOfWeek = sgDate.getDay()

    // Only count weekdays (Monday=1 to Friday=5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      daysAdded++
    }
  }

  return getDateStringInSingapore(date)
}

/**
 * Calculate a date that is N working days before a given date
 * Working days exclude weekends (Saturday and Sunday)
 *
 * @param dateString - The reference date string (e.g., installation date or training date)
 * @param workingDays - Number of working days to subtract
 * @returns Date object representing the deadline, or null if dateString is invalid
 */
export function getWorkingDaysBefore(dateString: string | null | undefined, workingDays: number): Date | null {
  if (!dateString) return null

  try {
    const referenceDate = new Date(dateString)
    if (isNaN(referenceDate.getTime())) return null

    const deadlineDate = new Date(referenceDate)
    let daysToSubtract = workingDays

    while (daysToSubtract > 0) {
      deadlineDate.setDate(deadlineDate.getDate() - 1)
      const dayOfWeek = deadlineDate.getDay()
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysToSubtract--
      }
    }

    return deadlineDate
  } catch {
    return null
  }
}

/**
 * Format a date to a readable string
 *
 * @param date - Date object or date string
 * @returns Formatted date string (e.g., "15 Dec 2024") or null if invalid
 */
export function formatDateShort(date: Date | string | null | undefined): string | null {
  if (!date) return null

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return null

    return dateObj.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return null
  }
}

/**
 * Get the due date string for store setup video (1 working day before installation)
 *
 * @param installationDate - The installation date string
 * @returns Formatted deadline string or null
 */
export function getStoreSetupVideoDueDate(installationDate: string | null | undefined): string | null {
  const deadline = getWorkingDaysBefore(installationDate, 1)
  return formatDateShort(deadline)
}

/**
 * Get the due date string for product list (3 working days before training)
 *
 * @param trainingDate - The training date string
 * @returns Formatted deadline string or null
 */
export function getProductListDueDate(trainingDate: string | null | undefined): string | null {
  const deadline = getWorkingDaysBefore(trainingDate, 3)
  return formatDateShort(deadline)
}
