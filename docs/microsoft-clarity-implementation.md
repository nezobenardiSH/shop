# Microsoft Clarity Implementation Plan

## Overview
Integrate Microsoft Clarity session recording to capture user behavior, session replays, and heatmaps with merchant identification.

---

## Prerequisites (Manual Steps)

Before implementation, you need to:

1. **Sign up for Microsoft Clarity** at https://clarity.microsoft.com (free, uses Microsoft account)
2. **Create a new project** for OnboardingPortal
3. **Copy the Project ID** from Settings → Setup (looks like: `abc123xyz`)

---

## Implementation Tasks

### Task 1: Install NPM Package
**Status:** ✅ Complete

**Command:**
```bash
npm install @microsoft/clarity
```

**Test:** Verify package appears in `package.json` dependencies

---

### Task 2: Create MsClarity Component
**Status:** ✅ Complete

**File:** `/components/MsClarity.tsx` (new file)

**Code:**
```tsx
"use client";

import Clarity from "@microsoft/clarity";
import { useEffect } from "react";

interface MsClarityProps {
  merchantId?: string;
  merchantName?: string;
}

export default function MsClarity({ merchantId, merchantName }: MsClarityProps) {
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

    if (typeof window !== "undefined" && projectId) {
      Clarity.init(projectId);

      // Link session to merchant if available
      if (merchantId) {
        Clarity.identify(merchantId, undefined, undefined, merchantName);
        Clarity.setTag("merchantId", merchantId);
        if (merchantName) {
          Clarity.setTag("merchantName", merchantName);
        }
      }
    }
  }, [merchantId, merchantName]);

  return null;
}
```

**Test:** File compiles without TypeScript errors

---

### Task 3: Add Environment Variable
**Status:** ✅ Complete

**File:** `.env.local`

**Add:**
```
NEXT_PUBLIC_CLARITY_PROJECT_ID=your_project_id_here
```

**Note:** Replace `your_project_id_here` with your actual Clarity Project ID

**Test:** Environment variable is accessible in browser (starts with `NEXT_PUBLIC_`)

---

### Task 4: Update Root Layout
**Status:** ✅ Complete

**File:** `/app/layout.tsx`

**Changes:**
1. Import the MsClarity component
2. Add `<MsClarity />` inside the `<body>` tag

**Updated code:**
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import './globals.css'
import MsClarity from '@/components/MsClarity'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Merchant Onboarding Portal',
  description: 'Self-service merchant onboarding and tracking',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <MsClarity />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

**Test:** App loads without errors, no console errors

---

### Task 5: Verify Installation
**Status:** ✅ Complete (Build successful)

**Steps:**
1. Start dev server: `npm run dev`
2. Open browser DevTools → Network tab
3. Filter for requests containing `clarity`
4. Navigate to any page
5. Confirm POST requests to `clarity.ms` are being sent

**Expected:** Network requests to `https://www.clarity.ms/collect`

---

### Task 6: Verify in Clarity Dashboard
**Status:** ⬜ Pending (Manual verification needed)

**Steps:**
1. Go to https://clarity.microsoft.com
2. Open your project
3. Check for "Live" indicator showing active users
4. Wait a few minutes, then check Recordings tab

**Expected:** Session recordings appear in dashboard

---

## Summary

| Task | File | Status |
|------|------|--------|
| 1. Install package | `package.json` | ✅ |
| 2. Create component | `/components/MsClarity.tsx` | ✅ |
| 3. Add env variable | `.env.local` | ✅ |
| 4. Update layout | `/app/layout.tsx` | ✅ |
| 5. Verify network | Browser DevTools | ✅ |
| 6. Verify dashboard | Clarity website | ⬜ |

---

## Clarity Features Available After Setup

Once installed, you'll have access to:

- **Session Recordings** - Watch exactly what users do
- **Heatmaps** - Click maps, scroll maps, area maps
- **Dashboard** - Overview metrics and insights
- **Filtering** - Filter sessions by merchantId (using custom tags)
- **AI Copilot** - Ask questions about user behavior

---

## API Reference (for future use)

```javascript
// Initialize (done automatically)
Clarity.init("projectId");

// Identify user (links session to merchant)
Clarity.identify("merchantId", "sessionId", "pageId", "friendlyName");

// Add custom tags (searchable in dashboard)
Clarity.setTag("key", "value");

// Track custom events
Clarity.event("eventName");

// Upgrade session priority (ensures recording is kept)
Clarity.upgrade("reason");
```

---

## Troubleshooting

**No data in Clarity dashboard?**
- Check browser console for errors
- Verify `NEXT_PUBLIC_CLARITY_PROJECT_ID` is set correctly
- Ensure no ad blockers are blocking clarity.ms

**TypeScript errors?**
- Run `npm install @microsoft/clarity` again
- Check that `@microsoft/clarity` is in dependencies

**Sessions not linked to merchants?**
- Verify `merchantId` prop is being passed to MsClarity component
- Check Clarity dashboard Filters → Custom Tags
