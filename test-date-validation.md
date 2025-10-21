# Date Booking Validation Test Instructions

## Test Scenario 1: Installation Date Booking
1. Navigate to a merchant portal (e.g., /merchant/Nasi-Lemak)
2. Click on "Schedule Installation" button
3. **Expected Result:**
   - If Hardware Fulfillment date is not set: Should allow selecting dates from today up to 14 days
   - If Hardware Fulfillment date IS set (e.g., Oct 20, 2025): 
     - Should only show dates AFTER Oct 20 as available
     - Should limit selection to 14 days from Oct 21 (the day after hardware fulfillment)
     - Should display message: "ℹ️ Installation must be scheduled after Hardware Fulfillment date (10/20/2025). You can select dates up to 14 days from the earliest eligible date."

## Test Scenario 2: Training Date Booking  
1. Navigate to a merchant portal
2. Click on "Schedule Training" button
3. **Expected Result:**
   - If Installation date is not set: Should allow selecting dates from today up to 14 days
   - If Installation date IS set (e.g., Oct 25, 2025):
     - Should only show dates AFTER Oct 25 as available  
     - Should limit selection to 14 days from Oct 26 (the day after installation)
     - Should display message: "ℹ️ Training must be scheduled after Installation date (10/25/2025). You can select dates up to 14 days from the earliest eligible date."

## Test Scenario 3: POS Training Date Booking
1. Navigate to a merchant portal
2. Click on "Schedule POS Training" button  
3. **Expected Result:**
   - Same rules as Training (must be after Installation date)
   - Should display message: "ℹ️ POS Training must be scheduled after Installation date (10/25/2025). You can select dates up to 14 days from the earliest eligible date."

## Test Scenario 4: BackOffice Training Date Booking
1. Navigate to a merchant portal
2. Click on "Schedule BackOffice Training" button
3. **Expected Result:**
   - Same rules as Training (must be after Installation date)
   - Should display message: "ℹ️ BackOffice Training must be scheduled after Installation date (10/25/2025). You can select dates up to 14 days from the earliest eligible date."

## Visual Indicators to Look For:
- Dates before the dependent date should be greyed out and unclickable
- The info message should appear at the top of the modal explaining the dependency
- On mobile, the scrollable date row should start from the first eligible date
- Weekends (Saturday & Sunday) should always be disabled regardless of dependencies

## Console Logs to Monitor:
When selecting dates, check browser console for:
- "Dependent date: [date], Min date: [date]" - Shows the dependency calculation
- "Date out of range. Min: [date], Max: [date]" - When dates are outside allowed window