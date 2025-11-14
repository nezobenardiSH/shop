# External Vendor Lark Base Integration - Implementation Plan

## Overview

Automatically create a record in the Lark base task management system whenever an external vendor installation request is made through the onboarding portal.

**Target Lark Base**: https://storehub.sg.larksuite.com/base/My9pbR9BEaHm9Csy2tWlBTOUgRh?table=tblYzV0wAwTigWWh&view=vewp7nmiS4

**Base Details**:
- Base Token: `My9pbR9BEaHm9Csy2tWlBTOUgRh`
- Table ID: `tblYzV0wAwTigWWh`

---

## Prerequisites

### Lark App Permissions Required

- [ ] **`bitable:app`** - View, comment, edit and manage Base (NOT readonly)
- [ ] **`contact:user.id:readonly`** - Get Lark user IDs from email addresses

### How to Enable Permissions

1. Go to [Lark Developer Console](https://open.larksuite.com/app)
2. Find your app (credentials in `.env` file)
3. Navigate to "Permissions & Scopes"
4. Enable the permissions listed above
5. Save and publish changes
6. Wait for admin approval if required

---

## Implementation Phases

### Phase 1: Add Bitable API Method to LarkService

**File**: `lib/lark.ts`

**Location**: Add to `LarkService` class (around line 1600+)

**What to Add**: New method to create records in Lark bases

**Code**:
```typescript
/**
 * Create a record in Lark Bitable (Base)
 * @param appToken - The base app token (e.g., 'My9pbR9BEaHm9Csy2tWlBTOUgRh')
 * @param tableId - The table ID (e.g., 'tblYzV0wAwTigWWh')
 * @param fields - Record fields as key-value pairs
 * @returns Created record data with record_id
 */
async createBitableRecord(
  appToken: string,
  tableId: string,
  fields: Record<string, any>
): Promise<any> {
  try {
    console.log(`Creating Lark base record in table ${tableId}`)

    const response = await this.makeRequest(
      `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      {
        method: 'POST',
        body: JSON.stringify({ fields })
      }
    )

    console.log('Lark base record created:', response.data?.record?.record_id)
    return response.data?.record || {}
  } catch (error) {
    console.error('Failed to create Lark base record:', error)
    throw error
  }
}
```

**Lines Added**: ~30 lines

**Testing**: No testing needed yet (just adding the method)

---

### Phase 2: Create Field Mapping Helper Function

**File**: `lib/installer-availability.ts`

**Location**: Add near top of file (after imports, before main functions)

**What to Add**: Helper function to map portal data to Lark base fields

**Code**:
```typescript
/**
 * Map external vendor installation data to Lark base fields
 * @param data Portal data from external vendor request
 * @param larkService LarkService instance for getting user IDs
 * @returns Mapped fields for Lark base record
 */
async function mapToExternalVendorLarkBase(
  data: {
    merchantName: string
    merchantId: string
    msmEmail: string
    preferredDate: string
    preferredTime: string
  },
  larkService: any
): Promise<Record<string, any>> {

  // Get Lark user ID for Onboarding Manager (Person field)
  let onboardingManagerId = ''
  try {
    onboardingManagerId = await larkService.getUserIdFromEmail(data.msmEmail)
  } catch (error) {
    console.error('Failed to get Lark user ID for manager:', error)
  }

  // Parse and combine date/time for Requested Date field
  const requestedDateTime = new Date(`${data.preferredDate} ${data.preferredTime}`)
  const requestedTimestamp = requestedDateTime.getTime()

  // Current timestamp for Input Date
  const inputTimestamp = Date.now()

  // Build Salesforce URL
  const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${data.merchantId}/view`

  return {
    'Merchant Name': data.merchantName,
    'Salesforce': {
      type: 'url',
      link: salesforceUrl
    },
    'Status': 'New',
    'Input Date': inputTimestamp,
    'Onboarding Manager': onboardingManagerId ? {
      id: onboardingManagerId
    } : null,
    'Progress Note': '',
    'Requested date': requestedTimestamp
  }
}
```

**Lines Added**: ~50 lines

**Field Mappings**:
| Portal Data | Lark Base Field | Type | Value |
|------------|-----------------|------|-------|
| merchantName | Merchant Name | Text | Business name |
| merchantId | Salesforce | Link | Constructed URL |
| N/A | Status | Single Select | "New" |
| Current time | Input Date | Date | Timestamp (ms) |
| msmEmail → user ID | Onboarding Manager | Person | Lark user object |
| preferredDate + preferredTime | Requested date | Date/time | Combined timestamp |
| N/A | Progress Note | Text | Empty string |

**Testing**: No testing needed yet

---

### Phase 3: Integrate into External Vendor Flow

**File**: `lib/installer-availability.ts`

**Location**: In `requestExternalInstallation()` function, after line ~1160 (after `sendExternalVendorNotificationToManager()`)

**What to Add**: Call Lark base creation after sending notification

**Code**:
```typescript
// After sending notification to Onboarding Manager
await sendExternalVendorNotificationToManager(
  msmEmail,
  merchantName,
  merchantId,
  merchantEmail,
  storeAddress,
  preferredDate,
  preferredTime,
  orderNumber,
  hardwareItems,
  msmName,
  msmPhone
)

// NEW: Create record in Lark base for task management
try {
  const baseAppToken = 'My9pbR9BEaHm9Csy2tWlBTOUgRh'
  const baseTableId = 'tblYzV0wAwTigWWh'

  const baseFields = await mapToExternalVendorLarkBase(
    {
      merchantName,
      merchantId,
      msmEmail,
      preferredDate,
      preferredTime
    },
    larkService
  )

  const record = await larkService.createBitableRecord(
    baseAppToken,
    baseTableId,
    baseFields
  )

  console.log('✅ External vendor request added to Lark base:', record.record_id)
} catch (error) {
  console.error('❌ Failed to create Lark base record:', error)
  // Don't fail the entire booking if base creation fails
}
```

**Lines Added**: ~30 lines

**Error Handling**: Non-blocking - if Lark base creation fails, the booking continues and only logs an error

**Testing Required**:
1. Book installation for external vendor area (e.g., Johor Bahru suburb address)
2. Check console logs for success message
3. Verify record appears in Lark base
4. Verify all fields populated correctly:
   - Merchant Name shows business name
   - Salesforce link works and opens correct record
   - Status is "New"
   - Input Date shows today's date
   - Onboarding Manager shows correct person
   - Requested date shows booking date/time
   - Progress Note is empty

---

### Phase 4: Add Environment Variables (Optional)

**File**: `.env`

**What to Add**: Configuration constants

**Code**:
```env
# External Vendor Lark Base Configuration
LARK_EXTERNAL_VENDOR_BASE_TOKEN=My9pbR9BEaHm9Csy2tWlBTOUgRh
LARK_EXTERNAL_VENDOR_TABLE_ID=tblYzV0wAwTigWWh
```

**Then Update Phase 3 Code**:
```typescript
const baseAppToken = process.env.LARK_EXTERNAL_VENDOR_BASE_TOKEN!
const baseTableId = process.env.LARK_EXTERNAL_VENDOR_TABLE_ID!
```

**Benefits**:
- Easier to update base/table if they change
- Keeps configuration separate from code
- More maintainable

**Testing**: Same as Phase 3

---

## Current System Flow

### Before Implementation

1. User enters installation details in portal
2. System detects external vendor area (via location detection)
3. System updates Salesforce with preferred date/time
4. System sends Lark notification to Onboarding Manager
5. **Manual**: Manager manually creates task in Lark base

### After Implementation

1. User enters installation details in portal
2. System detects external vendor area (via location detection)
3. System updates Salesforce with preferred date/time
4. System sends Lark notification to Onboarding Manager
5. **Automatic**: System creates record in Lark base task list
6. Manager receives notification and sees task in Lark base

---

## Data Flow

```
Portal Booking
    ↓
External Vendor Detection
    ↓
Update Salesforce
    ↓
Send Lark Notification → Onboarding Manager receives message
    ↓
Create Lark Base Record → New task appears in base
    ↓
Booking Complete
```

---

## Troubleshooting

### Common Issues

**Issue**: "Lark API error: no permission to access bitable"
- **Solution**: Enable `bitable:app` permission in Lark app settings

**Issue**: "Onboarding Manager field is empty in Lark base"
- **Solution**: Check `contact:user.id:readonly` permission is enabled
- **Solution**: Verify MSM email in Salesforce matches Lark account email

**Issue**: "Date fields show incorrect values"
- **Solution**: Verify timestamps are in milliseconds (not seconds)
- **Solution**: Check timezone handling in date parsing

**Issue**: "Salesforce link doesn't work"
- **Solution**: Verify link field format: `{ type: 'url', link: 'https://...' }`

**Issue**: "Status field shows error"
- **Solution**: Verify "New" option exists in Lark base Status field
- **Solution**: Check exact spelling/capitalization matches

---

## Files Modified Summary

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `lib/lark.ts` | +30 | Add `createBitableRecord()` method |
| `lib/installer-availability.ts` | +80 | Add mapper function + integration |
| `.env` (optional) | +2 | Add configuration constants |
| **Total** | **~112 lines** | |

---

## Testing Checklist

- [ ] Phase 1 code compiles without errors
- [ ] Phase 2 code compiles without errors
- [ ] Phase 3 integration complete
- [ ] Book test installation for external vendor area
- [ ] Verify Lark notification sent to manager
- [ ] Verify Lark base record created
- [ ] Verify Merchant Name field populated
- [ ] Verify Salesforce link works
- [ ] Verify Status is "New"
- [ ] Verify Input Date is current date
- [ ] Verify Onboarding Manager shows correct person
- [ ] Verify Requested date matches booking date/time
- [ ] Verify Progress Note is empty
- [ ] Test error handling (temporarily break Lark API)
- [ ] Verify booking still succeeds if base creation fails

---

## Rollback Plan

If issues occur after deployment:

1. **Immediate**: Comment out Phase 3 integration code (lines creating base record)
2. **Verify**: Existing notification flow still works
3. **Debug**: Check console logs for error details
4. **Fix**: Address permission/field mapping issues
5. **Re-enable**: Uncomment integration code after fixing

---

## Future Enhancements

- Add update functionality when installation is rescheduled
- Add status updates (e.g., "Pending Surftek Confirmation" → "Done")
- Sync completion status back to Salesforce
- Add hardware details to Progress Note field
- Create separate records for different external vendors

---

**Document Version**: 1.0
**Created**: 2025-11-14
**Status**: Ready for Implementation
