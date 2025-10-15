# Timezone Handling Rules for Onboarding Portal

## Primary Rule: Always Use Singapore Timezone (Asia/Singapore, GMT+8)

### Overview
All time comparisons, slot calculations, and availability checks MUST be performed in **Singapore timezone (Asia/Singapore, GMT+8)** to ensure consistency and prevent timezone-related bugs. This is hardcoded because all trainers operate in Singapore.

## Implementation Guidelines

### 1. Time Slot Definitions
- Time slots are ALWAYS in Singapore time (GMT+8)
- **Current Training Slots**: 10:00-11:00, 12:00-13:00, 14:30-15:30, 17:00-18:00
- When creating Date objects from time slots, use ISO 8601 format with explicit timezone:
  ```javascript
  // CORRECT - Explicitly uses Singapore timezone
  const slotStart = new Date(`${dateStr}T${slot.start}:00+08:00`)
  // Example: new Date('2025-11-07T10:00:00+08:00')

  // WRONG - Uses server's local timezone (may not be Singapore)
  const slotStart = new Date(year, month, day, hour, minute, 0)

  // WRONG - Uses UTC or undefined timezone
  const slotStart = new Date(`${dateStr}T${slot.start}:00`)
  ```

### 2. Date Range Creation
- When creating date ranges, always use Singapore timezone:
  ```javascript
  // CORRECT - Create date in Singapore timezone
  const now = new Date()
  const singaporeNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Singapore"}))
  const startDate = new Date(`${singaporeNow.getFullYear()}-${String(singaporeNow.getMonth() + 1).padStart(2, '0')}-${String(singaporeNow.getDate()).padStart(2, '0')}T00:00:00+08:00`)

  // WRONG - Uses server's local timezone
  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  ```

### 3. Date String Formatting
- When extracting date strings from Date objects, be careful with timezone conversion:
  ```javascript
  // WRONG - toISOString() converts to UTC, may shift date by 1 day
  const dateStr = current.toISOString().split('T')[0] // 2025-11-07T00:00+08:00 becomes 2025-11-06 in UTC!

  // CORRECT - Extract components directly from Date object
  const year = current.getFullYear()
  const month = String(current.getMonth() + 1).padStart(2, '0')
  const day = String(current.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`
  ```

### 4. Calendar Event Times
- Lark API returns timestamps in seconds (Unix time)
- Timestamps are timezone-agnostic (represent absolute moment in time)
- Convert to Singapore timezone for display only:
  ```javascript
  const eventStart = new Date(timestamp * 1000)
  // For display: eventStart.toLocaleString('en-US', { timeZone: 'Asia/Singapore' })
  // For comparison: use the Date object directly
  ```

### 5. Availability Calculations
- All overlap checks must compare times in the same timezone
- Create all Date objects with Singapore timezone (+08:00)
- A meeting ending at 16:00 should NOT block a slot starting at 16:00

### 6. Display Format
- Always show times to users in 12-hour format with AM/PM
- Example: "3:00 PM - 5:00 PM" not "15:00 - 17:00"

## Common Pitfalls to Avoid

1. **Don't use `toISOString()` for date strings** - it converts to UTC and may shift the date
2. **Don't mix UTC and Singapore times** in comparisons
3. **Don't assume** server timezone matches Singapore timezone
4. **Always specify `+08:00`** when creating Date objects from strings
5. **Test with different system timezones** to ensure consistency (e.g., US, Europe, Asia)

## Configuration

The timezone is configured in `/config/trainers.json`:
```json
{
  "timezone": "Asia/Singapore"
}
```

This should be the single source of truth for timezone settings.

## Testing Checklist

- [ ] Slots display correctly regardless of server timezone
- [ ] Meetings ending at slot start time don't block the slot
- [ ] Recurring events calculate correctly (Singapore has no DST)
- [ ] All times display in Singapore time to users
- [ ] Weekends (Saturday & Sunday) are blocked
- [ ] Weekdays (Monday-Friday) show availability
- [ ] Date strings match between frontend and backend (no off-by-one errors)

## Key Implementation Details

### createLocalDate() Function
Located in `lib/trainer-availability.ts`:
```typescript
function createLocalDate(dateStr: string, timeStr: string): Date {
  // Create date in Singapore timezone (+08:00)
  return new Date(`${dateStr}T${timeStr}:00+08:00`)
}
```

### Weekend Filtering
Weekends are filtered in two places:
1. **Backend** (`lib/trainer-availability.ts`): Only generates availability for weekdays (day 1-5)
2. **Frontend** (`components/DatePickerModal.tsx`): Blocks weekends in UI (day 0 and 6)

### Date String Extraction
```typescript
// In lib/trainer-availability.ts
const year = current.getFullYear()
const month = String(current.getMonth() + 1).padStart(2, '0')
const day = String(current.getDate()).padStart(2, '0')
const dateStr = `${year}-${month}-${day}` // e.g., "2025-11-07"
```

### Frontend Date Matching
```typescript
// In components/DatePickerModal.tsx
const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dayAvailability = availability.find(day => day.date === dateStr)
```

Both use the same format to ensure matching.

---

*Last Updated: 2025-10-15*
*Document Owner: Development Team*