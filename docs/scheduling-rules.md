# Scheduling Rules

This document outlines the scheduling rules and constraints for the Onboarding Portal's date booking functionality.

## Overview

The scheduling system enforces a logical progression of dates through the onboarding process, ensuring that each stage happens in the correct order and within reasonable timeframes.

## Date Dependencies

### 1. Hardware Fulfillment
- **Dependencies**: None
- **Constraints**: 
  - Cannot be scheduled on weekends
  - Must be before the Expected Go-Live date
  - Typically set by operations team (not editable via booking modal)

### 2. Installation
- **Dependencies**: Must be scheduled AFTER Hardware Fulfillment date
- **Constraints**:
  - Minimum: 1 day after Hardware Fulfillment date
  - Maximum: 14 days from the earliest eligible date OR Expected Go-Live date (whichever is earlier)
  - Cannot be scheduled on weekends
  - Must be before the Expected Go-Live date

### 3. Training (General/POS/BackOffice)
- **Dependencies**: Must be scheduled AFTER Installation date
- **Constraints**:
  - Minimum: 1 day after Installation date
  - Maximum: 14 days from the earliest eligible date OR Expected Go-Live date (whichever is earlier)
  - Cannot be scheduled on weekends
  - Must be before the Expected Go-Live date
  - Language selection required (Chinese, Bahasa Malaysia, English)

## General Rules

### Weekend Exclusion
- Saturday and Sunday are always blocked for scheduling
- Only weekdays (Monday-Friday) are available for booking

### 14-Day Window
- Users can only select dates within 14 days of the earliest eligible date
- This prevents booking dates too far in the future
- Ensures timely progression through onboarding stages

### Expected Go-Live Date Constraint
- ALL scheduled dates must be before or on the Expected Go-Live date
- If Go-Live date is earlier than 14 days from the minimum eligible date, the Go-Live date becomes the maximum selectable date
- This ensures all onboarding activities are completed before the merchant goes live

## Visual Indicators

### Date Picker UI
1. **Disabled Dates** (greyed out):
   - Dates before the dependent date
   - Weekends
   - Dates after the Go-Live date
   - Dates beyond the 14-day window

2. **Information Messages**:
   - Blue info box showing dependency requirements
   - Example: "ℹ️ Installation must be scheduled after Hardware Fulfillment date (10/20/2025). Must be scheduled before the Expected Go-Live date (11/15/2025). You can select dates up to 14 days from the earliest eligible date."

3. **Mobile View**:
   - Horizontal scrollable date row starts from the first eligible date
   - Only shows dates within the valid range

## Implementation Details

### Date Validation Logic
```javascript
// Minimum date calculation
let minDate = today
if (dependentDate) {
  minDate = max(today, dependentDate + 1 day)
}

// Maximum date calculation
let maxDate = min(
  minDate + 14 days,
  goLiveDate
)

// Date is valid if:
isValid = date >= minDate && 
          date <= maxDate && 
          !isWeekend(date)
```

### Booking Type Hierarchy
1. Hardware Fulfillment → 2. Installation → 3. Training

Each stage must be completed before the next can be scheduled.

## Error Prevention

The system prevents invalid date selections by:
1. Disabling unselectable dates in the UI
2. Showing clear dependency messages
3. Validating dates on both client and server side
4. Automatically adjusting the date range based on dependencies

## Special Considerations

### Training Language Requirements
- For training bookings, at least one language must be selected
- Available languages depend on trainer availability
- Time slots are filtered based on selected languages

### Location-Based Filtering
- Training availability may be filtered based on merchant location
- Onsite vs remote training determined by service type purchased

## Testing Scenarios

### Scenario 1: Normal Flow
- Hardware Fulfillment: Oct 20, 2025
- Installation: Can book Oct 21 - Nov 3, 2025
- Training: After Installation is booked

### Scenario 2: Go-Live Constraint
- Hardware Fulfillment: Oct 20, 2025
- Go-Live Date: Oct 30, 2025
- Installation: Can only book Oct 21 - Oct 30, 2025 (limited by Go-Live)
- Training: Must fit between Installation and Oct 30

### Scenario 3: Late Start
- If booking starts close to Go-Live date, all dates must compress to fit before Go-Live
- System will show limited or no available dates if timeline is too tight

## Frequently Asked Questions

**Q: Why can't I select a date more than 14 days out?**
A: The 14-day window ensures timely progression through onboarding stages and prevents scheduling conflicts.

**Q: What happens if the Go-Live date is moved earlier?**
A: All scheduled dates that fall after the new Go-Live date would need to be rescheduled to comply with the new constraint.

**Q: Can training happen on the same day as installation?**
A: No, training must be at least 1 day after installation to allow proper setup time.

**Q: Why are weekends blocked?**
A: Onboarding activities require staff availability which is limited on weekends.

## Future Enhancements

Potential improvements to consider:
- Allow same-day installation and training for experienced merchants
- Dynamic window sizing based on merchant complexity
- Holiday calendar integration
- Automatic rescheduling suggestions when constraints change
- Buffer time recommendations between stages