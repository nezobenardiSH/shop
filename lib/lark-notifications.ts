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
  requesterPhone: string
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

    const message = `🏪 External Vendor Installation Request\n\n` +
                   `Merchant Name: ${merchantName}\n` +
                   `Merchant ID: ${merchantId}\n` +
                   `Merchant Email: ${merchantEmail}\n` +
                   `Store Address: ${storeAddress}\n\n` +
                   `Preferred Date: ${formattedDate}\n` +
                   `Preferred Time: ${formattedTime}\n\n` +
                   `Sales Order Number: ${orderNumber}\n` +
                   `Hardware:\n${hardwareList}\n\n` +
                   `Requester: ${requesterName}\n` +
                   `Requester Phone Number: ${requesterPhone}\n\n` +
                   `🔗 Salesforce: ${salesforceUrl}`

    await larkService.sendAppMessage(managerEmail, message, 'text')
    console.log(`📧 External vendor notification sent to onboarding manager: ${managerEmail}`)
  } catch (error) {
    console.error('Failed to send external vendor notification to manager:', error)
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