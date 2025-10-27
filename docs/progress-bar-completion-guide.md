# Progress Bar Completion Guide

This document defines the completion criteria for each stage in the onboarding progress bar.

## Stage Completion Criteria

### 1. Welcome to StoreHub
**Status:** Completed when First Call timestamp is filled out

- Field: `First_Call__c`
- Condition: Field has a valid date/time value

---

### 2. Preparation
The Preparation stage contains three sub-tasks. Each has its own completion criteria:

#### 2.1 Hardware Delivery
**Status:** Done when Hardware Fulfillment Date has passed

- Field: `Hardware_Fulfillment_Date__c`
- Condition: Current date >= Hardware Fulfillment Date

#### 2.2 Product Setup
**Status:** Done when Completed Product Setup = Yes

- Field: `Completed_Product_Setup__c`
- Condition: Field value = "Yes"

#### 2.3 Store Setup
**Status:** Done when video has been uploaded

- Field: Video upload status/timestamp
- Condition: Video file exists and has been successfully uploaded

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

