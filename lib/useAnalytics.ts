import { useEffect, useCallback } from 'react'

/**
 * Client-side analytics tracking hook
 */
export function usePageTracking(
  merchantId: string | undefined,
  merchantName: string | undefined,
  page: string
) {
  useEffect(() => {
    if (!merchantId || !merchantName) return

    // Track page view
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        merchantId,
        merchantName,
        page,
        action: 'view'
      })
    }).catch(err => {
      // Silently fail - don't break the app
      console.error('[Analytics] Failed to track page view:', err)
    })
  }, [merchantId, merchantName, page])
}

/**
 * Track custom events
 */
export function useEventTracking() {
  const trackEvent = useCallback(async (
    merchantId: string,
    merchantName: string,
    page: string,
    action: string,
    metadata?: any
  ) => {
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchantId,
          merchantName,
          page,
          action,
          metadata
        })
      })
    } catch (err) {
      // Silently fail - don't break the app
      console.error('[Analytics] Failed to track event:', err)
    }
  }, [])

  return { trackEvent }
}

