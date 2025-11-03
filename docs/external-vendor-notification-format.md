# External Vendor Notification Format

This document defines the format for Lark notifications sent to the Onboarding Manager when a merchant is assigned to an external vendor for installation.

## Current Format

```
🏪 External Vendor Assignment Notification

Merchant: [Merchant Name]
Merchant ID: [Merchant ID]
Assigned Vendor: [Vendor Name]
Preferred Installation Date: [Date]
Preferred Installation Time: [Time in 12h format]
Contact Phone: [Phone Number]

This merchant has been assigned to an external vendor for installation. The vendor will contact the merchant directly to schedule the installation.
```

## Example

```
🏪 External Vendor Assignment Notification

Merchant: Nasi Lemak Restaurant
Merchant ID: a0C8d000001AbCdEFG
Assigned Vendor: Surfstek
Preferred Installation Date: 12/11/2025
Preferred Installation Time: 4:00 PM
Contact Phone: +60123456789

This merchant has been assigned to an external vendor for installation. The vendor will contact the merchant directly to schedule the installation.
```

## Desired Format (IMPLEMENTED)

```
🏪 External Vendor Installation Request

Merchant Name: [Merchant Name]
Merchant ID: [Merchant ID]
Merchant Email: [Email from Onboarding_Trainer__c.Email__c]
Store Address: [Full shipping address]

Preferred Date: [DD/MM/YYYY]
Preferred Time: [HH:MM AM/PM]

Sales Order Number: [Order.NSOrderNumber__c]
Hardware:
  - [Product Name] (Qty: [Quantity])
  - [Product Name] (Qty: [Quantity])
  ...

Requester: [MSM Name]
Requester Phone Number: [MSM Phone]
```

## Example with New Format

```
🏪 External Vendor Installation Request

Merchant Name: Nasi Lemak
Merchant ID: a0C8d000001AbCdEFG
Merchant Email: owner@nasilemak.com
Store Address: 123 Jalan Merdeka, Kuala Lumpur, Selangor, 50000, Malaysia

Preferred Date: 12/11/2025
Preferred Time: 4:00 PM

Sales Order Number: SO-2025-001234
Hardware:
  - POS Terminal (Qty: 2)
  - Receipt Printer (Qty: 1)
  - Cash Drawer (Qty: 1)

Requester: John Tan
Requester Phone Number: +60123456789
```

## Notes

- The notification is sent via Lark App Message to the Onboarding Manager's email
- **Merchant Name**: Uses `Onboarding_Trainer__c.Name` (e.g., "Nasi Lemak"), not the Account name
- **Merchant Email**: From `Onboarding_Trainer__c.Email__c`
- **Store Address**: Concatenated from shipping address fields
- **Sales Order Number**: From `Order.NSOrderNumber__c` (first order with this field populated)
- **Hardware**: All `OrderItem` records across all orders for the account
- **Requester**: MSM (Onboarding Manager) name from `MSM_Name__r.Name`
- **Requester Phone**: MSM phone from `MSM_Name__r.Phone`
- Time is automatically converted from 24h format (e.g., "14:00") to 12h format (e.g., "2:00 PM")
- Date is automatically formatted as DD/MM/YYYY
- Function: `sendExternalVendorNotificationToManager()` in `lib/lark-notifications.ts`

