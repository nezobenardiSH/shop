# Google Analytics 4 (GA4) Implementation Plan

## Overview
Integrate Google Analytics 4 for page view tracking and user analytics. Production-only (disabled on localhost).

---

## Prerequisites (Manual Steps)

1. Go to https://analytics.google.com
2. Click **Admin** → **Create Property**
3. Name: "OnboardingPortal" or similar
4. Create a **Web** data stream with your production URL
5. Copy the **Measurement ID** (e.g., `G-XXXXXXXXXX`)

---

## Implementation Tasks

### Task 1: Install @next/third-parties Package
**Status:** ✅ Complete

**Command:**
```bash
npm install @next/third-parties
```

---

### Task 2: Create GoogleAnalytics Component
**Status:** ✅ Complete

**File:** `/components/GoogleAnalytics.tsx` (new file)

**Code:**
```tsx
"use client";

import { GoogleAnalytics as GA } from "@next/third-parties/google";

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const isProduction = typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1");

  if (!isProduction || !gaId) {
    return null;
  }

  return <GA gaId={gaId} />;
}
```

---

### Task 3: Add Environment Variable
**Status:** ✅ Complete

**File:** `.env.local`

**Add:**
```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

### Task 4: Update Root Layout
**Status:** ✅ Complete

**File:** `/app/layout.tsx`

**Add import and component:**
```tsx
import GoogleAnalytics from '@/components/GoogleAnalytics'

// In the body:
<GoogleAnalytics />
```

---

## Summary

| Task | File | Status |
|------|------|--------|
| 1. Install package | `package.json` | ✅ |
| 2. Create component | `/components/GoogleAnalytics.tsx` | ✅ |
| 3. Add env variable | `.env.local` | ✅ |
| 4. Update layout | `/app/layout.tsx` | ✅ |

---

## GA4 Features (Automatic)

Once installed, GA4 automatically tracks:
- Page views
- Scroll depth
- Outbound clicks
- Site searches
- Video engagement
- File downloads

---

## Custom Event Tracking (Optional)

To track custom events, use `gtag`:

```tsx
// In any component
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
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
