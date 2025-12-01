'use client'

import { getStoreSetupVideoDueDate, getWorkingDaysBefore, formatDateShort } from '@/lib/date-utils'

interface ImportantReminderBoxProps {
  type: 'product-list' | 'store-setup'
  installationDate?: string | null
  trainingDate?: string | null
  isCompleted?: boolean
  /** The name to use for the collection (e.g., "menu" for F&B, "product list" for Retail) */
  collectionName?: string
}

// Warning icon component
const WarningIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
)

/**
 * Standardized Important Reminder Box component for displaying due date reminders
 * Used in the Preparation stage for both product list and store setup video
 */
export default function ImportantReminderBox({
  type,
  installationDate,
  trainingDate,
  isCompleted = false,
  collectionName = 'menu'
}: ImportantReminderBoxProps) {
  // Don't show if the task is completed
  if (isCompleted) return null

  if (type === 'product-list') {
    // Product list due date is 3 working days before training (use training date if available, otherwise installation date)
    const referenceDate = trainingDate || installationDate
    const deadline = getWorkingDaysBefore(referenceDate, 3)
    const dueDate = formatDateShort(deadline)

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-red-900 mb-2">
          <WarningIcon />
          <span>Important Reminder</span>
        </div>
        <p className="text-sm text-gray-700">
          {dueDate ? (
            <>
              Please send us the {collectionName} maximum 3 working days before the training date ({' '}
              <span className="font-semibold text-red-700">{dueDate}</span>
              ). If we don&apos;t receive it by then, we will{' '}
              <span className="font-semibold text-red-700">NOT</span> go ahead with the training.
            </>
          ) : (
            <>
              Please send us the {collectionName} maximum 3 working days before the training date.
              If we don&apos;t receive it by then, we will{' '}
              <span className="font-semibold text-red-700">NOT</span> go ahead with the training.
            </>
          )}
        </p>
      </div>
    )
  }

  if (type === 'store-setup') {
    const dueDate = installationDate ? getStoreSetupVideoDueDate(installationDate) : null

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-red-900 mb-2">
          <WarningIcon />
          <span>Important Reminder</span>
        </div>
        <p className="text-sm text-gray-700">
          {dueDate ? (
            <>
              Please send us the store setup video by{' '}
              <span className="font-semibold text-red-700">{dueDate}</span>
              {' '}(1 working day before installation). If we don&apos;t receive it by then, we will
              still go ahead with the installation as planned.
            </>
          ) : (
            <>
              Please send us the store setup video before the installation date.
              If we don&apos;t receive it by then, we will still go ahead with the installation as planned.
            </>
          )}
        </p>
        <p className="text-sm text-gray-700 mt-2">
          However, if the equipment isn&apos;t ready on your side and we need to come back for a
          second installation once everything is set up, there will be an extra charge of RM200.
        </p>
      </div>
    )
  }

  return null
}
