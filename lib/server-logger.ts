/**
 * Server Logger with Lark Integration
 *
 * Use this to log errors and automatically send notifications to Lark.
 *
 * Usage in API routes:
 *
 * import { logServerError } from '@/lib/server-logger'
 *
 * try {
 *   // your code
 * } catch (error) {
 *   await logServerError(error, {
 *     route: '/api/example',
 *     method: 'POST',
 *     merchantId: 'some-id'
 *   })
 *   return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
 * }
 */

import { sendErrorToLark } from './lark-webhook'

interface LogContext {
  route?: string
  method?: string
  userId?: string
  merchantId?: string
  additionalInfo?: Record<string, any>
}

/**
 * Log a server error and send notification to Lark
 * Only sends to Lark for 500-level errors (server errors)
 */
export async function logServerError(
  error: unknown,
  context: LogContext = {}
): Promise<void> {
  // Always log to console
  console.error('Server Error:', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context
  })

  // Send to Lark (async, don't block response)
  const errorToSend = error instanceof Error ? error : new Error(String(error))

  // Fire and forget - don't await to avoid slowing down error responses
  sendErrorToLark(errorToSend, context).catch(larkError => {
    console.error('Failed to send error to Lark:', larkError)
  })
}

/**
 * Helper to wrap API route handlers with error logging
 *
 * Usage:
 * export const POST = withErrorLogging('/api/example', 'POST', async (request) => {
 *   // your handler code
 * })
 */
export function withErrorLogging<T>(
  route: string,
  method: string,
  handler: (request: Request) => Promise<T>
): (request: Request) => Promise<T> {
  return async (request: Request) => {
    try {
      return await handler(request)
    } catch (error) {
      await logServerError(error, { route, method })
      throw error
    }
  }
}

/**
 * Log an info-level message (not sent to Lark)
 */
export function logInfo(message: string, context?: Record<string, any>): void {
  console.log('Info:', message, context || '')
}

/**
 * Log a warning-level message (not sent to Lark)
 */
export function logWarning(message: string, context?: Record<string, any>): void {
  console.warn('Warning:', message, context || '')
}
