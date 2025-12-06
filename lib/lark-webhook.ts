/**
 * Lark Webhook Notification Utility
 *
 * Sends error notifications to a Lark group chat via webhook.
 *
 * Setup:
 * 1. Create a Lark group for error notifications
 * 2. Add a Custom Bot to the group (Group Settings > Bots > Add Bot > Custom Bot)
 * 3. Copy the webhook URL
 * 4. Set LARK_ERROR_WEBHOOK_URL environment variable
 */

interface ErrorContext {
  route?: string
  method?: string
  userId?: string
  merchantId?: string
  additionalInfo?: Record<string, any>
}

interface LarkWebhookMessage {
  msg_type: 'interactive'
  card: {
    config: {
      wide_screen_mode: boolean
    }
    header: {
      title: {
        tag: string
        content: string
      }
      template: string
    }
    elements: Array<{
      tag: string
      text?: {
        tag: string
        content: string
      }
      fields?: Array<{
        is_short: boolean
        text: {
          tag: string
          content: string
        }
      }>
    }>
  }
}

export async function sendErrorToLark(
  error: Error | string,
  context: ErrorContext = {}
): Promise<boolean> {
  const webhookUrl = process.env.LARK_ERROR_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn('LARK_ERROR_WEBHOOK_URL not configured, skipping error notification')
    return false
  }

  const errorMessage = error instanceof Error ? error.message : error
  const errorStack = error instanceof Error ? error.stack : undefined
  const timestamp = new Date().toISOString()

  // Build context fields
  const fields: Array<{ is_short: boolean; text: { tag: string; content: string } }> = []

  if (context.route) {
    fields.push({
      is_short: true,
      text: { tag: 'lark_md', content: `**Route:** ${context.method || 'GET'} ${context.route}` }
    })
  }

  if (context.merchantId) {
    fields.push({
      is_short: true,
      text: { tag: 'lark_md', content: `**Merchant ID:** ${context.merchantId}` }
    })
  }

  if (context.userId) {
    fields.push({
      is_short: true,
      text: { tag: 'lark_md', content: `**User:** ${context.userId}` }
    })
  }

  fields.push({
    is_short: true,
    text: { tag: 'lark_md', content: `**Time:** ${timestamp}` }
  })

  // Build card message
  const message: LarkWebhookMessage = {
    msg_type: 'interactive',
    card: {
      config: {
        wide_screen_mode: true
      },
      header: {
        title: {
          tag: 'plain_text',
          content: 'Server Error Alert'
        },
        template: 'red'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**Error:** ${errorMessage}`
          }
        },
        {
          tag: 'div',
          fields: fields
        }
      ]
    }
  }

  // Add stack trace if available (truncated)
  if (errorStack) {
    const truncatedStack = errorStack.length > 500
      ? errorStack.substring(0, 500) + '...'
      : errorStack

    message.card.elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**Stack Trace:**\n\`\`\`\n${truncatedStack}\n\`\`\``
      }
    })
  }

  // Add additional info if provided
  if (context.additionalInfo && Object.keys(context.additionalInfo).length > 0) {
    const infoText = Object.entries(context.additionalInfo)
      .map(([key, value]) => `**${key}:** ${JSON.stringify(value)}`)
      .join('\n')

    message.card.elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**Additional Info:**\n${infoText}`
      }
    })
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      console.error('Failed to send error to Lark:', await response.text())
      return false
    }

    const result = await response.json()
    if (result.code !== 0) {
      console.error('Lark webhook returned error:', result)
      return false
    }

    console.log('Error notification sent to Lark successfully')
    return true
  } catch (sendError) {
    console.error('Failed to send error notification to Lark:', sendError)
    return false
  }
}

/**
 * Simple text message to Lark (for less critical notifications)
 */
export async function sendTextToLark(text: string): Promise<boolean> {
  const webhookUrl = process.env.LARK_ERROR_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn('LARK_ERROR_WEBHOOK_URL not configured')
    return false
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        msg_type: 'text',
        content: {
          text: text
        }
      })
    })

    if (!response.ok) {
      console.error('Failed to send text to Lark:', await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to send text to Lark:', error)
    return false
  }
}
