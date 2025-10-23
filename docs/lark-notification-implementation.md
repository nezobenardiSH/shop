# Lark Notification Implementation Guide

## Overview

This document outlines the implementation of Lark notifications for the Onboarding Portal. The system will send notifications to assigned trainers/installers when training sessions or installations are booked, rescheduled, or cancelled.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Implementation Phases](#implementation-phases)
4. [Code Implementation](#code-implementation)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Message Templates](#message-templates)

## Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Booking API    │────▶│ Lark Service │────▶│ Lark API    │
│  (Training/     │     │ (Send App    │     │ (IM:Message)│
│  Installation)  │     │  Messages)   │     │             │
└─────────────────┘     └──────────────┘     └─────────────┘
        │                       │                     │
        │                       ▼                     ▼
        │              ┌──────────────┐      ┌─────────────┐
        └─────────────▶│   Database   │      │  Trainer/   │
                       │  (Event IDs) │      │  Installer  │
                       └──────────────┘      │  (Receives  │
                                            │  Message)   │
                                            └─────────────┘
```

## Prerequisites

### Lark App Configuration

1. **Lark App Permissions Required**:
   - `im:message:send_as_bot` - Send messages as an app
   - `contact:user.id:readonly` - Read user IDs (for user lookup)

2. **Important Note About User IDs**:
   - **Lark does NOT support looking up users by email address through the API**
   - You must have the actual Lark open_id, union_id, or user_id for each recipient
   - These IDs must be obtained through:
     - OAuth authorization flow (users authorize the app)
     - Manual configuration with known IDs
     - Lark admin providing the IDs

3. **Environment Variables**:
   ```bash
   LARK_APP_ID=cli_xxxxxxxxxxxxx
   LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
   LARK_DOMAIN=https://open.larksuite.com  # or https://open.feishu.cn for China
   ```

## Implementation Phases

### Phase 1: Update Lark Service for App Messaging

#### 1.1 Enhance the Lark Service (`lib/lark.ts`)

Add the following method to send messages as an app:

```typescript
/**
 * Send message as app (not requiring user token)
 */
async sendAppMessage(
  receiverEmail: string,
  message: string | MessageCard,
  msgType: 'text' | 'interactive' = 'text'
): Promise<void> {
  try {
    // First, get the user's open_id from their email
    const user = await this.getUserByEmail(receiverEmail)
    
    // Ensure we have app access token
    await this.ensureAccessToken()
    
    // Prepare the message content
    let content: string
    if (msgType === 'text') {
      content = JSON.stringify({ text: message })
    } else {
      content = JSON.stringify(message)
    }
    
    // Send the message using app token
    const response = await this.makeRequest('/open-apis/im/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        receive_id: user.open_id || user.user_id,
        msg_type: msgType,
        content: content
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Lark-Receive-Id-Type': 'open_id'
      }
    })
    
    console.log('✅ Notification sent successfully to:', receiverEmail)
  } catch (error) {
    console.error('❌ Failed to send app message:', error)
    throw error
  }
}
```

#### 1.2 Update User Lookup Method

Enhance the `getUserByEmail` method to properly fetch Lark user information:

```typescript
async getUserByEmail(email: string): Promise<{ user_id: string; open_id: string; name: string }> {
  try {
    // Ensure we have app access token
    await this.ensureAccessToken()
    
    // Use the contact API to search for user by email
    const response = await this.makeRequest(
      `/open-apis/contact/v3/users/batch?emails=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )
    
    const users = response.data?.items || []
    if (users.length > 0) {
      return {
        user_id: users[0].user_id,
        open_id: users[0].open_id,
        name: users[0].name
      }
    }
    
    throw new Error(`User not found with email: ${email}`)
  } catch (error) {
    console.error('Failed to get user by email:', error)
    throw error
  }
}
```

### Phase 2: Create Notification Helper Functions

Create a new file `lib/lark-notifications.ts`:

```typescript
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
```

### Phase 3: Integrate Notifications into Booking Flows

#### 3.1 Update Training Booking (`app/api/lark/book-training/route.ts`)

Add after successful booking (around line 456):

```typescript
// Import at the top
import { sendBookingNotification } from '@/lib/lark-notifications'

// After successful booking and Salesforce update
try {
  await sendBookingNotification({
    merchantName: onboardingTrainerName || merchantName,
    merchantId,
    date,
    startTime,
    endTime,
    bookingType,
    isRescheduling: !!existingEventId,
    assignedPersonName: assignment.assigned,
    assignedPersonEmail: trainer.email,
    location: merchantAddress,
    contactPerson: merchantContactPerson,
    contactPhone: merchantPhone
  })
} catch (notificationError) {
  console.error('Notification failed but booking succeeded:', notificationError)
}
```

#### 3.2 Update Installation Booking (`lib/installer-availability.ts`)

In the `bookInternalInstallation` function, add after successful booking:

```typescript
// Import at the top
import { sendBookingNotification } from './lark-notifications'

// After successful calendar event creation (around line 415)
try {
  await sendBookingNotification({
    merchantName,
    merchantId,
    date,
    startTime: timeSlot.start,
    endTime: timeSlot.end,
    bookingType: 'installation',
    isRescheduling: !!existingEventId,
    assignedPersonName: assignedInstaller,
    assignedPersonEmail: installer.email
  })
} catch (notificationError) {
  console.error('Notification failed but installation booking succeeded:', notificationError)
}
```

### Phase 4: Create Message Card Templates (Advanced)

For richer notifications, create message cards:

```typescript
interface MessageCard {
  config: {
    wide_screen_mode: boolean
  }
  header: {
    title: {
      content: string
      tag: string
    }
    template: string  // color theme
  }
  elements: Array<any>
}

function createBookingCard(data: BookingNotificationData): MessageCard {
  const emoji = data.isRescheduling ? '📅' : '🆕'
  const action = data.isRescheduling ? 'Rescheduled' : 'New'
  
  return {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        content: `${emoji} ${action} ${data.bookingType} Booking`,
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
      {
        tag: 'hr'
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `You have been assigned to this ${data.bookingType} session.`
          }
        ]
      }
    ]
  }
}
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Lark App Configuration
LARK_APP_ID=cli_xxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
LARK_DOMAIN=https://open.larksuite.com

# Optional: Default notification settings
LARK_NOTIFICATION_ENABLED=true
LARK_NOTIFICATION_RETRY_ATTEMPTS=3
```

### Obtaining Lark User IDs

Since Lark doesn't support email-based user lookup, you need to obtain the open_id or user_id for each trainer/installer. Here are the methods:

#### Method 1: OAuth Authorization (Recommended)
Users authorize the app through `/trainers/authorize` endpoint which stores their IDs in the database.

#### Method 2: Manual Configuration
Ask your Lark admin or use Lark Admin Console to find user IDs, then add them to the configuration files.

#### Method 3: Use Lark Web API Explorer
1. Go to [Lark API Explorer](https://open.larksuite.com/document/server-docs/contact-v3/user/batch)
2. Use the "Get user information" endpoint
3. Search by other means (not email) to find the user's open_id

### Trainer/Installer Configuration

Update `config/trainers.json` and `config/installers.json` to include Lark user IDs:

```json
{
  "trainers": [
    {
      "name": "John Doe",
      "email": "john.doe@company.com",
      "larkUserId": "ou_xxxxxxxxxx",  // Optional, will be fetched by email if not provided
      "larkOpenId": "on_xxxxxxxxxx",  // Optional, will be fetched by email if not provided
      "calendarId": "primary"
    }
  ]
}
```

## Testing

### 1. Test User Lookup

Create a test endpoint `app/api/lark/test-notification/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function POST(request: NextRequest) {
  try {
    const { email, message } = await request.json()
    
    // Test user lookup
    const user = await larkService.getUserByEmail(email)
    console.log('User found:', user)
    
    // Test message sending
    await larkService.sendAppMessage(email, message || 'Test notification', 'text')
    
    return NextResponse.json({ success: true, user })
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed',
      details: error 
    }, { status: 500 })
  }
}
```

### 2. Testing Checklist

- [ ] Verify Lark app has `im:message:send_as_bot` permission
- [ ] Test user lookup by email works
- [ ] Test sending simple text message
- [ ] Test new booking notification
- [ ] Test rescheduling notification
- [ ] Test cancellation notification
- [ ] Verify notifications don't break booking flow if they fail
- [ ] Test with different booking types (training, installation, etc.)

### 3. Test Commands

```bash
# Test user lookup and notification
curl -X POST http://localhost:3010/api/lark/test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trainer@company.com",
    "message": "Test notification from Onboarding Portal"
  }'

# Test booking with notification
curl -X POST http://localhost:3010/api/lark/book-training \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "TEST001",
    "merchantName": "Test Merchant",
    "date": "2024-03-20",
    "startTime": "10:00",
    "endTime": "12:00",
    "bookingType": "training"
  }'
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "User not found" Error
- **Cause**: User email not registered in Lark workspace
- **Solution**: Ensure the trainer/installer has a Lark account with the specified email

#### 2. "Permission denied" Error
- **Cause**: App doesn't have necessary permissions
- **Solution**: Add `im:message:send_as_bot` permission in Lark Developer Console

#### 3. Messages Not Received
- **Cause**: User hasn't added the app or blocked notifications
- **Solution**: 
  - Have user search for and add the app in Lark
  - Check notification settings in Lark

#### 4. "Invalid receive_id" Error
- **Cause**: Using wrong ID type or format
- **Solution**: Ensure using `open_id` with correct header `X-Lark-Receive-Id-Type: open_id`

### Debug Logging

Add debug logging to track notification flow:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[LARK_NOTIFICATION] Attempting to send:', {
    recipient: email,
    messageType: msgType,
    timestamp: new Date().toISOString()
  })
}
```

## Message Templates

### Training Booking
```
🆕 New Training Booking

Merchant: [Merchant Name]
Date: [Date]
Time: [Start] - [End]
Location: [Address]
Contact: [Contact Person]
Phone: [Phone]

You have been assigned to this training session.
```

### Installation Booking
```
🔧 New Installation Scheduled

Merchant: [Merchant Name]
Date: [Date]
Time Slot: [Time Slot]
Location: [Address]

You have been assigned to this installation.
```

### Rescheduling
```
📅 Training Rescheduled

Merchant: [Merchant Name]
New Date: [Date]
New Time: [Start] - [End]

This training session has been rescheduled. Please update your calendar.
```

### Cancellation
```
🚫 Training Cancelled

Merchant: [Merchant Name]
Original Date: [Date]

This training session has been cancelled.
```

## Security Considerations

1. **Token Security**: Never expose app secrets or tokens in client-side code
2. **Rate Limiting**: Implement rate limiting to prevent notification spam
3. **Error Handling**: Never let notification failures break the main booking flow
4. **User Privacy**: Only send notifications to assigned personnel
5. **Audit Logging**: Log all notification attempts for debugging and compliance

## Future Enhancements

1. **Rich Message Cards**: Implement interactive cards with buttons
2. **Delivery Receipts**: Track message delivery and read status
3. **Group Notifications**: Send to team channels for visibility
4. **Notification Preferences**: Allow users to customize notification settings
5. **Multi-language Support**: Send notifications in user's preferred language
6. **Webhook Integration**: Handle responses and updates via Lark webhooks
7. **Notification History**: Store notification history in database
8. **Retry Queue**: Implement robust retry mechanism for failed notifications

## References

- [Lark Open Platform Documentation](https://open.larksuite.com/document/home/index)
- [Send Messages API](https://open.larksuite.com/document/server-docs/im-v1/message/create)
- [User Information API](https://open.larksuite.com/document/server-docs/contact-v3/user/batch)
- [Message Card Builder](https://open.larksuite.com/tool/cardbuilder)