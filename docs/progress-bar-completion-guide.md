# Progress Bar Completion Guide

This document defines the completion criteria for each stage in the onboarding progress bar.

## Stage Completion Criteria

### 1. Welcome to StoreHub
**Status:** Completed when Welcome Call Status is set to "Welcome Call Completed"

- Field: `Welcome_Call_Status__c`
- Condition: Field value = "Welcome Call Completed"
- Display: The Welcome Call Status value is displayed in the welcome stage details with color coding:
  - Green badge: "Welcome Call Completed" (stage completed)
  - Yellow badge: Any other status value (stage in progress)
  - Gray text: "Not Set" (no status recorded)

---

### 2. Preparation
The Preparation stage contains three sub-tasks. Each has its own completion criteria:

#### 2.1 Hardware Delivery
**Status:** Done when tracking link is provided

- Field: `Delivery_Tracking_Number__c`
- Condition: Tracking number/link exists (not null/empty)
- Display Status (with colors):
  - "Delivered" (gray text) - if tracking link exists or `Hardware_Delivery_Status__c` = "Delivered"
  - "In Transit" (gray text) - if tracking link exists
  - "Scheduled" (orange text) - if hardware fulfillment date exists but no tracking link
  - "Pending" (orange text) - if no fulfillment date and no tracking link
- Additional Fields:
  - `Delivery_Tracking_Number_Timestamp__c` - When tracking was added
  - `Hardware_Fulfillment_Date__c` - Scheduled delivery date

#### 2.2 Product Setup
**Status:** Done when Completed Product Setup = Yes or Yes - Self-serve

- Field: `Completed_Product_Setup__c`
- Condition: Field value = "Yes" OR "Yes - Self-serve"
- Display Status (with colors):
  - "Completed" (gray text) - if `Completed_Product_Setup__c` = "Yes" or "Yes - Self-serve"
  - "Pending Setup" (orange text) - if menu collection form has been submitted but setup not complete
  - "Pending Menu" (orange text) - if menu collection form has not been submitted
- Additional Fields:
  - `Menu_Collection_Submission_Timestamp__c` - When menu was submitted
  - `Menu_Collection_Form_Link__c` - Link to menu collection form

#### 2.3 Store Setup
**Status:** Done when video has been uploaded

- Field: `Video_Proof_Link__c`
- Condition: Video file exists and has been successfully uploaded
- Display Status (with colors):
  - "Completed" (gray text) - if video has been uploaded
  - "Pending Upload" (orange text) - if no video uploaded yet
- Note: No emoji icons used, consistent with other status displays

---

### 3. Installation
**Status:** Done when Actual Installation Date is filled out

- Field: `Actual_Installation_Date__c`
- Condition: Field has a valid date value

---

### 4. Training
**Status:** Done when both POS Training Date and Back Office Training Date have passed

- Fields: 
  - `POS_Training_Date__c`
  - `Back_Office_Training_Date__c`
- Condition: Current date >= POS Training Date AND Current date >= Back Office Training Date

---

### 5. Ready to Go Live
**Status:** Done when all previous stages have been completed

- Condition: All of the following are complete:
  - Welcome to StoreHub ✓
  - Preparation (all 3 sub-tasks) ✓
  - Installation ✓
  - Training ✓

---

## Special Status Indicators

### Overdue Status
**Display as "Overdue"** when:
- Days to Go Live < 0 (negative value)
- AND Merchant is NOT on Live stage

### Done Status (for Go Live)
**Display as "Done"** when:
- Days to Go Live < 0 (negative value)
- AND Merchant IS on Live stage

---

## Implementation Notes

- All date comparisons should use the current date/time as the reference point
- "Has passed" means the current date is greater than or equal to the specified date
- Empty/null field values should be treated as incomplete
- The progress bar should update in real-time as field values change

