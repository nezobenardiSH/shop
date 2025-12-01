/**
 * Date utility functions for calculating working days
 */

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
