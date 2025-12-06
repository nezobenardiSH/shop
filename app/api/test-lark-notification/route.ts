import { NextResponse } from 'next/server'
import { sendErrorToLark } from '@/lib/lark-webhook'

export async function GET() {
  try {
    const testError = new Error('This is a test error notification from Claude Code')

    const success = await sendErrorToLark(testError, {
      route: '/api/test-lark-notification',
      method: 'GET',
      additionalInfo: {
        purpose: 'Testing Lark webhook integration',
        timestamp: new Date().toISOString()
      }
    })

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification sent to Lark!'
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to send notification. Check LARK_ERROR_WEBHOOK_URL env var.'
      }, { status: 500 })
    }
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
