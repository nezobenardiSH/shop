# Simplified VC OAuth Implementation Plan
## Extending Existing OAuth to Include VC Permissions

**Created**: 2025-11-17
**Approach**: Update existing OAuth scope, trainers re-authorize once
**Estimated Time**: 2-3 hours (much simpler than original 8-hour plan!)

---

## 🎯 Overview

### What We're Doing
Extending your existing OAuth system to include VC permissions. Trainers who are already authorized will need to re-authorize once to get the new VC permissions.

### Why This is Simpler
✅ Reuse existing OAuth infrastructure
✅ Reuse existing `getValidAccessToken()` auto-refresh
✅ Reuse existing trainer authorization pages
✅ No new Salesforce fields needed
✅ No new database schema changes needed (using existing Prisma)

---

## 📋 Phase-by-Phase Implementation

### **PHASE 1: Update OAuth Scope** ⏱️ 15 minutes

**Goal**: Add VC permissions to existing OAuth scope

#### Task 1.1: Update OAuth scope in `lib/lark-oauth-service.ts`

**File**: `lib/lark-oauth-service.ts`
**Line**: 74

**Current**:
```typescript
const scope = 'calendar:calendar calendar:calendar.event:create calendar:calendar.event:read calendar:calendar.event:update calendar:calendar.event:delete calendar:calendar.free_busy:read bitable:app contact:contact.base:readonly'
```

**Change to**:
```typescript
const scope = 'calendar:calendar calendar:calendar.event:create calendar:calendar.event:read calendar:calendar.event:update calendar:calendar.event:delete calendar:calendar.free_busy:read bitable:app contact:contact.base:readonly vc:reserve vc:reserve:readonly'
```

#### Task 1.2: Update Lark App Configuration

1. Go to **Lark Developer Console** → Your App → **Permissions & Scopes**
2. Search for and add:
   - `vc:reserve` (Create/update/delete meetings)
   - `vc:reserve:readonly` (Read meeting details)
3. Request admin approval (if required)
4. Wait for approval before testing

#### Verification:
```bash
# After code change, restart dev server
npm run dev

# Visit trainer authorization page
# Check browser console - should see VC permissions in OAuth URL
```

**Success Criteria**:
✅ OAuth scope includes `vc:reserve` and `vc:reserve:readonly`
✅ Lark app has VC permissions approved
✅ Authorization URL includes VC permissions

---

### **PHASE 2: Update Authorization UI** ⏱️ 15 minutes

**Goal**: Update trainer/manager/installer authorization pages to mention VC permissions

#### Task 2.1: Update trainer authorization page

**File**: `app/trainers/authorize/page.tsx`
**Line**: 139 (in "How It Works" section)

**Add after line 145**:
```typescript
<li className="flex gap-2">
  <span className="font-semibold text-[#ff630f]">5.</span>
  For remote training, system will automatically create Lark VC meeting links
</li>
```

#### Task 2.2: Update authorization description

**File**: `app/trainers/authorize/page.tsx`
**Line**: 86

**Change**:
```typescript
Authorize trainers to connect their Lark calendars for automatic scheduling
```

**To**:
```typescript
Authorize trainers to connect their Lark calendars and enable VC meeting creation for remote training
```

#### Similar updates for managers and installers (optional)
If managers/installers also need VC permissions, make similar updates to:
- `app/managers/authorize/page.tsx`
- `app/installers/authorize/page.tsx`

#### Verification:
```bash
# Visit trainer authorization page
# Check that instructions mention VC permissions
http://localhost:3010/trainers/authorize
```

**Success Criteria**:
✅ Authorization page mentions VC meeting creation
✅ Instructions updated to reflect new permissions

---

### **PHASE 3: Create VC Meeting Function Using Existing OAuth** ⏱️ 45 minutes

**Goal**: Add VC meeting creation method that uses existing OAuth tokens

#### Task 3.1: Add VC helper method to LarkService

**File**: `lib/lark.ts`
**Add after existing methods** (around line 1663)

```typescript
/**
 * Create Lark VC meeting using trainer's user access token
 * @param trainerEmail - Trainer's email to get their OAuth token
 * @param title - Meeting title
 * @param startTime - Meeting start time (Unix timestamp in seconds)
 * @param endTime - Meeting end time (Unix timestamp in seconds)
 * @param description - Optional meeting description
 * @returns Meeting link and reservation ID
 */
async createVCMeetingWithTrainerAuth(
  trainerEmail: string,
  title: string,
  startTime: number,
  endTime: number,
  description?: string
): Promise<{ meetingLink: string; reservationId: string } | null> {
  try {
    // Import existing OAuth service
    const { larkOAuthService } = await import('./lark-oauth-service');

    // Get valid access token (auto-refreshes if needed!)
    const userAccessToken = await larkOAuthService.getValidAccessToken(trainerEmail);

    if (!userAccessToken) {
      console.warn(`⚠️ Trainer ${trainerEmail} has not authorized Lark`);
      return null;
    }

    console.log(`🎥 Creating VC meeting using ${trainerEmail}'s OAuth token...`);

    // Create VC meeting using user access token
    const response = await fetch(
      'https://open.larksuite.com/open-apis/vc/v1/reserve/apply',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          end_time: endTime.toString(),
          meeting_settings: {
            topic: title,
            description: description || '',
            auto_record: false,
          },
        }),
      }
    );

    const responseText = await response.text();

    // Try to parse JSON response
    let vcData;
    try {
      vcData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse VC API response:', responseText);
      throw new Error('VC API returned invalid response');
    }

    if (!response.ok || vcData.code !== 0) {
      console.error('❌ VC API error:', vcData);
      throw new Error(vcData.msg || `VC API failed with status ${response.status}`);
    }

    // Extract meeting link and reservation ID
    const meetingLink = vcData.data?.reserve?.meeting_no
      ? `https://vc.larksuite.com/j/${vcData.data.reserve.meeting_no}`
      : vcData.data?.reserve?.url;

    const reservationId = vcData.data?.reserve?.id;

    if (!meetingLink) {
      throw new Error('No meeting link in VC API response');
    }

    console.log('✅ VC meeting created:', meetingLink);

    return {
      meetingLink,
      reservationId: reservationId || '',
    };

  } catch (error: any) {
    console.error('❌ Failed to create VC meeting:', error.message);
    return null;
  }
}
```

#### Verification:
```bash
# Code compiles without errors
npm run dev
```

**Success Criteria**:
✅ New method added to LarkService
✅ Uses existing OAuth service
✅ Auto-refresh handled by `getValidAccessToken()`
✅ No TypeScript errors

---

### **PHASE 4: Update Booking Flow to Use VC Creation** ⏱️ 30 minutes

**Goal**: Call VC creation in booking flow for remote training

#### Task 4.1: Update booking route to create VC meetings

**File**: `app/api/lark/book-training/route.ts`
**Location**: Around line 421-481 (existing VC creation code)

**Replace existing VC creation code** with:

```typescript
let meetingLink: string | null = null;
let vcReservationId: string | null = null;
const isRemoteTraining = serviceType === 'remote';

if (isRemoteTraining && !mockMode && bookingType === 'training') {
  try {
    console.log('🎥 Creating Lark VC meeting for remote training...');

    // Use new method that leverages existing OAuth
    const vcMeeting = await larkService.createVCMeetingWithTrainerAuth(
      trainer.email,
      `Remote Training: ${merchantName}`,
      Math.floor(new Date(`${date}T${startTime}`).getTime() / 1000),
      Math.floor(new Date(`${date}T${endTime}`).getTime() / 1000),
      `Remote training session for ${merchantName}\nDate: ${date}\nTime: ${startTime} - ${endTime}`
    );

    if (vcMeeting) {
      meetingLink = vcMeeting.meetingLink;
      vcReservationId = vcMeeting.reservationId;
      console.log('✅ Lark VC meeting created:', meetingLink);
    } else {
      console.warn('⚠️ Could not create VC meeting - trainer may not have authorized Lark');
      // Booking still succeeds, just without meeting link
    }

  } catch (vcError: any) {
    console.error('❌ Failed to create Lark VC meeting:', vcError.message);
    // Don't fail entire booking if VC creation fails
  }
}

// Rest of booking flow continues...
// Meeting link saved to Salesforce if exists (existing code at line 796-800)
```

#### Verification:
```bash
# Start dev server
npm run dev

# Book remote training with authorized trainer
# Check logs for "✅ Lark VC meeting created"
# Check Salesforce for meeting link
```

**Success Criteria**:
✅ VC meeting created for remote training
✅ Meeting link saved to Salesforce
✅ Booking succeeds even if VC creation fails
✅ Works with existing OAuth auto-refresh

---

### **PHASE 5: Trainer Re-authorization Flow** ⏱️ 30 minutes

**Goal**: Handle trainers who need to re-authorize with new VC scope

#### Task 5.1: Add re-authorization notification

**File**: `app/trainers/authorize/page.tsx`
**Add after line 88** (after the description):

```typescript
{/* Re-authorization Notice */}
<div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
  <p className="text-sm text-blue-800 font-semibold mb-2">
    🔄 New Feature: Remote Training VC Meeting Links
  </p>
  <p className="text-sm text-blue-700">
    If you previously authorized, please re-authorize to enable automatic
    Lark VC meeting link creation for remote training sessions.
  </p>
</div>
```

#### Task 5.2: Update Prisma schema to track VC scope (optional)

**File**: `prisma/schema.prisma`

**Add field to LarkAuthToken model**:
```prisma
model LarkAuthToken {
  // ... existing fields ...
  scopes      String?  // Track which scopes this token has
  hasVCScope  Boolean  @default(false)  // Quick flag for VC permissions
}
```

**Run migration**:
```bash
npx prisma migrate dev --name add_vc_scope_tracking
```

#### Task 5.3: Check VC scope when creating meetings (defensive)

**File**: `lib/lark.ts` (in new `createVCMeetingWithTrainerAuth` method)

**Add after getting access token**:
```typescript
// Optional: Check if trainer has VC scope
// If not, return null and log warning
const tokenRecord = await prisma.larkAuthToken.findUnique({
  where: { userEmail: trainerEmail }
});

if (tokenRecord && !tokenRecord.hasVCScope) {
  console.warn(`⚠️ Trainer ${trainerEmail} authorized without VC scope - needs re-authorization`);
  return null;
}
```

#### Verification:
```bash
# Visit trainer authorization page
# Check re-authorization notice is displayed
# Re-authorize as a trainer
# Check database - hasVCScope should be true
```

**Success Criteria**:
✅ Re-authorization notice displayed
✅ Trainers can re-authorize with new scope
✅ System tracks which trainers have VC permissions

---

### **PHASE 6: Admin Monitoring (Optional)** ⏱️ 15 minutes

**Goal**: Add simple indicator to show which trainers have VC permissions

#### Task 6.1: Update trainer status display

**File**: `app/trainers/authorize/page.tsx`
**Line**: 186-210 (trainer list item)

**Add after line 208**:
```typescript
{trainer.authorized && (
  <p className="text-xs text-gray-500 mt-1">
    {/* Check if scopes include VC permissions */}
    {trainer.scopes?.includes('vc:reserve') ? (
      <span className="text-green-600">✓ VC permissions enabled</span>
    ) : (
      <span className="text-yellow-600">⚠️ Needs re-authorization for VC</span>
    )}
  </p>
)}
```

#### Task 6.2: Update authorization status API to include VC info

**File**: `app/api/trainers/authorization-status/route.ts`

**Add VC scope info to response**:
```typescript
// In the response mapping, add scopes field
return NextResponse.json({
  trainers: tokens.map(t => ({
    email: t.userEmail,
    name: t.userName,
    calendarId: t.calendarId,
    authorized: true,
    scopes: t.scopes,  // Add this
    hasVCScope: t.hasVCScope || false,  // Add this
  }))
});
```

#### Verification:
```bash
# Visit trainer authorization page
# Check trainer list shows VC permission status
# Trainers with old authorization should show "Needs re-authorization"
# Trainers with new authorization should show "VC permissions enabled"
```

**Success Criteria**:
✅ Admin can see which trainers have VC permissions
✅ Clear indicator for trainers needing re-authorization

---

## 🧪 End-to-End Testing

### Test 1: New Trainer Authorization with VC

1. **Setup**: New trainer, never authorized before
2. **Steps**:
   - Visit `/trainers/authorize`
   - Click "Authorize with Lark"
   - Login to Lark
   - Approve permissions (includes VC now)
   - Redirected back
3. **Expected**:
   - ✅ Authorization successful
   - ✅ Database record has `hasVCScope = true`
   - ✅ Trainer shows "VC permissions enabled"

### Test 2: Existing Trainer Re-authorization

1. **Setup**: Trainer authorized before VC scope was added
2. **Steps**:
   - Visit `/trainers/authorize`
   - See notice: "Please re-authorize for VC"
   - Click "Authorize with Lark" again
   - Approve new permissions
   - Redirected back
3. **Expected**:
   - ✅ Re-authorization successful
   - ✅ Database updated: `hasVCScope = true`
   - ✅ Old refresh token replaced with new one

### Test 3: Remote Training Booking with VC

1. **Setup**: Trainer has VC permissions
2. **Steps**:
   - Merchant books remote training with this trainer
   - Wait for booking to complete
3. **Expected**:
   - ✅ Booking succeeds
   - ✅ VC meeting created
   - ✅ Meeting link in Salesforce
   - ✅ Meeting link displayed in portal
   - ✅ Calendar event includes meeting link
   - ✅ No store address in calendar event

### Test 4: Remote Training Booking WITHOUT VC Authorization

1. **Setup**: Trainer has NOT authorized Lark (or old authorization without VC)
2. **Steps**:
   - Merchant books remote training with this trainer
   - Wait for booking to complete
3. **Expected**:
   - ✅ Booking succeeds (graceful fallback)
   - ⚠️ No VC meeting created
   - ⚠️ No meeting link in Salesforce
   - ⚠️ Portal shows "Meeting link pending trainer authorization"
   - ✅ Calendar event still created (without link)

### Test 5: Token Auto-Refresh During VC Creation

1. **Setup**: Trainer authorized 1 hour 58 minutes ago (token about to expire)
2. **Steps**:
   - Merchant books remote training
   - System calls `getValidAccessToken(trainer.email)`
   - Token within 5-minute expiry buffer
3. **Expected**:
   - ✅ Token auto-refreshed (existing code handles this!)
   - ✅ New token used to create VC meeting
   - ✅ VC meeting created successfully
   - ✅ Database updated with new token expiration
   - ✅ Trainer unaware of refresh (seamless)

---

## 📝 Migration Plan for Existing Trainers

### Communication Template

**Email to trainers**:

```
Subject: Action Required - Authorize Remote Training VC Meetings

Hi [Trainer Name],

We've added a new feature that automatically creates Lark VC meeting links
when you're booked for remote training sessions!

To enable this feature, please re-authorize your Lark account:

1. Visit: [Authorization URL]
2. Click "Authorize with Lark"
3. Approve the new permissions

This is a one-time step. Once completed, all your remote training bookings
will automatically include Lark VC meeting links.

Questions? Contact [Support Contact]

Thanks!
```

### Rollout Strategy

**Week 1**:
- Deploy code changes
- Test with 1-2 pilot trainers
- Verify VC meetings work correctly

**Week 2**:
- Send email to all trainers
- Monitor re-authorization rate
- Provide support for questions

**Week 3**:
- Follow up with trainers who haven't re-authorized
- Track VC meeting creation success rate

**Week 4**:
- All trainers re-authorized
- Full VC feature deployment complete

---

## 🎯 Summary

### What Changed
- ✅ OAuth scope includes VC permissions
- ✅ Trainers re-authorize once (one-time)
- ✅ Existing auto-refresh continues working
- ✅ VC meetings created using trainer's OAuth token

### What Stayed the Same
- ✅ Existing OAuth infrastructure
- ✅ Existing token refresh logic
- ✅ Existing authorization pages (just updated text)
- ✅ Existing database schema (minor addition)

### Total Time Estimate
- Phase 1: 15 min (update scope)
- Phase 2: 15 min (update UI)
- Phase 3: 45 min (VC creation method)
- Phase 4: 30 min (booking integration)
- Phase 5: 30 min (re-authorization flow)
- Phase 6: 15 min (admin monitoring)
- **Total: ~2.5 hours**

**Much faster than the original 8-hour plan! 🎉**

### Ready to Execute?

All phases are ready to implement. Should I start with Phase 1?
