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
- **Dependencies**: Must be scheduled AFTER Hardware Fulfillment date and BEFORE Training date (if Training is already scheduled)
- **Lower Bound**:
  - Cannot book on the same day (today)
  - Earliest booking: Tomorrow (today + 1 day)
  - If Hardware Fulfillment date exists: 1 day after Hardware Fulfillment date
  - Final lower bound: The later of (tomorrow) OR (Hardware Fulfillment + 1 day)
- **Upper Bound**:
  - If Training is already scheduled: 1 day before the earliest Training date (POS or BackOffice)
  - Otherwise: 14 days from the lower bound
  - Final upper bound: The earlier of (Training date - 1 day) OR (14 days from lower bound)
- **Additional Constraints**:
  - Cannot be scheduled on weekends (Saturday/Sunday)
  - Must be before the Expected Go-Live date

### 3. Training (General/POS/BackOffice)
- **Dependencies**: Must be scheduled AFTER Installation date and BEFORE Go-Live date
- **Lower Bound**:
  - Cannot book on the same day (today)
  - Earliest booking: Tomorrow (today + 1 day)
  - If Installation date exists: 1 day after Installation date
  - Final lower bound: The later of (tomorrow) OR (Installation date + 1 day)
- **Upper Bound**:
  - If Go-Live date exists: On or before Go-Live date
  - Otherwise: 14 days from the lower bound
  - Final upper bound: The earlier of (Go-Live date) OR (14 days from lower bound)
- **Additional Constraints**:
  - Cannot be scheduled on weekends (Saturday/Sunday)
  - Language selection required (Chinese, Bahasa Malaysia, English)

## General Rules

### Same-Day Booking Restriction
- **Installation and Training bookings CANNOT be made for the same day (today)**
- The earliest available booking date is **tomorrow** (today + 1 day)
- This ensures adequate preparation time for both merchants and staff
- Applies to all booking types: Installation, POS Training, BackOffice Training

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

### Booking Order Enforcement
- **Installation must happen BEFORE Training**
  - If Training is already scheduled, Installation cannot be rescheduled to a date after Training
  - The system will limit Installation's upper bound to 1 day before the earliest Training date
- **Training must happen AFTER Installation**
  - If Installation is already scheduled, Training cannot be scheduled before Installation
  - The system will set Training's lower bound to 1 day after Installation date
- This prevents out-of-order scheduling and maintains the logical onboarding flow

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
// For Installation bookings:
let minDate = tomorrow // Cannot book today
if (hardwareFulfillmentDate) {
  minDate = max(tomorrow, hardwareFulfillmentDate + 1 day)
}

let maxDate = minDate + 14 days
if (trainingDate) {
  maxDate = min(maxDate, trainingDate - 1 day) // Must be before training
}

// For Training bookings:
let minDate = tomorrow // Cannot book today
if (installationDate) {
  minDate = max(tomorrow, installationDate + 1 day)
}

let maxDate = minDate + 14 days
if (goLiveDate) {
  maxDate = min(maxDate, goLiveDate) // Must be before or on go-live
}

// Date is valid if:
isValid = date >= minDate &&
          date <= maxDate &&
          !isWeekend(date) &&
          date != today // Cannot book same day
```

### Booking Type Hierarchy
1. Hardware Fulfillment → 2. Installation → 3. Training → 4. Go-Live

**Strict Ordering Rules:**
- Installation MUST be scheduled AFTER Hardware Fulfillment
- Installation MUST be scheduled BEFORE Training (if Training exists)
- Training MUST be scheduled AFTER Installation (if Installation exists)
- Training MUST be scheduled BEFORE Go-Live
- Each stage must have at least 1 day gap from the previous stage

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
- **Today**: Oct 20, 2025
- **Hardware Fulfillment**: Oct 18, 2025
- **Installation**: Can book Oct 21 (tomorrow) - Nov 1, 2025 (14 days from Oct 21)
- **Training**: After Installation is booked (e.g., if Installation is Oct 25, Training can be Oct 26 - Nov 8)

### Scenario 2: Go-Live Constraint
- **Today**: Oct 20, 2025
- **Hardware Fulfillment**: Oct 18, 2025
- **Go-Live Date**: Oct 30, 2025
- **Installation**: Can book Oct 21 - Oct 30, 2025 (limited by Go-Live)
- **Training**: Must fit between Installation and Oct 30 (e.g., if Installation is Oct 25, Training can be Oct 26-30)

### Scenario 3: Rescheduling with Existing Bookings
- **Today**: Oct 20, 2025
- **Installation**: Already scheduled for Oct 25, 2025
- **Training**: Already scheduled for Oct 28, 2025
- **Rescheduling Installation**: Can only book Oct 21 - Oct 27 (limited by Training date - 1)
- **Rescheduling Training**: Can only book Oct 26 (Installation + 1) - Nov 8 (14 days from Oct 26)

### Scenario 4: Same-Day Booking Prevention
- **Today**: Oct 20, 2025 at 2:00 PM
- **User tries to book Installation for Oct 20**: ❌ Blocked - cannot book same day
- **Earliest available date**: Oct 21, 2025 (tomorrow)

### Scenario 5: Late Start
- If booking starts close to Go-Live date, all dates must compress to fit before Go-Live
- System will show limited or no available dates if timeline is too tight
- Example: If today is Oct 28 and Go-Live is Oct 30, only Oct 29 and Oct 30 are available

## Frequently Asked Questions

**Q: Why can't I book for today?**
A: Same-day bookings are not allowed for Installation and Training to ensure adequate preparation time for both merchants and staff. The earliest you can book is tomorrow.

**Q: Why can't I select a date more than 14 days out?**
A: The 14-day window ensures timely progression through onboarding stages and prevents scheduling conflicts.

**Q: What happens if the Go-Live date is moved earlier?**
A: All scheduled dates that fall after the new Go-Live date would need to be rescheduled to comply with the new constraint.

**Q: Can training happen on the same day as installation?**
A: No, training must be at least 1 day after installation to allow proper setup time.

**Q: Why can't I reschedule Installation to a date after Training?**
A: The system enforces the logical order: Installation → Training → Go-Live. Installation must always happen before Training. If you need to move Installation later, you must first reschedule Training to a later date.

**Q: Why are weekends blocked?**
A: Onboarding activities require staff availability which is limited on weekends.

**Q: What if I need to swap Installation and Training dates?**
A: You must reschedule them in order:
1. First, reschedule Training to a later date (this removes the upper bound constraint on Installation)
2. Then, reschedule Installation to your desired date
3. Finally, reschedule Training to your desired date (must be after the new Installation date)

## Future Enhancements

Potential improvements to consider:
- Allow same-day installation and training for experienced merchants
- Dynamic window sizing based on merchant complexity
- Holiday calendar integration
- Automatic rescheduling suggestions when constraints change
- Buffer time recommendations between stages