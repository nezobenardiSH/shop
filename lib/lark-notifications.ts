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
 * Format booking message
 */
function formatBookingMessage(data: BookingNotificationData): string {
  const emoji = data.isRescheduling ? '📅' : '🆕'
  const action = data.isRescheduling ? 'Rescheduled' : 'New'
  const typeLabel = data.bookingType.split('-').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ')
  
  let message = `${emoji} ${action} ${typeLabel} Booking\n\n` +
                `Merchant: ${data.merchantName}\n` +
                `Date: ${data.date}\n` +
                `Time: ${data.startTime} - ${data.endTime}\n`
  
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
  vendorName: string,
  preferredDate: string,
  preferredTime: string,
  contactPhone?: string
): Promise<void> {
  try {
    const message = `🏪 External Vendor Assignment Notification\n\n` +
                   `Merchant: ${merchantName}\n` +
                   `Merchant ID: ${merchantId}\n` +
                   `Assigned Vendor: ${vendorName}\n` +
                   `Preferred Installation Date: ${preferredDate}\n` +
                   `Preferred Installation Time: ${preferredTime}\n` +
                   (contactPhone ? `Contact Phone: ${contactPhone}\n` : '') +
                   `\nThis merchant has been assigned to an external vendor for installation. ` +
                   `The vendor will contact the merchant directly to schedule the installation.`
    
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
              content: `**Date:** ${data.date}`,
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