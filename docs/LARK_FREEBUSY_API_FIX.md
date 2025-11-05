# Lark FreeBusy API Response Handling Fix

## Issue Summary
**Date Identified:** November 5, 2025  
**Issue:** Calendar events were not blocking availability in the onboarding portal, even though the events were visible in Lark Calendar and marked as "Busy".

## Root Cause Analysis

### The Problem
The Lark FreeBusy API returns a **nested response structure**, but our code was parsing it as a flat array. This caused the system to miss busy periods, making calendars appear available when they were actually booked.

### Incorrect Assumption (Before Fix)
```javascript
// Code assumed FreeBusy returns a flat array:
freebusy_list: [
  { start_time: "...", end_time: "..." },
  { start_time: "...", end_time: "..." }
]
```

### Actual FreeBusy Response Structure
```javascript
// FreeBusy actually returns nested structure:
{
  "code": 0,
  "msg": "success",
  "data": {
    "freebusy_list": [
      {
        "user_id": "ou_xxxxx",  // Lark user ID
        "busy_time": [          // Array of busy periods
          { 
            "start_time": "2025-11-06T10:30:00+08:00", 
            "end_time": "2025-11-06T11:30:00+08:00" 
          },
          { 
            "start_time": "2025-11-06T12:00:00+08:00", 
            "end_time": "2025-11-06T14:30:00+08:00" 
          }
        ]
      }
    ]
  }
}
```

## The Fix Applied

### Location: `lib/lark.ts` (lines 531-558)

The fix handles both nested and flat response formats for compatibility:

```typescript
if (freeBusyResponse.data?.freebusy_list && Array.isArray(freeBusyResponse.data.freebusy_list)) {
  if (freeBusyResponse.data.freebusy_list.length > 0) {
    const firstItem = freeBusyResponse.data.freebusy_list[0]
    
    // Check for nested format (with user_id and busy_time array)
    if (firstItem.busy_time && Array.isArray(firstItem.busy_time)) {
      // Extract busy times from nested structure
      for (const userFreeBusy of freeBusyResponse.data.freebusy_list) {
        if (userFreeBusy.busy_time && Array.isArray(userFreeBusy.busy_time)) {
          const userBusyTimes = userFreeBusy.busy_time.map((busy: any) => ({
            start_time: busy.start_time,
            end_time: busy.end_time
          }))
          freeBusyTimes.push(...userBusyTimes)
        }
      }
    } 
    // Fallback to flat format if needed
    else if ((firstItem as any).start_time && (firstItem as any).end_time) {
      freeBusyTimes = freeBusyResponse.data.freebusy_list.map((busy: any) => ({
        start_time: busy.start_time,
        end_time: busy.end_time
      }))
    }
  }
}
```

## Critical Points to Remember

### 1. FreeBusy API Requirements
- **Must use Lark User ID** (format: `ou_xxxxx`), not email address
- User ID is stored in `larkAuthToken.larkUserId` in the database
- The API requires user to have authorized the app via OAuth

### 2. Event Detection Rules
- Events must be marked as **"Busy"** in Lark Calendar (not "Free")
- Both organizer and participant events are detected
- Recurring events are expanded via the `/instances` endpoint
- All calendars (primary, shared, external) are checked via FreeBusy

### 3. Debugging Tools
Use these endpoints to troubleshoot availability issues:

- **General Debug:** `/api/debug/installer-availability?date=YYYY-MM-DD&email=user@example.com`
- **Faizul Calendar:** `/api/debug/faizul-calendar` (specific installer test)
- **Response includes:**
  - FreeBusy API raw response
  - Parsed busy periods
  - Calendar events with free/busy status
  - Computed availability vs actual busy times

## Testing Checklist

When calendar availability seems incorrect:

1. **Check Event Status in Lark**
   - Open the event in Lark Calendar
   - Verify "Show as" is set to "Busy" (not "Free")

2. **Verify OAuth Authorization**
   - User must have authorized via `/installers/authorize` or `/trainers/authorize`
   - Check authorization status in database: `larkAuthToken` table

3. **Use Debug Endpoint**
   ```bash
   curl "http://localhost:3000/api/debug/installer-availability?date=2025-11-06&email=user@storehub.com"
   ```
   - Check `freeBusyFormat` field (should be "nested")
   - Verify `freeBusyData` contains the expected busy periods
   - Look for `freeEvents` - these won't block availability

4. **Check Lark User ID**
   - Verify user has a `larkUserId` in the database
   - Format should be `ou_` followed by alphanumeric string

## Prevention Measures

### 1. Always Test with Real Data
- Don't assume API response formats
- Log and inspect actual API responses
- Test with both organizer and participant events

### 2. Handle Multiple Response Formats
- APIs may change or have variations
- Always implement fallback parsing
- Add comprehensive error logging

### 3. Monitor Production
- Keep debug endpoints available (but secured)
- Log FreeBusy API failures
- Alert when availability detection fails

## Related Files

- **Main Implementation:** `lib/lark.ts` - `getRawBusyTimes()` method
- **Installer Availability:** `lib/installer-availability.ts`
- **Debug Endpoints:** `app/api/debug/installer-availability/route.ts`
- **Configuration:** `config/installers.json`

## Commit Reference
Fix applied in commit: `c18364e` (November 5, 2025)

## Contact for Issues
If calendar availability issues persist:
1. Check this documentation first
2. Use debug endpoints to gather data
3. Check for "Free" vs "Busy" event status
4. Verify OAuth authorization is valid