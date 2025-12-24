# Bug Fix: External Calendar Events Blocking Installer Availability

**Date:** 2025-12-24
**Severity:** Critical
**Status:** Resolved

## Summary

Internal users could not see installer availability for December dates. All time slots appeared as "busy" (greyed out) even when installers had open slots in their Lark calendar.

## Symptoms

- Dec 27-28 showed as completely unavailable for Fattah
- All 4 time slots (10 AM, 12 PM, 2:30 PM, 5 PM) were greyed out
- Lark calendar showed only "Lunch 12-1 PM" blocking those dates
- FreeBusy API returned 9 AM - 6 PM blocks for multiple December dates

## Root Cause

The FreeBusy API was configured with `include_external_calendar: true`, which pulled busy times from ALL subscribed calendars including external ones (Google Calendar).

Fattah had "WORKING" events in his Google Calendar that were:
- Marked as **"Free"** in Lark's UI display
- But marked as **"Busy"** in the source Google Calendar

The FreeBusy API respects the **source calendar's** free/busy status, not Lark's display. This caused 9 AM - 6 PM "WORKING" blocks to appear as busy periods, blocking all time slots.

### Technical Details

```
FreeBusy response: 169 busy periods
  3. 2025-12-24T01:00:00.000Z to 2025-12-24T10:00:00.000Z
     (Local: 12/24/2025, 9:00:00 AM to 12/24/2025, 6:00:00 PM)  <-- Full workday block from external calendar
```

Debug output showed:
```
🔍 BUSY PERIODS blocking 2025-12-24:
   Muhammad Fattah bin Osman:
      24/12/2025, 9:00:00 am - 24/12/2025, 6:00:00 pm  <-- This blocked all slots
```

## Fix Applied

Changed `include_external_calendar` from `true` to `false` in the FreeBusy API request.

### File Modified

`lib/lark.ts` (line ~1447)

```typescript
// BEFORE (buggy):
include_external_calendar: true

// AFTER (fixed):
include_external_calendar: false  // Don't include external calendars (Google, etc.) - they may have "WORKING" events marked as busy
```

## Why This Fix Works

- FreeBusy API now only checks the user's **Lark calendar**
- External calendar events (Google, etc.) are ignored
- Real appointments in Lark calendar still block slots correctly
- "WORKING" events from external calendars no longer cause false blocks

## Related Fixes (Same Session)

### Fix #1: Internal Users Bypass Location Check

**File:** `app/api/installation/availability/route.ts`

Internal users (identified by `includeWeekends=true`) now bypass location-based external vendor routing.

```typescript
// BEFORE:
const isInternalUserWithSelectedInstaller = includeWeekends && installerName

// AFTER:
const isInternalUser = includeWeekends === true
```

### Fix #2: Internal Users Get All Installers

**File:** `lib/installer-availability.ts`

Internal users now see installers from ALL regions, not just the merchant's location.

```typescript
if (includeWeekends) {
  // Internal user - get all installers from all regions
  const allRegions = ['klangValley', 'penang', 'johorBahru']
  for (const region of allRegions) {
    // ... fetch all installers
  }
}
```

## Testing Checklist

1. Log in as internal user
2. Open installation booking for a merchant in external location (e.g., Perak)
3. Select "All Internal Installers" or a specific installer (e.g., Fattah)
4. Verify December dates show available slots (not all greyed out)
5. Verify only actual appointments block specific time slots

## Lessons Learned

1. External calendar integration can cause unexpected blocking behavior
2. Free/busy status may differ between source calendar and Lark UI display
3. Debug logging with specific date/slot details is essential for diagnosing availability issues
4. The `include_external_calendar` flag should be used carefully based on business requirements
