# Salesforce Field Mapping Documentation

This document maps all data fields displayed in the Onboarding Portal to their corresponding Salesforce API field names, organized by page/section.

## Table of Contents
- [Data Sources](#data-sources)
- [Merchant Dashboard Page](#merchant-dashboard-page)
- [Merchant Details Page](#merchant-details-page)
- [Special Business Logic](#special-business-logic)
- [Field Availability Notes](#field-availability-notes)

---

## Data Sources

### Primary Objects
1. **Onboarding_Trainer__c** - Main merchant onboarding record
2. **Onboarding_Portal__c** - Portal-specific data (event IDs, dates)
3. **Account** - Business account information
4. **Order** - Order and fulfillment data
5. **OrderItem** - Individual product items
6. **Shipment** - Shipping and tracking information

---

## Merchant Dashboard Page (`/merchant/[merchantId]`)

### Progress Bar & Timeline

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Welcome Call Status | `Welcome_Call_Status__c` | Onboarding_Trainer__c | Completed when = "Welcome Call Completed" |
| First Call Timestamp | `First_Call_Timestamp__c` | Onboarding_Trainer__c | Date/time of welcome call |
| Product Setup Status | `Completed_product_setup__c` | Onboarding_Trainer__c | Done when = "Yes" or "Yes - Self-serve" |
| Hardware Delivery Status | `Delivery_Tracking_Number__c` | Onboarding_Trainer__c | Has tracking = delivered |
| Hardware Fulfillment Date | `Hardware_Fulfillment_Date__c` | Order | Takes first non-null from newest order |
| Installation Date | `Installation_Date__c` | Onboarding_Trainer__c | Date only field |
| Installation DateTime | `Installation_Date_Time__c` | Onboarding_Trainer__c | DateTime with timezone |
| Actual Installation Date | `Actual_Installation_Date__c` | Onboarding_Trainer__c | Completion marker |
| Training Date | `Training_Date__c` | Onboarding_Trainer__c | Single training date |
| Go Live Date | `Planned_Go_Live_Date__c` | Onboarding_Trainer__c | Expected go-live |

### Merchant Information Section

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Merchant Name | `Name` | Onboarding_Trainer__c | Primary identifier |
| Account Name | `Account_Name__r.Name` | Account (via relationship) | Business account name |
| Business Store Name | `Business_Store_Name__c` | Account | Store display name |
| Phone Number | `Phone_Number__c` | Onboarding_Trainer__c | Primary contact |
| Merchant PIC Contact | `Merchant_PIC_Contact_Number__c` | Onboarding_Trainer__c | Person in charge |
| Onboarding Stage | `Onboarding_Trainer_Stage__c` | Onboarding_Trainer__c | Current stage |

### System Fields (Header Information)

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Salesforce ID | `Id` | Onboarding_Trainer__c | 15 or 18 character unique identifier |
| Last Modified | `LastModifiedDate` | Onboarding_Trainer__c | Auto-updated when record changes |
| Created Date | `CreatedDate` | Onboarding_Trainer__c | Record creation timestamp |

### Contact Information

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Operation Manager | `Operation_Manager_Contact__r.Name` | Contact (via relationship) | |
| Operation Manager Phone | `Operation_Manager_Contact__r.Phone` | Contact (via relationship) | |
| Business Owner | `Business_Owner_Contact__r.Name` | Contact (via relationship) | |
| Business Owner Phone | `Business_Owner_Contact__r.Phone` | Contact (via relationship) | |
| MSM Name | `MSM_Name__r.Name` | User (via relationship) | Merchant Success Manager |
| CSM Name | `CSM_Name__r.Name` | User (via relationship) | Customer Success Manager |

### Calendar Event IDs (for rescheduling)

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Installation Event ID | `Installation_Event_ID__c` | Onboarding_Portal__c | Lark calendar event ID (100 chars) |
| Training Event ID | `Training_Event_ID__c` | Onboarding_Portal__c | Lark calendar event ID (100 chars) |
| Portal Installation Date | `Installation_Date__c` | Onboarding_Portal__c | DateTime with timezone |
| Portal Training Date | `Training_Date__c` | Onboarding_Portal__c | DateTime with timezone |
| Installer Name | `Installer_Name__r.Name` | User (via Onboarding_Portal__c) | Assigned installer |

### Document Links

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Menu Collection Form | `Menu_Collection_Form_Link__c` | Onboarding_Trainer__c | Form URL |
| Menu Submission Timestamp | `Menu_Collection_Submission_Timestamp__c` | Onboarding_Trainer__c | When submitted |
| Video Proof Link | `Video_Proof_Link__c` | Onboarding_Trainer__c | Store setup video |
| Tracking Number | `Delivery_Tracking_Number__c` | Onboarding_Trainer__c | Hardware tracking |
| Tracking Timestamp | `Delivery_Tracking_Number_Timestamp__c` | Onboarding_Trainer__c | When tracking added |

---

## Merchant Details Page (`/merchant/[merchantId]/details`)

### Merchant Details Section

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Services | `Onboarding_Services_Bought__c` | Onboarding_Trainer__c | e.g., "Onsite Full Service" |
| Industry | `Sub_Industry__c` | Onboarding_Trainer__c | Business category |
| Language | `Preferred_Language__c` | Onboarding_Trainer__c | Preferred language |
| Features | `Required_Features_by_Merchant__c` | Onboarding_Trainer__c | Required POS features |

### Shipping Address

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Street | `Shipping_Street__c` | Onboarding_Trainer__c | |
| City | `Shipping_City__c` | Onboarding_Trainer__c | |
| State | `Shipping_State__c` | Onboarding_Trainer__c | |
| Postal Code | `Shipping_Zip_Postal_Code__c` | Onboarding_Trainer__c | |
| Country | `Shipping_Country__c` | Onboarding_Trainer__c | |

**Alternative Source (from Order):**
| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Street | `ShippingStreet` | Order | Used if Onboarding_Trainer__c fields empty |
| City | `ShippingCity` | Order | From most recent order |
| State | `ShippingState` | Order | |
| Postal Code | `ShippingPostalCode` | Order | |
| Country | `ShippingCountry` | Order | |

### Financial Information

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Synced Quote Total | `Synced_Quote_Total_Amount__c` | Onboarding_Trainer__c | Total quote amount |
| Pending Payment | `Pending_Payment__c` | Onboarding_Trainer__c | Outstanding amount |

### Product & Order Information

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Order Type | `Type` | Order | Order classification |
| Order Status | `NSStatus__c` | Order | NetSuite status |
| Product Name | `Product2.Name` | OrderItem (via relationship) | Product description |
| Unit Price | `UnitPrice` | OrderItem | Price per unit |
| Quantity | `Quantity` | OrderItem | Number of items |
| Total Price | `TotalPrice` | OrderItem | Line item total |

### Tracking Information

| Display Name | Salesforce Field | Object | Notes |
|-------------|------------------|--------|-------|
| Tracking Link | `Tracking_Link__c` | Shipment | If not in Onboarding_Trainer__c |
| Shipment Status | From tracking link | External | Parsed from carrier |

---

## Special Business Logic

### 1. Hardware Fulfillment Date Selection
- **Query**: Orders sorted by `CreatedDate DESC` (newest first)
- **Logic**: Takes first non-null `Hardware_Fulfillment_Date__c` found
- **Result**: Uses most recent order that has a fulfillment date

### 2. Product Setup Completion
- **Valid Values**: 
  - "Yes" - Completed with assistance
  - "Yes - Self-serve" - Completed independently
- Both values mark the stage as complete

### 3. Event ID Storage
- Event IDs from Lark are 30-40 characters
- Stored in `Onboarding_Portal__c` object (Text(100) fields)
- Used for calendar event deletion during rescheduling

### 4. Address Priority
1. First check `Onboarding_Trainer__c` shipping fields
2. If empty, use most recent `Order` shipping address
3. Format: "Street, City, State PostalCode, Country"

### 5. Training Date Consolidation
- Previously had separate POS and Back Office training dates
- Now uses single `Training_Date__c` field
- Both UI and API updated to use unified field

### 6. Installation Date Fields
- `Installation_Date__c`: Date only (for reports/compatibility)
- `Installation_Date_Time__c`: DateTime with timezone (for precision)
- Both fields updated together during booking

### 7. Progress Bar Stage Mapping
| UI Stage | Salesforce Values |
|----------|------------------|
| Welcome to StoreHub | "New", "Welcome Call", "Welcome to StoreHub" |
| Preparation | "Product Setup", "Preparation", "Document Submission", "Hardware Delivery" |
| Installation | "Installation", "Hardware Installation" |
| Training | "Training" |
| Ready to Go Live | "Ready to Go Live", "Ready" |

---

## Field Availability Notes

### Fields That No Longer Exist (Removed from Production)
- `SSM__c` - SSM document field removed
- `Days_to_Go_Live__c` - Calculated field not available
- `First_Call__c` - Replaced with First_Call_Timestamp__c
- `Installer_Name__c` - Direct field removed, use Portal relationship
- `POS_Training_Date__c` - Consolidated into Training_Date__c
- `Back_Office_Training_Date__c` - Consolidated into Training_Date__c

### Fields That May Be Empty
These fields exist but may not have data for all merchants:
- `Product_Setup_Status__c`
- `Hardware_Delivery_Status__c`
- `Hardware_Installation_Status__c`
- `Training_Status__c`
- `Installation_Issues_Elaboration__c`
- `First_Revised_EGLD__c`

### Relationship Fields
Fields accessed through relationships (using __r notation):
- Account details via `Account_Name__r`
- Contact details via `Operation_Manager_Contact__r` and `Business_Owner_Contact__r`
- User details via `MSM_Name__r`, `CSM_Name__r`, `Installer_Name__r`
- Product details via `Product2` relationship in OrderItem

---

## API Query Optimization Notes

1. **Main Query** (`/api/salesforce/merchant/[merchantId]`):
   - Queries `Onboarding_Trainer__c` by ID
   - Includes all necessary relationship fields in single query
   - Separate queries for Portal, Account, Order data

2. **Portal Data Query**:
   - Queries `Onboarding_Portal__c` by `Onboarding_Trainer_Record__c`
   - Auto-creates record if doesn't exist during booking

3. **Order Data Query**:
   - Limited to 10 most recent orders
   - Queries OrderItems for those orders
   - Queries Shipment for tracking if needed

---

## Update History
- **2025-10-30**: Initial documentation created
- **2025-10-30**: Added Installation_Date_Time__c field
- **2025-10-30**: Updated Product Setup to include "Yes - Self-serve"
- **2025-10-30**: Consolidated training dates to single field
- **2025-10-30**: Added Onboarding_Services_Bought__c and shipping fields
- **2025-10-30**: Added System Fields section (Id, LastModifiedDate, CreatedDate)