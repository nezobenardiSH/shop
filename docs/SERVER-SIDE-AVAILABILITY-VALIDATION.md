# Server-Side Availability Validation Fix

**Date:** December 16, 2025
**Commit:** `85de351`
**Files Changed:**
- `lib/installer-availability.ts`
- `app/api/lark/book-training/route.ts`

## Problem

Bookings were being created on trainers/installers calendars even when they had blocked their calendar (leave, other appointments, etc.).

### Example Scenario

1. Fairul blocks Dec 18 with "Full Day Leave" on Lark Calendar
2. Availability API correctly returns Dec 18 as unavailable
3. Internal user selects Fairul from dropdown and picks a time slot
4. Booking goes through and creates event on Fairul's calendar despite his leave

## Root Cause

The booking APIs trusted frontend data without re-validating availability server-side.

### Installation Booking (`lib/installer-availability.ts`)

```javascript
// BEFORE: No validation - just used the selected installer
if (selectedInstallerEmail) {
  installer = regionConfig.installers.find((i) => i.email === selectedInstallerEmail)
  // Proceeds to create event without checking calendar
}
```

### Training Booking (`app/api/lark/book-training/route.ts`)

```javascript
// BEFORE: No validation - just assigned the selected trainer
if (selectedTrainerEmail) {
  const selectedTrainer = trainersConfig.trainers.find(t => t.email === selectedTrainerEmail)
  assignment = { assigned: selectedTrainer.name, reason: 'Manually selected by internal user' }
  // Proceeds to create event without checking calendar
}
```

## Solution

Added server-side availability validation before creating calendar events.

### Validation Flow

```
1. Get selected person's busy times from Lark Calendar API
2. Check if requested time slot overlaps with any busy period
3. If overlap found → Return error with clear message
4. If no overlap → Proceed with booking
```

### Code Added

Both APIs now include:

```javascript
// SERVER-SIDE AVAILABILITY VALIDATION
const busyTimes = await larkService.getRawBusyTimes(
  personEmail,
  startDateTime,
  endDateTime
)

// Check for conflicts
const conflictingBusy = busyTimes.find((busy) => {
  const busyStart = new Date(busy.start_time)
  const busyEnd = new Date(busy.end_time)
  return slotStart < busyEnd && slotEnd > busyStart
})

if (conflictingBusy) {
  throw new Error(`${personName} is not available for ${timeSlot}. Calendar conflict.`)
}
```

### Error Handling

- **Calendar conflict found:** Returns 409 error with message like "Fairul is not available for 2:30 PM - 3:30 PM. They have a calendar conflict during this time."
- **Lark API failure:** Logs warning but allows booking to proceed (fail-open to prevent blocking all bookings during API outages)

## Testing

### Installation Booking Test

```bash
# Try to book Fairul on Dec 18 (has Full Day Leave)
curl -X POST "http://localhost:3010/api/installation/book" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "a0yQ9000002p2VSIAY",
    "merchantName": "Test",
    "date": "2025-12-18",
    "timeSlot": {"start": "14:30", "end": "15:30", "label": "2:30 PM - 3:30 PM"},
    "availableInstallers": ["Fairul"],
    "selectedInstallerEmail": "fairul.ismail@storehub.com"
  }'

# Expected Response:
{"error":"Fairul is not available for 2:30 PM - 3:30 PM. They have a calendar conflict during this time."}
```

### Training Booking Test

```bash
# Try to book a trainer who has calendar conflicts
curl -X POST "http://localhost:3010/api/lark/book-training" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "...",
    "merchantName": "Test",
    "date": "2025-12-18",
    "startTime": "10:00",
    "endTime": "11:30",
    "selectedTrainerEmail": "trainer@storehub.com",
    "onboardingServicesBought": "Remote Training"
  }'

# Expected Response (if trainer has conflict):
{"error":"TrainerName is not available for 10:00 - 11:30","details":"The selected trainer has a calendar conflict during this time."}
```

## Location in Code

| API | File | Lines |
|-----|------|-------|
| Installation | `lib/installer-availability.ts` | 413-471 |
| Training | `app/api/lark/book-training/route.ts` | 194-252 |

## Related Files

- `lib/lark.ts` - `getRawBusyTimes()` function used for checking busy periods
- `lib/lark-oauth-service.ts` - OAuth token management for calendar access
