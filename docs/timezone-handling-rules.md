# Timezone Handling Rules for Onboarding Portal

## Primary Rule: Always Use Local Time Based on Configuration

### Overview
All time comparisons, slot calculations, and availability checks MUST be performed in the **configured local timezone** to ensure consistency and prevent timezone-related bugs. The timezone should be configurable per deployment/region.

## Implementation Guidelines

### 1. Time Slot Definitions
- Time slots (e.g., "09:00", "17:00") are ALWAYS in the server's local time
- When creating Date objects from time slots, use the Date constructor with explicit components:
  ```javascript
  // CORRECT - Uses server's local timezone
  const slotStart = new Date(year, month, day, hour, minute, 0)
  
  // WRONG - Hardcodes timezone offset
  const slotStart = new Date(`${dateStr}T${slot.start}:00+08:00`)
  
  // WRONG - May use wrong timezone
  const slotStart = new Date(`${dateStr}T${slot.start}:00`)
  ```

### 2. Calendar Event Times
- Lark API returns timestamps in seconds (Unix time)
- Always convert to Singapore timezone for comparison:
  ```javascript
  const eventStart = new Date(timestamp * 1000)
  // Use eventStart.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }) for display
  ```

### 3. Availability Calculations
- All overlap checks must compare times in the same timezone
- Convert all times to Singapore timezone before comparison
- A meeting ending at 16:00 should NOT block a slot starting at 16:00

### 4. Display Format
- Always show times to users in 12-hour format with AM/PM
- Example: "3:00 PM - 5:00 PM" not "15:00 - 17:00"

## Common Pitfalls to Avoid

1. **Don't mix UTC and local times** in comparisons
2. **Don't assume** system timezone matches Singapore timezone
3. **Always specify timezone** when creating Date objects from strings
4. **Test with different system timezones** to ensure consistency

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
- [ ] Recurring events calculate correctly across DST boundaries
- [ ] All times display in local Singapore time to users

---

*Last Updated: 2025-10-13*
*Document Owner: Development Team*