# Google Analytics 4 (GA4) Implementation

## Overview
Google Analytics 4 integration with **controlled page view tracking**. Automatic GA4 page views are disabled to prevent duplicate tracking and ensure accurate merchant-specific data.

---

## Key Features

- **Manual page view control** - Automatic GA4 page views disabled via `send_page_view: false`
- **Delayed tracking** - Waits for auth check and merchant data before tracking
- **Custom dimensions** - Tracks `content_group` and `user_type` with each page view
- **Production-only** - Disabled on localhost

---

## How It Works

### Tracking Flow

1. User navigates to a page
2. GA4 script loads (but does NOT auto-track page view)
3. Component waits for:
   - **Auth check** - Determines `user_type` (merchant/internal_team/anonymous)
   - **Merchant data** - For `/merchant/*` and `/login/*` pages, waits for page title to update with merchant name
4. Once ready, fires a single `page_view` event with all dimensions

### Why Delayed Tracking?

Without delayed tracking, GA4 would fire page views:
- Before auth status is known (wrong `user_type`)
- Before merchant name loads (generic "Merchant Onboarding Portal" title)
- Multiple times per navigation (duplicates)

---

## Implementation

### File: `/components/GoogleAnalytics.tsx`

```tsx
"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { getContentGroup } from "@/lib/useContentGroup";

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [userType, setUserType] = useState("anonymous");
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isMerchantDataReady, setIsMerchantDataReady] = useState(false);
  const lastTrackedPath = useRef(null);

  // ... tracking logic ...

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
      <Script id="ga4-init">
        {`
          gtag('config', '${gaId}', {
            send_page_view: false  // Disable automatic page views
          });
        `}
      </Script>
    </>
  );
}
```

### Key Configuration

```javascript
gtag('config', 'G-XXXXXXXXXX', {
  send_page_view: false  // Critical: disables automatic tracking
});
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 Measurement ID (e.g., `G-FP3XZDT8ZH`) |

---

## Custom Event Tracking

To track custom events elsewhere in the app:

```tsx
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

// Track an event
window.gtag('event', 'button_click', {
  event_category: 'engagement',
  event_label: 'signup_button',
});
```

---

## Verification

1. Go to https://analytics.google.com
2. Navigate to **Reports** → **Realtime**
3. Visit your production site
4. You should see yourself as an active user

Or use **DebugView**:
1. Go to **Admin** → **DebugView**
2. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger) Chrome extension
3. Events will appear in real-time

---

## Sources
- [Next.js Official GA4 Documentation](https://nextjs.org/docs/messages/next-script-for-ga)
- [GA4 Setup Guide 2025](https://marcomesen.com/articles/add-google-analytics-to-next-js-v15-2025-in-less-than-5-minutes)
