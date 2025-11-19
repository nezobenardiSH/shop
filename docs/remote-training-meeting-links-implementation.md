# Remote Training Meeting Links - Implementation Guide

## 📊 Implementation Progress

**Last Updated**: 2025-11-17

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1.1**: Salesforce Field Setup | ✅ **COMPLETE** | Field `Onboarding_Portal__c.Remote_Training_Meeting_Link__c` created |
| **Phase 1.2**: Update Salesforce Query | ✅ **COMPLETE** | API endpoint now returns `remoteTrainingMeetingLink` field |
| **Phase 2**: Lark VC API Integration | ✅ **COMPLETE** | Methods added: `getUserIdFromEmail()`, `createVideoConferenceMeeting()` |
| **Phase 3**: Booking Flow Integration | ✅ **COMPLETE** | VC creation logic added, address excluded for remote training |
| **Phase 4**: Portal Display | ✅ **COMPLETE** | Training type badge and meeting link display added |
| **Phase 5**: Trainer Edit Functionality | ⏳ **PENDING** | Not started |
| **Phase 6**: Rescheduling Updates | ⏳ **PENDING** | Not started |

### ⚠️ Current Blocker: Authentication Type Mismatch

**Issue Identified**: Lark VC API requires **User Access Token** authentication, but current implementation uses **Tenant Access Token**.

**Evidence**:
- VC permissions in Lark Developer Console show "User token" requirement
- All VC API endpoints return 404 when using tenant access token
- Permissions ARE approved ✅, but wrong authentication method is being used

**See**: `docs/lark-vc-authentication-issue.md` for detailed analysis and solution options

**Recommended Next Steps**:
1. **Option A (Simplest)**: Change VC permissions to "Tenant token" in Lark Developer Console if available
2. **Option B (Correct)**: Implement OAuth user authentication flow (4-6 hours development)
3. **Option C (Workaround)**: Use manual meeting link entry or external VC platform

### 🎯 What's Working
- ✅ Salesforce field integration complete
- ✅ Service type detection (Remote vs Onsite) working
- ✅ Portal UI displays training type badge and meeting link section
- ✅ Booking flow logic complete (VC creation code ready, just needs correct authentication)
- ✅ Calendar events exclude store address for remote training

---

## Overview

This guide provides step-by-step instructions for implementing automatic Lark Video Conference meeting link generation for remote training sessions in the Onboarding Portal.

**✅ SALESFORCE FIELD CREATED**: The field `Onboarding_Portal__c.Remote_Training_Meeting_Link__c` has already been created in Salesforce.

### Goals
- Automatically generate Lark VC meeting links when remote training is booked
- Display meeting links in the portal for merchants and trainers
- Sync meeting links to Salesforce
- Include meeting links in Lark calendar events
- Allow trainers to edit/regenerate meeting links

### Current System Context
- **Service Type Detection**: Already working via `Onboarding_Services_Bought__c` field
- **Types**: "Onsite Training" (location-based) or "Remote Training" (needs meeting link)
- **Data Source**: Salesforce as primary database, Lark for calendar events

---

## Prerequisites

Before starting implementation:

- [x] ✅ Salesforce field `Onboarding_Portal__c.Remote_Training_Meeting_Link__c` created
- [x] ✅ Lark VC API documentation reviewed
- [x] ⚠️ Lark app has Video Conference permissions (`vc:reserve`, `vc:reserve:readonly`) - **UNDER REVIEW**
- [x] ✅ Dev environment running (`npm run dev`)
- [x] ✅ Lark OAuth tokens configured and working

---

## Phase 1: Salesforce Field Setup ✅ COMPLETE

### Step 1.1: Add Salesforce Field

**Field Details:**
- **Object**: `Onboarding_Portal__c` ✅ **COMPLETED**
- **Field Name**: `Remote_Training_Meeting_Link__c` ✅ **CREATED**
- **Field Type**: Text or URL (255 characters max)
- **Field Label**: "Remote Training Meeting Link"
- **Description**: "Video conference meeting link for remote training sessions"
- **Help Text**: "Auto-generated Lark VC link for remote training. Leave blank for onsite training."

**Status**: ✅ Field already created by user

**Verification:**
```bash
# Check field is accessible via API
# Run SOQL query in Salesforce Developer Console
SELECT Id, Remote_Training_Meeting_Link__c FROM Onboarding_Portal__c LIMIT 1
```

### Step 1.2: Update Salesforce Query ✅ COMPLETE

**File**: `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/api/salesforce/merchant/[merchantId]/route.ts`

**Status**: ✅ Completed - Field added to query and response mapping

**Location**: Around line 90-120 (Onboarding_Portal__c SOQL query string)

**Note**: The field is on `Onboarding_Portal__c` object, not `Onboarding_Trainer__c`

**Current Query:**
```typescript
// Query for Onboarding_Portal__c object
const portalQuery = `
  SELECT
    Id,
    Training_Event_ID__c,
    Training_Date__c,
    Trainer_Name__c,
    // ... other fields
  FROM Onboarding_Portal__c
  WHERE Merchant_ID__c = '${merchantId}'
`;
```

**Updated Query (Add this field):**
```typescript
// Query for Onboarding_Portal__c object
const portalQuery = `
  SELECT
    Id,
    Training_Event_ID__c,
    Training_Date__c,
    Trainer_Name__c,
    Remote_Training_Meeting_Link__c,  // ← ADD THIS LINE
    // ... other fields
  FROM Onboarding_Portal__c
  WHERE Merchant_ID__c = '${merchantId}'
`;
```

**Testing:**
```bash
# Test API endpoint returns meeting link field
curl http://localhost:3000/api/salesforce/merchant/YOUR_MERCHANT_ID
# Should see "remoteTrainingMeetingLink" in response (or null if not set)
```

---

## Phase 2: Lark VC API Integration ✅ COMPLETE

**Status**: ✅ Implementation complete - Methods ready, awaiting VC permissions approval

### Step 2.1: Research Lark VC API

**Lark Video Conference API Documentation:**
- Base URL: `https://open.larksuite.com/open-apis/vc/v1/`
- Key endpoints needed:
  - `POST /reserves` - Create VC meeting reservation
  - `GET /reserves/{reserve_id}` - Get meeting details
  - `PATCH /reserves/{reserve_id}` - Update meeting settings

**API Reference**: https://open.larksuite.com/document/server-docs/vc-v1/reserve/create

**Required Permissions:** ✅ Available (Under Review)
- `vc:reserve` - Create, update, delete VC meetings
- `vc:reserve:readonly` - Read meeting details

**Note**: User has both permissions, currently under admin review for approval

**Action Items:**
1. Review Lark VC API docs (link above)
2. Verify your Lark app has required permissions
3. Test API access using Postman or curl
4. Document required request/response formats

### Step 2.2: Add Lark VC Methods to LarkService ✅ COMPLETE

**File**: `/Users/nezobenardi/AI_stuff/OnboardingPortal/lib/lark.ts`

**Status**: ✅ Completed - Methods added at lines 1565-1663

**Location**: Methods added to `LarkService` class (after `cancelTraining()` method)

**Method 1: Create Video Conference Meeting**

```typescript
/**
 * Creates a Lark Video Conference meeting reservation
 * @param title - Meeting title
 * @param startTime - Meeting start time (Unix timestamp in seconds)
 * @param endTime - Meeting end time (Unix timestamp in seconds)
 * @param hostUserId - Lark user ID of the meeting host (trainer)
 * @param description - Optional meeting description
 * @returns Object with meeting link and reservation ID
 */
async createVideoConferenceMeeting(
  title: string,
  startTime: number,
  endTime: number,
  hostUserId: string,
  description?: string
): Promise<{ meetingLink: string; reservationId: string }> {
  try {
    const response = await fetch(
      'https://open.larksuite.com/open-apis/vc/v1/reserves',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          end_time: endTime.toString(),
          meeting_settings: {
            topic: title,
            description: description || '',
            host_user_id: hostUserId,
            auto_record: true,  // Auto-record training sessions
          },
          reserve_user_id: hostUserId,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Lark VC API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    // Lark VC API response structure
    const reservationId = data.data?.reserve?.id;
    const meetingLink = data.data?.reserve?.meeting_no
      ? `https://vc.larksuite.com/j/${data.data.reserve.meeting_no}`
      : data.data?.reserve?.url;

    if (!meetingLink || !reservationId) {
      throw new Error('Failed to get meeting link from Lark VC API');
    }

    return {
      meetingLink,
      reservationId,
    };
  } catch (error) {
    console.error('Error creating Lark VC meeting:', error);
    throw error;
  }
}
```

**Method 2: Get Video Conference Meeting Details**

```typescript
/**
 * Retrieves Lark Video Conference meeting details
 * @param reservationId - The VC reservation ID
 * @returns Meeting details including link and status
 */
async getVideoConferenceMeetingDetails(
  reservationId: string
): Promise<{ meetingLink: string; status: string; topic: string }> {
  try {
    const response = await fetch(
      `https://open.larksuite.com/open-apis/vc/v1/reserves/${reservationId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Lark VC API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    const meetingLink = data.data?.reserve?.meeting_no
      ? `https://vc.larksuite.com/j/${data.data.reserve.meeting_no}`
      : data.data?.reserve?.url;

    return {
      meetingLink: meetingLink || '',
      status: data.data?.reserve?.status || 'unknown',
      topic: data.data?.reserve?.meeting_settings?.topic || '',
    };
  } catch (error) {
    console.error('Error getting Lark VC meeting details:', error);
    throw error;
  }
}
```

**Method 3: Update Video Conference Meeting**

```typescript
/**
 * Updates a Lark Video Conference meeting
 * @param reservationId - The VC reservation ID
 * @param updates - Fields to update (topic, end_time, etc.)
 * @returns Updated meeting details
 */
async updateVideoConferenceMeeting(
  reservationId: string,
  updates: {
    topic?: string;
    endTime?: number;
    description?: string;
  }
): Promise<{ success: boolean }> {
  try {
    const body: any = {};

    if (updates.topic || updates.description) {
      body.meeting_settings = {};
      if (updates.topic) body.meeting_settings.topic = updates.topic;
      if (updates.description) body.meeting_settings.description = updates.description;
    }

    if (updates.endTime) {
      body.end_time = updates.endTime.toString();
    }

    const response = await fetch(
      `https://open.larksuite.com/open-apis/vc/v1/reserves/${reservationId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Lark VC API error: ${JSON.stringify(errorData)}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating Lark VC meeting:', error);
    throw error;
  }
}
```

**Testing:**
```typescript
// Add to a test file or run in Node.js REPL
const larkService = new LarkService('your-access-token');

// Test creating a meeting
const result = await larkService.createVideoConferenceMeeting(
  'Test Remote Training',
  Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  Math.floor(Date.now() / 1000) + 5400, // 1.5 hours from now
  'trainer-user-id',
  'This is a test training session'
);

console.log('Meeting Link:', result.meetingLink);
console.log('Reservation ID:', result.reservationId);
```

### Step 2.3: Handle Lark VC Authentication

**Note**: Lark VC API uses the same tenant access token as calendar API. No additional auth setup needed if Lark calendar integration is already working.

**Verify Token Has VC Permissions:**
```typescript
// Check current token permissions
const response = await fetch(
  'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET,
    }),
  }
);
```

**If permissions missing:**
1. Go to Lark Developer Console
2. Select your app
3. Navigate to "Permissions & Scopes"
4. Add VC permissions: `vc:reserve:write`, `vc:reserve:read`
5. Request admin approval if needed
6. Wait for permission grant

---

## Phase 3: Booking Flow Integration ✅ COMPLETE

**Status**: ✅ Implementation complete - Ready for testing once VC permissions approved

### Step 3.1: Update Booking API Route ✅ COMPLETE

**File**: `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/api/lark/book-training/route.ts`

**Status**: ✅ Completed - VC creation logic added at lines 421-481

**Implementation Details:**
- Service type already detected at line 80
- VC meeting creation logic added after calendar event creation
- Graceful error handling ensures booking never fails due to VC issues

**Current Flow:**
1. Get merchant info from Salesforce
2. Detect service type
3. Get trainer availability
4. Book calendar event
5. Update Salesforce

**Updated Flow (Add VC meeting creation):**

**Add after line ~250 (after service type detection):**

```typescript
// Existing code
const serviceType = detectServiceType(trainer.onboardingServicesBought);

// NEW CODE: Prepare for VC meeting creation
let meetingLink: string | null = null;
let vcReservationId: string | null = null;

// NEW CODE: Check if remote training needs meeting link
const isRemoteTraining = serviceType === 'remote';
```

**Add after line ~420 (after calendar event created, before Salesforce update):**

```typescript
// Existing: Event created successfully
const eventId = await larkService.bookTraining(/* ... */);

// NEW CODE: Create VC meeting for remote training
if (isRemoteTraining) {
  try {
    console.log('Creating Lark VC meeting for remote training...');

    // Get trainer's Lark user ID from their email
    const trainerUserId = await larkService.getUserIdFromEmail(trainerEmail);

    if (!trainerUserId) {
      console.warn('Could not get trainer Lark user ID, skipping VC creation');
    } else {
      // Create meeting title
      const meetingTitle = `Remote Training: ${merchantInfo.name}`;

      // Create description
      const meetingDescription = `
Remote Training Session

Merchant: ${merchantInfo.name}
Contact: ${merchantInfo.merchantPICName || 'N/A'}
Email: ${merchantInfo.merchantEmail || 'N/A'}
Phone: ${merchantInfo.merchantPICPhone || 'N/A'}

Training Language: ${merchantInfo.language?.join(', ') || 'N/A'}

Required Features:
${merchantInfo.requiredFeatures || 'N/A'}

Salesforce: https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchantId}/view
      `.trim();

      // Convert date/time to Unix timestamps
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(`${date}T${endTime}`);
      const startTimestamp = Math.floor(startDateTime.getTime() / 1000);
      const endTimestamp = Math.floor(endDateTime.getTime() / 1000);

      // Create VC meeting
      const vcMeeting = await larkService.createVideoConferenceMeeting(
        meetingTitle,
        startTimestamp,
        endTimestamp,
        trainerUserId,
        meetingDescription
      );

      meetingLink = vcMeeting.meetingLink;
      vcReservationId = vcMeeting.reservationId;

      console.log('✅ Lark VC meeting created:', meetingLink);
    }
  } catch (error) {
    console.error('❌ Failed to create Lark VC meeting:', error);
    // Don't fail entire booking if VC creation fails
    // Admin can manually add link later
  }
}
```

**Update Salesforce sync (around line 450-500):**

```typescript
// Existing Salesforce update for Onboarding_Portal__c
const updateData: any = {
  Training_Date__c: date,
  Trainer_Name__c: trainerId,
  // ... other fields
};

// NEW CODE: Add meeting link if available
if (meetingLink) {
  updateData.Remote_Training_Meeting_Link__c = meetingLink;  // ← Use correct field name
  console.log('📝 Adding meeting link to Salesforce update');
}

// Existing: Update Onboarding_Portal__c
await salesforce.updateOnboardingPortal(merchantId, updateData);
```

**Update calendar event description (inside bookTraining call):**

**Find the `bookTraining()` call around line 400, update to include meeting link in description:**

```typescript
const eventId = await larkService.bookTraining(
  {
    name: merchantInfo.name,
    // ... other merchant info
  },
  trainerEmail,
  trainerCalendarId,
  date,
  startTime,
  endTime,
  'training',
  trainerName
);

// After event is created, if meeting link exists, update event description
if (isRemoteTraining && meetingLink) {
  // Note: You may need to add a method to update calendar event description
  // Or include meeting link in the original bookTraining() call
  console.log('Meeting link will be shown in portal and Salesforce');
}
```

**Alternative: Modify bookTraining() method signature (RECOMMENDED)**

Update the `bookTraining()` method in `/lib/lark.ts` to accept meeting link:

```typescript
async bookTraining(
  merchantInfo: { /* ... */ },
  trainerEmail: string,
  trainerCalendarId: string,
  date: string,
  startTime: string,
  endTime: string,
  bookingType: string = 'training',
  trainerName?: string,
  meetingLink?: string  // ← ADD THIS PARAMETER
): Promise<string>
```

Then inside the method, update the description:

```typescript
const description = `
Training Details
==================

${meetingLink ? `
🔗 JOIN MEETING: ${meetingLink}
==================

` : ''}

Merchant: ${merchantName}
// ... rest of description
`;
```

### Step 3.2: Add getUserIdFromEmail Helper

**File**: `/Users/nezobenardi/AI_stuff/OnboardingPortal/lib/lark.ts`

**Location**: Add method to `LarkService` class

```typescript
/**
 * Gets Lark user ID from email address
 * @param email - User's email address
 * @returns Lark user ID or null if not found
 */
async getUserIdFromEmail(email: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://open.larksuite.com/open-apis/contact/v3/users/batch_get_id?emails=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to get user ID from email:', await response.text());
      return null;
    }

    const data = await response.json();
    const userId = data.data?.user_list?.[0]?.user_id;

    return userId || null;
  } catch (error) {
    console.error('Error getting user ID from email:', error);
    return null;
  }
}
```

### Step 3.3: Testing Booking Flow

**Status**: ⏳ Ready for testing with merchant `a0yQ900000Bxg89`

**Test Cases:**

1. **Test Remote Training Booking:** ⏳ READY
```bash
# Start dev server
npm run dev

# Book a remote training via portal
# 1. Go to http://localhost:3000/merchant/YOUR_MERCHANT_ID
# 2. Click "Book Training"
# 3. Select remote trainer
# 4. Select date/time
# 5. Submit

# Check logs for:
# ✅ "Creating Lark VC meeting for remote training..."
# ✅ "Lark VC meeting created: https://vc.larksuite.com/j/..."
# ✅ "Adding meeting link to Salesforce update"

# Verify in Salesforce:
# - Training_Meeting_Link__c field populated
# - Check Lark calendar event has meeting link in description
```

2. **Test Onsite Training (No Meeting Link):**
```bash
# Book an onsite training
# Verify:
# - NO VC meeting created
# - Training_Meeting_Link__c remains null
# - No meeting link in calendar description
```

3. **Test VC Creation Failure Handling:**
```bash
# Temporarily break VC API (wrong token, etc.)
# Book remote training
# Verify:
# - Booking still succeeds
# - Error logged but not thrown
# - Meeting link is null
# - Can manually add link later
```

---

## 📝 Phase 3 Implementation Summary

### ✅ What's Been Completed:

**Files Modified:**
1. `/Users/nezobenardi/AI_stuff/OnboardingPortal/lib/lark.ts`
   - Lines 1565-1591: `getUserIdFromEmail()` method
   - Lines 1593-1663: `createVideoConferenceMeeting()` method

2. `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/api/lark/book-training/route.ts`
   - Lines 421-481: VC meeting creation logic
   - Lines 796-800: Salesforce update with meeting link

3. `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/api/salesforce/merchant/[merchantId]/route.ts`
   - Line 211: Query includes `Remote_Training_Meeting_Link__c`
   - Line 224: Extract field from query result
   - Line 555: Add field to API response

### ⚡ Current Behavior:

**Before VC Permissions Approved:**
- ✅ Booking detects remote training correctly
- ✅ Attempts to create VC meeting
- ⚠️ VC creation fails gracefully (permissions error)
- ✅ Booking completes successfully
- ✅ Training date saved to Salesforce
- ✅ Calendar event created
- ⚠️ Meeting link field = null

**After VC Permissions Approved:**
- ✅ Same code automatically creates VC meeting
- ✅ Meeting link generated
- ✅ Meeting link saved to Salesforce
- ✅ Meeting link included in calendar event
- ✅ No code changes needed!

### 🧪 Verification Test:

**Test Merchant**: `a0yQ900000Bxg89` (RyanFoo testing)
- Service: "Remote Full Service" ✅
- Portal URL: http://localhost:3010/merchant/a0yQ900000Bxg89

**Expected Logs:**
```
🔍 Service Type Detection: serviceType: 'remote'
🎥 Creating Lark VC meeting for remote training...
❌ Lark VC API error: insufficient permissions
✅ Successfully updated Onboarding_Portal__c
```

---

## Phase 4: Portal Display ⏳ PENDING

### Step 4.1: Update Details Page UI

**File**: `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/merchant/[merchantId]/details/page.tsx`

**Location**: Around line 316-352 (Services & Features section)

**Add Meeting Link Display:**

```typescript
{/* Existing Services & Features section */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">

  {/* Existing: Onboarding Service */}
  <div>
    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
      Onboarding Service
    </div>
    <div className="text-sm text-gray-900">
      {trainer.onboardingServicesBought || 'N/A'}
    </div>
  </div>

  {/* Existing: Service Type */}
  <div>
    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
      Service Type
    </div>
    <div className="text-sm text-gray-900">
      {trainer.serviceType || 'N/A'}
      {trainer.shippingCity && trainer.shippingState && (
        <span className="text-gray-600 ml-1">
          • {trainer.shippingCity}, {trainer.shippingState}
        </span>
      )}
    </div>
  </div>

  {/* NEW: Meeting Link (Remote Training Only) */}
  {trainer.serviceType === 'remote' && (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
        Training Meeting Link
      </div>
      <div className="text-sm">
        {trainer.remoteTrainingMeetingLink ? (
          <div className="flex items-center gap-2">
            <a
              href={trainer.remoteTrainingMeetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
              Join Training
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(trainer.remoteTrainingMeetingLink || '');
                // Optional: Show toast notification
                alert('Meeting link copied to clipboard!');
              }}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="Copy meeting link"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        ) : (
          <span className="text-gray-400 italic">
            Link will be generated when training is booked
          </span>
        )}
      </div>
    </div>
  )}

</div>
```

### Step 4.2: Add Visual Badge for Training Type

**Location**: Same file, above the Services & Features section (around line 310)

```typescript
{/* NEW: Training Type Badge */}
{trainer.serviceType && (
  <div className="mb-4">
    <span className={`
      inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
      ${trainer.serviceType === 'remote'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-green-100 text-green-800'
      }
    `}>
      {trainer.serviceType === 'remote' ? (
        <>
          <svg
            className="w-4 h-4 mr-1.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Remote Training
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4 mr-1.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Onsite Training
        </>
      )}
    </span>
  </div>
)}
```

### Step 4.3: Update TypeScript Types

**File**: Create or update types file for merchant data

**If types are inline in the page component:**

```typescript
// Add to existing merchant/trainer type definition
interface TrainerData {
  // ... existing fields
  remoteTrainingMeetingLink?: string | null;
}
```

**If using separate types file**, update accordingly.

### Step 4.4: Update Main Progress Page (Optional)

**File**: `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/merchant/[merchantId]/page.tsx`

**Consider showing meeting link in timeline or card if booked:**

```typescript
{/* In training card/timeline item */}
{trainer.serviceType === 'remote' && trainer.remoteTrainingMeetingLink && (
  <div className="mt-2">
    <a
      href={trainer.remoteTrainingMeetingLink}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      Join Training Meeting
    </a>
  </div>
)}
```

### Step 4.5: Testing Portal Display

**Test Cases:**

1. **Remote Training with Meeting Link:**
```bash
# Navigate to merchant details page
# http://localhost:3000/merchant/[merchantId]/details

# Verify:
# ✅ Blue badge shows "Remote Training" with video icon
# ✅ "Training Meeting Link" field visible
# ✅ "Join Training" link clickable (opens Lark VC)
# ✅ Copy button works (copies to clipboard)
```

2. **Remote Training without Meeting Link (Not Yet Booked):**
```bash
# Verify:
# ✅ Blue badge shows "Remote Training"
# ✅ "Training Meeting Link" shows "Link will be generated when training is booked"
```

3. **Onsite Training:**
```bash
# Verify:
# ✅ Green badge shows "Onsite Training" with location icon
# ✅ NO "Training Meeting Link" field visible
# ✅ Location info shown instead
```

4. **Responsive Design:**
```bash
# Test on mobile viewport
# Verify grid layout adapts correctly
```

---

## Phase 5: Trainer Edit Functionality

### Step 5.1: Create API Endpoint for Meeting Link Update

**File**: Create `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/api/training/meeting-link/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { LarkService } from '@/lib/lark';
import { SalesforceService } from '@/lib/salesforce';

/**
 * PATCH /api/training/meeting-link
 * Updates or regenerates meeting link for a training session
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      merchantId,
      trainerEmail,
      action,  // 'update' or 'regenerate'
      newMeetingLink,  // For manual update
      trainingDate,  // Required for regenerate
      trainingStartTime,
      trainingEndTime,
    } = body;

    // Validate required fields
    if (!merchantId || !trainerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: merchantId, trainerEmail' },
        { status: 400 }
      );
    }

    // Initialize services
    const larkService = new LarkService(process.env.LARK_ACCESS_TOKEN || '');
    const salesforce = new SalesforceService();

    let meetingLink: string;

    if (action === 'regenerate') {
      // Regenerate meeting link using Lark VC API
      if (!trainingDate || !trainingStartTime || !trainingEndTime) {
        return NextResponse.json(
          { error: 'Training date and time required for regeneration' },
          { status: 400 }
        );
      }

      // Get merchant info for meeting details
      const merchantData = await salesforce.getMerchant(merchantId);

      // Get trainer Lark user ID
      const trainerUserId = await larkService.getUserIdFromEmail(trainerEmail);

      if (!trainerUserId) {
        return NextResponse.json(
          { error: 'Could not find trainer Lark user ID' },
          { status: 404 }
        );
      }

      // Create new VC meeting
      const startDateTime = new Date(`${trainingDate}T${trainingStartTime}`);
      const endDateTime = new Date(`${trainingDate}T${trainingEndTime}`);
      const startTimestamp = Math.floor(startDateTime.getTime() / 1000);
      const endTimestamp = Math.floor(endDateTime.getTime() / 1000);

      const vcMeeting = await larkService.createVideoConferenceMeeting(
        `Remote Training: ${merchantData.name}`,
        startTimestamp,
        endTimestamp,
        trainerUserId,
        `Remote training session for ${merchantData.name}`
      );

      meetingLink = vcMeeting.meetingLink;

    } else if (action === 'update') {
      // Manual update
      if (!newMeetingLink) {
        return NextResponse.json(
          { error: 'New meeting link required for manual update' },
          { status: 400 }
        );
      }

      // Validate URL format
      try {
        new URL(newMeetingLink);
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid meeting link URL' },
          { status: 400 }
        );
      }

      meetingLink = newMeetingLink;

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "update" or "regenerate"' },
        { status: 400 }
      );
    }

    // Update Salesforce (Onboarding_Portal__c object)
    await salesforce.updateOnboardingPortal(merchantId, {
      Remote_Training_Meeting_Link__c: meetingLink,
    });

    // TODO: Also update Lark calendar event description with new link
    // This requires fetching event ID from Salesforce and calling Lark API

    return NextResponse.json({
      success: true,
      meetingLink,
    });

  } catch (error) {
    console.error('Error updating meeting link:', error);
    return NextResponse.json(
      {
        error: 'Failed to update meeting link',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

### Step 5.2: Create Meeting Link Edit Component

**File**: Create `/Users/nezobenardi/AI_stuff/OnboardingPortal/components/MeetingLinkEditor.tsx`

```typescript
'use client';

import { useState } from 'react';

interface MeetingLinkEditorProps {
  merchantId: string;
  currentMeetingLink: string | null;
  trainerEmail: string;
  trainingDate?: string;
  trainingStartTime?: string;
  trainingEndTime?: string;
  onUpdate: (newLink: string) => void;
}

export default function MeetingLinkEditor({
  merchantId,
  currentMeetingLink,
  trainerEmail,
  trainingDate,
  trainingStartTime,
  trainingEndTime,
  onUpdate,
}: MeetingLinkEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newLink, setNewLink] = useState(currentMeetingLink || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleManualUpdate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/training/meeting-link', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          trainerEmail,
          action: 'update',
          newMeetingLink: newLink,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update meeting link');
      }

      const data = await response.json();
      onUpdate(data.meetingLink);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!trainingDate || !trainingStartTime || !trainingEndTime) {
      setError('Training date and time information missing');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/training/meeting-link', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          trainerEmail,
          action: 'regenerate',
          trainingDate,
          trainingStartTime,
          trainingEndTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate meeting link');
      }

      const data = await response.json();
      onUpdate(data.meetingLink);
      setNewLink(data.meetingLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="text-sm text-gray-600 hover:text-gray-800 underline"
      >
        Edit Link
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 border border-gray-200 rounded-md bg-gray-50">
      <div className="space-y-3">
        {/* Manual input */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Meeting Link
          </label>
          <input
            type="url"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="https://vc.larksuite.com/j/..."
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualUpdate}
            disabled={isLoading || !newLink}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Link'}
          </button>

          <button
            onClick={handleRegenerate}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Regenerating...' : 'Regenerate Link'}
          </button>

          <button
            onClick={() => {
              setIsEditing(false);
              setNewLink(currentMeetingLink || '');
              setError(null);
            }}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>

        {/* Help text */}
        <p className="text-xs text-gray-500">
          You can manually enter a meeting link or regenerate a new Lark VC link.
        </p>
      </div>
    </div>
  );
}
```

### Step 5.3: Integrate Editor into Details Page

**File**: `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/merchant/[merchantId]/details/page.tsx`

**Import component:**

```typescript
import MeetingLinkEditor from '@/components/MeetingLinkEditor';
```

**Add state for meeting link updates:**

```typescript
const [meetingLink, setMeetingLink] = useState(trainer.remoteTrainingMeetingLink);
```

**Update meeting link display section:**

```typescript
{/* NEW: Meeting Link (Remote Training Only) */}
{trainer.serviceType === 'remote' && (
  <div>
    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
      Training Meeting Link
    </div>
    <div className="text-sm">
      {meetingLink ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <a
              href={meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
              Join Training
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(meetingLink || '');
                alert('Meeting link copied to clipboard!');
              }}
              className="text-gray-500 hover:text-gray-700 p-1"
              title="Copy meeting link"
            >
              {/* Copy icon SVG */}
            </button>
          </div>

          {/* Add editor component */}
          <MeetingLinkEditor
            merchantId={merchantId}
            currentMeetingLink={meetingLink}
            trainerEmail={trainer.csmEmail}
            trainingDate={trainer.trainingDate}
            trainingStartTime={trainer.trainingStartTime}
            trainingEndTime={trainer.trainingEndTime}
            onUpdate={(newLink) => setMeetingLink(newLink)}
          />
        </div>
      ) : (
        <span className="text-gray-400 italic">
          Link will be generated when training is booked
        </span>
      )}
    </div>
  </div>
)}
```

### Step 5.4: Add Authorization Check

**File**: `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/api/training/meeting-link/route.ts`

**Add at the beginning of the PATCH handler:**

```typescript
// Verify user is authorized (trainer or admin)
// TODO: Implement proper auth check based on your auth system
// Example:
// const session = await getServerSession(authOptions);
// if (!session || !isAuthorized(session.user, trainerEmail)) {
//   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
// }
```

### Step 5.5: Testing Trainer Edit

**Test Cases:**

1. **Manual Link Update:**
```bash
# As trainer, go to details page
# Click "Edit Link" button
# Enter custom meeting link
# Click "Save Link"
# Verify:
# ✅ Link updated in UI
# ✅ Link saved to Salesforce
# ✅ Success message shown
```

2. **Regenerate Link:**
```bash
# Click "Edit Link" button
# Click "Regenerate Link"
# Verify:
# ✅ New Lark VC link generated
# ✅ Link updated in UI and Salesforce
# ✅ Old link replaced
```

3. **Validation:**
```bash
# Try to save invalid URL
# Verify error message shown
# Try to regenerate without date/time
# Verify error message shown
```

---

## Phase 6: Rescheduling Updates

### Step 6.1: Update Reschedule API Route

**File**: `/Users/nezobenardi/AI_stuff/OnboardingPortal/app/api/lark/reschedule-training/route.ts`

**Location**: Find the Salesforce update section (around line 200-300)

**Current rescheduling flow:**
1. Delete old calendar event
2. Create new calendar event
3. Update Salesforce with new date/time

**Updated flow (preserve meeting link):**

```typescript
// Get existing training data including meeting link
const existingTrainingData = await salesforce.getMerchant(merchantId);
const existingMeetingLink = existingTrainingData.trainingMeetingLink;
const serviceType = detectServiceType(existingTrainingData.onboardingServicesBought);

// Delete old event
await larkService.deleteEvent(oldEventId, trainerCalendarId);

// Create new event
const newEventId = await larkService.bookTraining(
  merchantInfo,
  trainerEmail,
  trainerCalendarId,
  newDate,
  newStartTime,
  newEndTime,
  'training',
  trainerName,
  existingMeetingLink  // ← PRESERVE EXISTING MEETING LINK
);

// Update Salesforce with new details
const updateData: any = {
  Training_Date__c: newDate,
  Training_Event_ID__c: newEventId,
  // ... other fields
};

// IMPORTANT: Preserve meeting link
if (existingMeetingLink) {
  updateData.Remote_Training_Meeting_Link__c = existingMeetingLink;
  console.log('✅ Preserved existing meeting link during reschedule');
}

await salesforce.updateOnboardingPortal(merchantId, updateData);
```

**Alternative approach: Update VC meeting time (if using reservation IDs):**

```typescript
// If you stored VC reservation ID in Salesforce
if (serviceType === 'remote' && vcReservationId) {
  try {
    // Update VC meeting time instead of creating new one
    const startDateTime = new Date(`${newDate}T${newStartTime}`);
    const endDateTime = new Date(`${newDate}T${newEndTime}`);
    const endTimestamp = Math.floor(endDateTime.getTime() / 1000);

    await larkService.updateVideoConferenceMeeting(
      vcReservationId,
      {
        endTime: endTimestamp,
        topic: `Remote Training: ${merchantInfo.name} (Rescheduled)`,
      }
    );

    console.log('✅ Updated VC meeting time');
  } catch (error) {
    console.error('Failed to update VC meeting time:', error);
    // Continue with reschedule even if VC update fails
  }
}
```

### Step 6.2: Handle Service Type Changes

**Scenario**: Training changed from onsite to remote (or vice versa)

**Add logic to detect service type changes:**

```typescript
// Check if service type changed
const oldServiceType = detectServiceType(existingTrainingData.onboardingServicesBought);
const newServiceType = detectServiceType(newMerchantInfo.onboardingServicesBought);

if (oldServiceType !== newServiceType) {
  console.log(`Service type changed: ${oldServiceType} → ${newServiceType}`);

  if (newServiceType === 'remote' && !existingMeetingLink) {
    // Changed to remote but no meeting link exists - create one
    const trainerUserId = await larkService.getUserIdFromEmail(trainerEmail);

    if (trainerUserId) {
      const startDateTime = new Date(`${newDate}T${newStartTime}`);
      const endDateTime = new Date(`${newDate}T${newEndTime}`);
      const startTimestamp = Math.floor(startDateTime.getTime() / 1000);
      const endTimestamp = Math.floor(endDateTime.getTime() / 1000);

      const vcMeeting = await larkService.createVideoConferenceMeeting(
        `Remote Training: ${merchantInfo.name}`,
        startTimestamp,
        endTimestamp,
        trainerUserId,
        'Remote training session'
      );

      updateData.Remote_Training_Meeting_Link__c = vcMeeting.meetingLink;
      console.log('✅ Created meeting link for newly remote training');
    }
  } else if (newServiceType === 'onsite' && existingMeetingLink) {
    // Changed to onsite - clear meeting link
    updateData.Remote_Training_Meeting_Link__c = null;
    console.log('✅ Cleared meeting link for newly onsite training');
  }
}
```

### Step 6.3: Testing Rescheduling

**Test Cases:**

1. **Reschedule Remote Training (Same Service Type):**
```bash
# Reschedule a remote training to new date/time
# Verify:
# ✅ New calendar event created
# ✅ Meeting link preserved (same link)
# ✅ Link still works
# ✅ Salesforce updated with preserved link
```

2. **Change Onsite → Remote:**
```bash
# Reschedule and change service type to remote
# Verify:
# ✅ Meeting link generated
# ✅ Link shown in portal
# ✅ Calendar event includes link
```

3. **Change Remote → Onsite:**
```bash
# Reschedule and change service type to onsite
# Verify:
# ✅ Meeting link cleared/removed
# ✅ No link shown in portal
# ✅ Calendar event has no meeting link
```

---

## Testing Checklist

### End-to-End Testing

#### Remote Training - Full Flow

- [ ] **Booking:**
  - [ ] Select merchant with "Remote Training" service
  - [ ] Book training with available remote trainer
  - [ ] Meeting link auto-generated (Lark VC)
  - [ ] Link saved to Salesforce `Remote_Training_Meeting_Link__c`
  - [ ] Link included in Lark calendar event description
  - [ ] Confirmation shown with meeting link

- [ ] **Portal Display:**
  - [ ] Blue "Remote Training" badge visible
  - [ ] Meeting link displayed with "Join Training" button
  - [ ] Copy button copies link to clipboard
  - [ ] Link opens in new tab (Lark VC)
  - [ ] No location information shown

- [ ] **Trainer Editing:**
  - [ ] "Edit Link" button visible
  - [ ] Can manually update link
  - [ ] Can regenerate new Lark VC link
  - [ ] Changes saved to Salesforce
  - [ ] UI updates immediately

- [ ] **Rescheduling:**
  - [ ] Reschedule remote training
  - [ ] Meeting link preserved
  - [ ] New calendar event includes link
  - [ ] Portal still shows correct link

#### Onsite Training - Full Flow

- [ ] **Booking:**
  - [ ] Select merchant with "Onsite Training" service
  - [ ] Book training with location-appropriate trainer
  - [ ] No meeting link generated
  - [ ] Salesforce `Remote_Training_Meeting_Link__c` remains null
  - [ ] Calendar event has location info, no meeting link

- [ ] **Portal Display:**
  - [ ] Green "Onsite Training" badge visible
  - [ ] Location information displayed
  - [ ] No meeting link field shown
  - [ ] Merchant address visible

- [ ] **Rescheduling:**
  - [ ] Reschedule onsite training
  - [ ] Still no meeting link
  - [ ] Location info preserved

#### Edge Cases

- [ ] **VC API Failure:**
  - [ ] Booking continues even if VC creation fails
  - [ ] Error logged but not thrown
  - [ ] Can manually add link later via editor

- [ ] **Invalid Meeting Link:**
  - [ ] Editor validates URL format
  - [ ] Shows error for invalid URLs
  - [ ] Prevents saving bad links

- [ ] **Missing Trainer Lark User ID:**
  - [ ] Handles gracefully when trainer not in Lark
  - [ ] Shows appropriate error message
  - [ ] Allows manual link entry

- [ ] **Service Type Change:**
  - [ ] Onsite → Remote creates meeting link
  - [ ] Remote → Onsite removes meeting link
  - [ ] Portal updates correctly

#### Cross-Browser Testing

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Mobile Safari (iOS)
- [ ] Chrome (Android)

#### Performance Testing

- [ ] Page load time acceptable with meeting link
- [ ] API response time < 3 seconds for VC creation
- [ ] No UI lag when copying link
- [ ] Concurrent bookings handle VC API rate limits

---

## Troubleshooting

### Common Issues

#### 1. "Lark VC API error: 99991401"
**Problem**: Insufficient permissions

**Solution:**
- Check app has `vc:reserve:write` permission
- Request admin approval for permissions
- Verify tenant access token has correct scopes

#### 2. "Could not get trainer Lark user ID"
**Problem**: Trainer email not found in Lark

**Solution:**
- Verify trainer email matches Lark account
- Check trainer has Lark account activated
- Use manual meeting link entry as fallback

#### 3. Meeting link not showing in portal
**Problem**: Salesforce field not synced

**Solutions:**
- Check Salesforce query includes `Remote_Training_Meeting_Link__c`
- Verify field-level security allows read access
- Check API response includes `remoteTrainingMeetingLink` or similar
- Check field is queried from `Onboarding_Portal__c` object
- Clear cache and refresh page

#### 4. "Meeting link copied" alert not showing
**Problem**: Clipboard API not working

**Solutions:**
- Check browser permissions for clipboard access
- Use HTTPS (required for clipboard API)
- Add fallback for browsers without clipboard API:

```typescript
onClick={() => {
  try {
    navigator.clipboard.writeText(meetingLink || '');
    alert('Copied!');
  } catch (err) {
    // Fallback: select and copy manually
    const input = document.createElement('input');
    input.value = meetingLink || '';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    alert('Copied!');
  }
}}
```

#### 5. VC meeting creation times out
**Problem**: Network issues or API rate limits

**Solutions:**
- Increase fetch timeout
- Implement retry logic with exponential backoff
- Check Lark API status page
- Add error handling for timeouts

#### 6. Meeting link in calendar description not clickable
**Problem**: Lark doesn't auto-link URLs in description

**Solutions:**
- Lark should auto-detect URLs, but formatting helps
- Ensure meeting link is on its own line
- Add clear labeling: "JOIN MEETING: https://..."

---

## Rollback Plan

If issues arise in production:

### Quick Rollback

1. **Disable VC creation temporarily:**
```typescript
// In book-training/route.ts
const ENABLE_VC_CREATION = false;  // Set to false

if (ENABLE_VC_CREATION && isRemoteTraining) {
  // ... VC creation code
}
```

2. **Hide meeting link from portal:**
```typescript
// In details page
const SHOW_MEETING_LINK = false;  // Set to false

{SHOW_MEETING_LINK && trainer.serviceType === 'remote' && (
  // ... meeting link display
)}
```

3. **Revert Salesforce query:**
- Remove `Remote_Training_Meeting_Link__c` from query
- System will function without meeting links

### Full Rollback

Use git to revert changes:
```bash
git revert [commit-hash-of-feature]
git push origin main
```

Then:
1. Redeploy application
2. Clear meeting link data from Salesforce (optional)
3. Inform users meeting links temporarily unavailable

---

## Future Enhancements

Consider these improvements after initial implementation:

### Phase 7+: Additional Features

1. **Email Notifications:**
   - Send meeting link in booking confirmation email
   - Include in training reminder emails
   - Send updated link if regenerated

2. **SMS Notifications:**
   - Send meeting link via SMS to merchant phone
   - Include in training day reminder SMS

3. **Meeting Recording:**
   - Auto-record remote training sessions
   - Store recordings in Salesforce or file storage
   - Share recordings with merchant after training

4. **Analytics:**
   - Track meeting link click-through rate
   - Monitor actual meeting join rate
   - Alert if merchant doesn't join within 5 mins of start

5. **Calendar Sync:**
   - Add meeting link to merchant's Google Calendar
   - Sync to Outlook if merchant uses it
   - Add to merchant's phone calendar

6. **Multi-Language Support:**
   - Translate "Join Training" button text
   - Localize meeting link labels
   - Support different date/time formats

7. **Meeting Link Expiry:**
   - Warn if meeting link about to expire
   - Auto-regenerate expiring links
   - Archive expired links for audit trail

8. **Zoom/Teams Integration:**
   - Support multiple VC platforms
   - Let trainer choose platform
   - Auto-generate based on trainer preference

---

## Documentation Updates

After implementation, update these docs:

1. **User Manual** (`USER_MANUAL.md`):
   - Add section on remote training meeting links
   - Include screenshots of meeting link display
   - Document trainer editing process

2. **System Documentation** (`SYSTEM_DOCUMENTATION.md`):
   - Document Lark VC API integration
   - Add meeting link architecture diagram
   - Update Salesforce field mappings

3. **API Documentation**:
   - Document `/api/training/meeting-link` endpoint
   - Include request/response examples
   - Document error codes

4. **Trainer Onboarding Guide**:
   - How to view meeting links
   - How to edit/regenerate links
   - What to do if link not working

---

## Success Criteria

Implementation is complete when:

✅ Remote training bookings auto-generate Lark VC meeting links
✅ Meeting links stored in Salesforce `Onboarding_Portal__c.Remote_Training_Meeting_Link__c`
✅ Meeting links displayed in portal for remote training
✅ Meeting links included in Lark calendar events
✅ Trainers can edit/regenerate meeting links
✅ Onsite training shows NO meeting links
✅ Rescheduling preserves meeting links
✅ All test cases pass
✅ Documentation updated
✅ No errors in production logs

---

## Support & Resources

- **Lark VC API Docs**: https://open.larksuite.com/document/server-docs/vc-v1/reserve/create
- **Lark Developer Console**: https://open.larksuite.com/app
- **Salesforce Workbench**: https://workbench.developerforce.com/
- **Project Repo**: [Your repo URL]
- **Issue Tracker**: [Your issue tracker URL]

---

## Implementation Timeline

**Estimated Time**: 2-3 days

- **Day 1 Morning**: Phase 1-2 (Salesforce + Lark VC API)
- **Day 1 Afternoon**: Phase 3 (Booking Flow)
- **Day 2 Morning**: Phase 4 (Portal Display)
- **Day 2 Afternoon**: Phase 5 (Trainer Edit)
- **Day 3 Morning**: Phase 6 (Rescheduling)
- **Day 3 Afternoon**: Testing & Documentation

---

**Document Version**: 1.0
**Last Updated**: 2025-11-12
**Author**: Development Team
