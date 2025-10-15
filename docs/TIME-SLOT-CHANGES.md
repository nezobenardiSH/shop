# Training Time Slot Changes

## Summary

**Date**: 2025-10-15  
**Change Type**: Training Schedule Update  
**Affected Booking Types**: POS Training, Back Office Training

## New Time Slots

### Previous Schedule (2-hour sessions)
- ❌ 09:00 - 11:00 (Morning Session 1)
- ❌ 11:00 - 13:00 (Morning Session 2)
- ❌ 14:00 - 16:00 (Afternoon Session 1)
- ❌ 16:00 - 18:00 (Afternoon Session 2)

### New Schedule (1-hour sessions)
- ✅ **10:00 - 11:00** (Morning Session)
- ✅ **12:00 - 13:00** (Lunch Session)
- ✅ **14:30 - 15:30** (Afternoon Session)
- ✅ **17:00 - 18:00** (Evening Session)

### Schedule Details
- **Days**: Monday to Friday only (weekends blocked)
- **Duration**: 1 hour per session (reduced from 2 hours)
- **Timezone**: Asia/Singapore (GMT+8)
- **Total Daily Slots**: 4 slots per day

## Files Modified

### 1. Core Availability Logic
**File**: `lib/trainer-availability.ts`
- Updated `TIME_SLOTS` constant in `getCombinedAvailability()` function
- Removed Nezo's lunch blocking (12:30-1:30pm) since 12pm-1pm is now a valid training slot
- Lines changed: 141-148, 93-119

### 2. Lark Calendar Integration
**File**: `lib/lark.ts`
- Updated `TIME_SLOTS` in `convertBusyTimesToAvailability()` function
- Lines changed: 432-437

### 3. Debug Endpoint
**File**: `app/api/debug/jiaen-oct15/route.ts`
- Updated `TIME_SLOTS` for debugging availability
- Lines changed: 109-115

### 4. Test Script
**File**: `scripts/test-specific-date.js`
- Updated time slot definitions for testing
- Added support for 14:30 slot (with minutes)
- Lines changed: 134-141

## Documentation Updates

### 1. Training Calendar Documentation
**File**: `docs/training-calendar.md`
- Updated time slot definitions (lines 575-588)
- Updated availability calculation phase diagram (lines 935-949)
- Changed from "2-hour sessions" to "1-hour sessions"
- Added note about different durations for different booking types

### 2. Implementation Plan
**File**: `docs/implementation-plan.md`
- Updated time slot configuration (lines 1109-1119)
- Updated success criteria (lines 1159-1168)
- Changed from "2-hour duration" to "1-hour duration"

### 3. Timezone Handling Rules
**File**: `docs/timezone-handling-rules.md`
- Added current training slots to documentation (lines 10-24)
- Included example with new time format

## Impact Analysis

### ✅ What Works
- All time slots are in Singapore timezone (GMT+8)
- Weekend blocking still works (Saturday & Sunday blocked)
- Weekday filtering still works (Monday-Friday only)
- Trainer availability checking logic unchanged
- Language filtering unchanged
- Auto-assignment logic unchanged

### ⚠️ What Changed
- **Session Duration**: Reduced from 2 hours to 1 hour
- **Number of Slots**: Still 4 slots per day, but at different times
- **Lunch Availability**: 12pm-1pm is now available for training (previously blocked for Nezo)
- **Slot Timing**: More spread out throughout the day

### 🔍 What to Test
1. **Calendar Display**: Verify new time slots appear correctly in UI
2. **Booking Flow**: Test booking at each new time slot
3. **Trainer Assignment**: Verify trainers are correctly assigned
4. **Overlap Detection**: Ensure meetings still block slots correctly
5. **Timezone Handling**: Confirm times display correctly in Singapore time
6. **Language Filtering**: Test language selection with new slots

## Migration Notes

### No Database Changes Required
- Time slots are defined in code, not database
- No data migration needed
- Existing bookings in old time slots remain valid

### Backward Compatibility
- Old bookings (if any exist in old time slots) will still work
- Calendar events created in old time slots are not affected
- Only new bookings will use new time slots

### Deployment Steps
1. ✅ Update code files (completed)
2. ✅ Update documentation (completed)
3. ⏳ Test in development environment
4. ⏳ Deploy to production
5. ⏳ Monitor for issues

## Testing Checklist

### Manual Testing
- [ ] Visit merchant portal and open booking modal
- [ ] Verify 4 time slots appear: 10-11am, 12-1pm, 2:30-3:30pm, 5-6pm
- [ ] Test booking at 10:00-11:00 slot
- [ ] Test booking at 12:00-13:00 slot
- [ ] Test booking at 14:30-15:30 slot
- [ ] Test booking at 17:00-18:00 slot
- [ ] Verify weekends are blocked
- [ ] Verify trainer assignment works
- [ ] Verify language filtering works
- [ ] Check Lark calendar event is created correctly
- [ ] Verify event shows correct time in Lark (Singapore time)

### Automated Testing
- [ ] Run existing Playwright tests
- [ ] Update test fixtures if needed
- [ ] Add new test cases for new time slots

## Rollback Plan

If issues occur, revert these changes:

```typescript
// Revert to old TIME_SLOTS
const TIME_SLOTS = [
  { start: '09:00', end: '11:00' },
  { start: '11:00', end: '13:00' },
  { start: '14:00', end: '16:00' },
  { start: '16:00', end: '18:00' }
]
```

Files to revert:
1. `lib/trainer-availability.ts`
2. `lib/lark.ts`
3. `app/api/debug/jiaen-oct15/route.ts`
4. `scripts/test-specific-date.js`

## Questions & Answers

### Q: Why 1-hour sessions instead of 2-hour sessions?
A: Business requirement change to allow more flexible scheduling and accommodate more merchants per day.

### Q: Why is 12pm-1pm now available?
A: The new schedule allows training during lunch hours. Trainers can manage their own lunch breaks around bookings.

### Q: What about the 14:30 slot - why not 14:00 or 15:00?
A: Business requirement to have a gap between lunch session (ends 1pm) and afternoon session (starts 2:30pm).

### Q: Do we need to update the database?
A: No, time slots are defined in code, not stored in database.

### Q: What happens to existing bookings in old time slots?
A: They remain valid. Only new bookings use the new time slots.

## Related Documentation

- [Training Calendar System](./training-calendar.md)
- [Timezone Handling Rules](./timezone-handling-rules.md)
- [Implementation Plan](./implementation-plan.md)
- [Direct Booking URLs](./direct-booking-urls.md)

---

*Last Updated: 2025-10-15*  
*Document Owner: Development Team*

