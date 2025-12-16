import { larkService } from './lark'

interface BookingNotificationData {
  merchantName: string
  merchantId: string
  date: string
  startTime: string
  endTime: string
  bookingType: string
  isRescheduling: boolean
  assignedPersonName: string
  assignedPersonEmail: string
  location?: string
  contactPerson?: string
  contactPhone?: string
  onboardingServicesBought?: string  // Onboarding Services Bought (to show onsite/remote)
}

/**
 * Send notification for new booking
 */
export async function sendBookingNotification(data: BookingNotificationData): Promise<void> {
  try {
    const message = formatBookingMessage(data)
    await larkService.sendAppMessage(
      data.assignedPersonEmail,
      message,
      'text'
    )
  } catch (error) {
    // Log but don't throw - notifications should not break the booking flow
    console.error('Failed to send booking notification:', error)
  }
}

/**
 * Send notification for cancellation
 */
export async function sendCancellationNotification(
  assignedPersonEmail: string,
  merchantName: string,
  date: string,
  bookingType: string
): Promise<void> {
  try {
    const message = `🚫 ${bookingType} Cancelled\n\n` +
                   `Merchant: ${merchantName}\n` +
                   `Date: ${date}\n\n` +
                   `This ${bookingType.toLowerCase()} session has been cancelled.`
    
    await larkService.sendAppMessage(assignedPersonEmail, message, 'text')
  } catch (error) {
    console.error('Failed to send cancellation notification:', error)
  }
}

/**
 * Send notification when address changes for an existing booking
 */
export async function sendAddressChangeNotification(
  assignedPersonEmail: string,
  merchantName: string,
  bookingType: string,
  bookingDate: string,
  oldAddress: string,
  newAddress: string
): Promise<void> {
  try {
    const formattedDate = formatDateToDDMMYYYY(bookingDate)
    const typeLabel = bookingType.charAt(0).toUpperCase() + bookingType.slice(1)

    const message = `📍 Address Change Notification\n\n` +
                   `Merchant: ${merchantName}\n` +
                   `${typeLabel} Date: ${formattedDate}\n\n` +
                   `Old Address:\n${oldAddress}\n\n` +
                   `New Address:\n${newAddress}\n\n` +
                   `Please update your records accordingly.`

    await larkService.sendAppMessage(assignedPersonEmail, message, 'text')
    console.log(`📧 Address change notification sent to: ${assignedPersonEmail}`)
  } catch (error) {
    // Log but don't throw - notifications should not break the save flow
    console.error('Failed to send address change notification:', error)
  }
}

/**
 * Notify manager to cancel Surftek booking manually
 * Called when address changes from external vendor region to internal installer region
 */
export async function sendSurftekCancelNotification(
  managerEmail: string,
  merchantName: string,
  merchantId: string,
  surftekCaseNum?: string | null
): Promise<void> {
  try {
    const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchantId}/view`

    const message = `🚫 Surftek Booking Cancellation Required\n\n` +
                   `Merchant: ${merchantName}\n` +
                   (surftekCaseNum ? `Surftek Case #: ${surftekCaseNum}\n` : '') +
                   `\nMerchant address changed to internal installer region.\n` +
                   `Please cancel the Surftek booking manually on the Surftek portal.\n\n` +
                   `🔗 Salesforce: ${salesforceUrl}`

    await larkService.sendAppMessage(managerEmail, message, 'text')
    console.log(`📧 Surftek cancel notification sent to: ${managerEmail}`)
  } catch (error) {
    // Log but don't throw - notifications should not break the save flow
    console.error('Failed to send Surftek cancel notification:', error)
  }
}

/**
 * Format date to dd mmm yyyy (e.g., 04 Nov 2025)
 */
function formatDateToDDMMYYYY(dateStr: string): string {
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = monthNames[date.getMonth()]
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

/**
 * Format booking message
 */
function formatBookingMessage(data: BookingNotificationData): string {
  const emoji = data.isRescheduling ? '📅' : '🆕'
  const action = data.isRescheduling ? 'Rescheduled' : 'New'
  const typeLabel = data.bookingType.split('-').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ')

  // Format date to dd/mm/yyyy
  const formattedDate = formatDateToDDMMYYYY(data.date)

  let message = `${emoji} ${action} ${typeLabel} Booking\n\n` +
                `Merchant: ${data.merchantName}\n` +
                `Date: ${formattedDate}\n` +
                `Time: ${data.startTime} - ${data.endTime}\n`

  if (data.onboardingServicesBought) {
    message += `Service Type: ${data.onboardingServicesBought}\n`
  }

  if (data.location) {
    message += `Location: ${data.location}\n`
  }

  if (data.contactPerson) {
    message += `Contact: ${data.contactPerson}\n`
  }

  if (data.contactPhone) {
    message += `Phone: ${data.contactPhone}\n`
  }

  message += `\nYou have been assigned to this ${data.bookingType.toLowerCase()} session.`

  return message
}

/**
 * Send notification to Onboarding Manager for internal booking
 */
export async function sendManagerBookingNotification(data: BookingNotificationData): Promise<void> {
  try {
    const message = formatManagerBookingMessage(data)
    await larkService.sendAppMessage(
      data.assignedPersonEmail, // This will be the manager's email when called
      message,
      'text'
    )
  } catch (error) {
    // Log but don't throw - notifications should not break the booking flow
    console.error('Failed to send manager booking notification:', error)
  }
}

/**
 * Send cancellation notification to Onboarding Manager
 */
export async function sendManagerCancellationNotification(
  managerEmail: string,
  merchantName: string,
  merchantId: string,
  date: string,
  bookingType: string,
  assignedPersonName: string
): Promise<void> {
  try {
    const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchantId}/view`

    const message = `🚫 ${bookingType} Cancelled (Manager Copy)\n\n` +
                   `Merchant: ${merchantName}\n` +
                   `Assigned ${bookingType === 'Training' ? 'Trainer' : 'Installer'}: ${assignedPersonName}\n` +
                   `Date: ${date}\n\n` +
                   `This ${bookingType.toLowerCase()} session has been cancelled.\n\n` +
                   `🔗 Salesforce: ${salesforceUrl}`

    await larkService.sendAppMessage(managerEmail, message, 'text')
  } catch (error) {
    console.error('Failed to send manager cancellation notification:', error)
  }
}

/**
 * Format booking message for managers (includes Salesforce link and assigned person)
 */
function formatManagerBookingMessage(data: BookingNotificationData): string {
  const emoji = data.isRescheduling ? '📅' : '🆕'
  const action = data.isRescheduling ? 'Rescheduled' : 'New'
  const typeLabel = data.bookingType.split('-').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ')

  // Format date to dd/mm/yyyy
  const formattedDate = formatDateToDDMMYYYY(data.date)

  // Determine person role (Trainer or Installer)
  const personRole = data.bookingType.toLowerCase().includes('training') ? 'Trainer' : 'Installer'

  const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${data.merchantId}/view`

  let message = `${emoji} ${action} ${typeLabel} Booking (Manager Copy)\n\n` +
                `Merchant: ${data.merchantName}\n` +
                `Assigned ${personRole}: ${data.assignedPersonName}\n` +
                `Date: ${formattedDate}\n` +
                `Time: ${data.startTime} - ${data.endTime}\n`

  if (data.onboardingServicesBought) {
    message += `Service Type: ${data.onboardingServicesBought}\n`
  }

  if (data.location) {
    message += `Location: ${data.location}\n`
  }

  if (data.contactPerson) {
    message += `Contact: ${data.contactPerson}\n`
  }

  if (data.contactPhone) {
    message += `Phone: ${data.contactPhone}\n`
  }

  message += `\n🔗 Salesforce: ${salesforceUrl}`

  return message
}

/**
 * Send notification to Onboarding Manager about external vendor assignment
 */
export async function sendExternalVendorNotificationToManager(
  managerEmail: string,
  merchantName: string,
  merchantId: string,
  merchantEmail: string,
  storeAddress: string,
  preferredDate: string,
  preferredTime: string,
  orderNumber: string,
  hardwareItems: string[],
  requesterName: string,
  requesterPhone: string,
  surftekCaseNum?: string | null  // Optional Surftek case number
): Promise<void> {
  try {
    // Format time from 24h to 12h format (e.g., "14:00" to "2:00 PM")
    const formatTime = (time: string) => {
      const [hour, minute] = time.split(':')
      const h = parseInt(hour)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 || 12
      return `${h12}:${minute} ${ampm}`
    }

    const formattedTime = preferredTime.includes(':') ? formatTime(preferredTime) : preferredTime

    // Format date to dd/mm/yyyy using shared helper
    const formattedDate = preferredDate.includes('-') ? formatDateToDDMMYYYY(preferredDate) : preferredDate

    // Build hardware list
    const hardwareList = hardwareItems.length > 0
      ? hardwareItems.map(item => `  - ${item}`).join('\n')
      : '  - No hardware items found'

    const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchantId}/view`

    // Build message based on whether Surftek ticket was created
    let message: string
    if (surftekCaseNum) {
      // Surftek ticket was created successfully
      message = `🏪 External Vendor Installation - Ticket Created\n\n` +
                `✅ Surftek Ticket: ${surftekCaseNum}\n\n` +
                `Merchant Name: ${merchantName}\n` +
                `Merchant Email: ${merchantEmail}\n` +
                `Store Address: ${storeAddress}\n\n` +
                `Requested Date: ${formattedDate}\n` +
                `Requested Time: ${formattedTime}\n\n` +
                `Sales Order Number: ${orderNumber}\n` +
                `Hardware:\n${hardwareList}\n\n` +
                `Note: Installation ticket has been automatically created on Surftek system.\n\n` +
                `🔗 Salesforce: ${salesforceUrl}`
    } else {
      // Fallback - manual action required
      message = `🏪 External Vendor Installation Request\n\n` +
                `⚠️ ACTION REQUIRED: Please book on vendor website\n\n` +
                `Merchant Name: ${merchantName}\n` +
                `Merchant Email: ${merchantEmail}\n` +
                `Store Address: ${storeAddress}\n\n` +
                `Preferred Date: ${formattedDate}\n` +
                `Preferred Time: ${formattedTime}\n\n` +
                `Sales Order Number: ${orderNumber}\n` +
                `Hardware:\n${hardwareList}\n\n` +
                `Requester: ${requesterName}\n` +
                `Requester Phone Number: ${requesterPhone}\n\n` +
                `🔗 Salesforce: ${salesforceUrl}`
    }

    await larkService.sendAppMessage(managerEmail, message, 'text')
    console.log(`📧 External vendor notification sent to onboarding manager: ${managerEmail}`)
  } catch (error) {
    console.error('Failed to send external vendor notification to manager:', error)
  }
}

/**
 * Send notification when merchant submits menu/product form
 */
export async function sendMenuSubmissionNotification(
  managerEmail: string,
  merchantName: string,
  merchantId: string
): Promise<void> {
  try {
    const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchantId}/view`

    const message = `📋 Menu/Product Form Submitted\n\n` +
                   `Merchant: ${merchantName}\n\n` +
                   `The merchant has submitted their menu/product information.\n\n` +
                   `🔗 Salesforce: ${salesforceUrl}`

    await larkService.sendAppMessage(managerEmail, message, 'text')
    console.log(`📧 Menu submission notification sent to onboarding manager: ${managerEmail}`)
  } catch (error) {
    console.error('Failed to send menu submission notification:', error)
  }
}

/**
 * Send notification when merchant uploads store setup video
 */
export async function sendStoreVideoNotification(
  managerEmail: string,
  merchantName: string,
  merchantId: string
): Promise<void> {
  try {
    const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchantId}/view`

    const message = `🎥 Store Setup Video Uploaded\n\n` +
                   `Merchant: ${merchantName}\n\n` +
                   `The merchant has uploaded their store setup video proof.\n\n` +
                   `🔗 Salesforce: ${salesforceUrl}`

    await larkService.sendAppMessage(managerEmail, message, 'text')
    console.log(`📧 Store video notification sent to onboarding manager: ${managerEmail}`)
  } catch (error) {
    console.error('Failed to send store video notification:', error)
  }
}

/**
 * Create a rich message card for booking notifications (optional - for future enhancement)
 */
export function createBookingCard(data: BookingNotificationData): any {
  const emoji = data.isRescheduling ? '📅' : '🆕'
  const action = data.isRescheduling ? 'Rescheduled' : 'New'
  const typeLabel = data.bookingType.split('-').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ')

  // Format date to dd/mm/yyyy
  const formattedDate = formatDateToDDMMYYYY(data.date)

  return {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        content: `${emoji} ${action} ${typeLabel} Booking`,
        tag: 'plain_text'
      },
      template: data.isRescheduling ? 'orange' : 'blue'
    },
    elements: [
      {
        tag: 'div',
        fields: [
          {
            is_short: false,
            text: {
              content: `**Merchant:** ${data.merchantName}`,
              tag: 'lark_md'
            }
          },
          {
            is_short: true,
            text: {
              content: `**Date:** ${formattedDate}`,
              tag: 'lark_md'
            }
          },
          {
            is_short: true,
            text: {
              content: `**Time:** ${data.startTime} - ${data.endTime}`,
              tag: 'lark_md'
            }
          }
        ]
      },
      ...(data.location || data.contactPerson || data.contactPhone ? [{
        tag: 'div',
        fields: [
          ...(data.location ? [{
            is_short: false,
            text: {
              content: `**Location:** ${data.location}`,
              tag: 'lark_md'
            }
          }] : []),
          ...(data.contactPerson ? [{
            is_short: true,
            text: {
              content: `**Contact:** ${data.contactPerson}`,
              tag: 'lark_md'
            }
          }] : []),
          ...(data.contactPhone ? [{
            is_short: true,
            text: {
              content: `**Phone:** ${data.contactPhone}`,
              tag: 'lark_md'
            }
          }] : [])
        ]
      }] : []),
      {
        tag: 'hr'
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `You have been assigned to this ${data.bookingType.toLowerCase()} session.`
          }
        ]
      }
    ]
  }
}