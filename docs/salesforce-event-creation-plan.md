# Salesforce Event Creation - Implementation Plan

## Overview
Auto-create Salesforce Events (Activities) when trainings/installations are booked via portal to track trainer KPIs.

**Architecture:** Portal → Lark (primary) → Salesforce Event (secondary, non-blocking)

---

## Research References

### Salesforce Documentation
- **Event Object Reference:** https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_event.htm
- **Event Field Reference:** https://developer.salesforce.com/docs/atlas.en-us.sfFieldRef.meta/sfFieldRef/salesforce_field_reference_Event.htm
- **WhoId vs WhatId:** https://www.salesforceben.com/what-is-the-difference-between-whoid-and-whatid/
- **REST API - Create Record:** https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_sobject_create.htm

### Library Documentation
- **JSforce:** https://jsforce.github.io/document/
- **JSforce SObject API:** https://jsforce.github.io/jsforce/doc/SObject.html

### Key Research Findings
✅ Required fields: IsAllDayEvent, IsPrivate, IsRecurrence, IsReminderSet + (StartDateTime & EndDateTime)
✅ Use OwnerId for trainer assignment (not Owner relationship)
✅ Use WhatId to link to Onboarding_Trainer__c record
✅ StartDateTime/EndDateTime auto-populate ActivityDateTime/DurationInMinutes
✅ JSforce pattern: `conn.sobject('Event').create(data)`

---

## Implementation Steps

### Phase 1: Create Salesforce Event Helper Function

**File to create:** `/lib/salesforce-events.ts`

**Task 1.1: Build Event Creation Function**
- [ ] Create `createSalesforceEvent()` helper function
- [ ] Accept parameters:
  - `subject`: Event title (string)
  - `startDateTime`: Start time in ISO format with timezone (string)
  - `endDateTime`: End time in ISO format with timezone (string)
  - `assignedToId`: Salesforce User ID (18-char ID)
  - `relatedToId`: Account/Merchant ID (18-char ID)
  - `type`: Event type - "Training" or "Installation" (string)
  - `description`: Meeting details including Lark link (string, optional)
  - `location`: Meeting location (string, optional)

**Task 1.2: Map to Salesforce Event Object**
Salesforce Event (Activity) fields:
```typescript
{
  Subject: subject,                    // Required
  StartDateTime: startDateTime,        // Required (ISO 8601 with timezone)
  EndDateTime: endDateTime,            // Required (ISO 8601 with timezone)
  OwnerId: assignedToId,              // Required (Salesforce User ID for trainer)
  WhatId: relatedToId,                // Link to Account (merchant)
  Type: type,                         // "Training" or "Installation"
  Description: description,            // Meeting link + details
  Location: location,                  // For onsite trainings
  IsAllDayEvent: false
}
```

**Task 1.3: Implement API Call**
- Use existing `getSalesforceConnection()` from `/lib/salesforce.ts`
- Call: `conn.sobject('Event').create(eventData)`
- Wrap in try-catch for error handling
- Log errors but don't throw (non-blocking)
- Return created Event ID on success, null on failure

**Success Criteria:**
- Function can be called with booking data
- Creates Event in Salesforce linked to trainer and merchant
- Returns Event ID or null
- Logs errors without throwing

---

### Phase 2: Integration - Training Bookings

**File to modify:** `/app/api/lark/book-training/route.ts`

**Task 2.1: Add Salesforce Event Creation After Lark Event**
- Location: After line 486 (after `larkService.bookTraining()` succeeds)
- Import the `createSalesforceEvent()` function
- Call it with training data

**Task 2.2: Prepare Event Data from Training Booking**
Extract from request body and Salesforce query:
```typescript
{
  subject: onboardingServicesBought === 'Onsite Training'
    ? `Onsite Training - ${merchantName}`
    : `Remote Training - ${merchantName}`,
  startDateTime: `${date}T${startTime}:00+08:00`,  // e.g., "2024-11-19T14:30:00+08:00"
  endDateTime: `${date}T${endTime}:00+08:00`,
  assignedToId: trainerUserId,         // From CSM_Name__c lookup (lines 644-712)
  relatedToId: merchantId,             // The Onboarding_Trainer__c.Id
  type: onboardingServicesBought === 'Onsite Training' ? 'Face to face' : 'Online',
  description: `
Remote Training Meeting Link: ${meetingLink}
Merchant: ${merchantName}
Contact: ${merchantContactPerson}
Phone: ${merchantPhone}
Features: ${requiredFeatures.join(', ')}
Onboarding Summary: ${onboardingSummary}
  `.trim(),
  location: onboardingServicesBought === 'Onsite Training' ? merchantAddress : null
}
```

**Task 2.3: Handle Errors Gracefully**
- Wrap in try-catch
- Log error if Event creation fails: `console.error('Failed to create Salesforce Event:', error)`
- Continue with response (don't block booking)

**Task 2.4: Store Event ID (Optional)**
- Consider adding new field to Onboarding_Portal__c: `Training_Salesforce_Event_ID__c`
- Update along with Training_Event_ID__c (lines 768-822)
- This enables future deletion/rescheduling of Salesforce Events

**Success Criteria:**
- Training bookings create Salesforce Events
- Events appear in Activity timeline
- Assigned to correct trainer
- Linked to merchant Account
- Booking succeeds even if Event creation fails

---

### Phase 3: Integration - Installation Bookings

**File to modify:** `/lib/installer-availability.ts`

**Task 3.1: Add Salesforce Event Creation After Lark Event**
- Location: After line 800 (after successful `larkService.bookTraining()` for installation)
- Import the `createSalesforceEvent()` function
- Call it with installation data

**Task 3.2: Prepare Event Data from Installation Booking**
Extract from booking data:
```typescript
{
  subject: `Installation - ${merchantName}`,
  startDateTime: `${bookingDate}T${startTime}:00+08:00`,
  endDateTime: `${bookingDate}T${endTime}:00+08:00`,
  assignedToId: installerUserId,       // Need to lookup by installer name
  relatedToId: merchantId,             // The merchant ID
  type: "Face to face",
  description: `
Installation for: ${merchantName}
Address: ${address}
Contact: ${contactName}
Phone: ${contactNumber}
Hardware Items: ${hardwareItems}
  `.trim(),
  location: address
}
```

**Task 3.3: Lookup Installer Salesforce User ID**
- Similar to trainer lookup in training flow (lines 644-712 in book-training/route.ts)
- Query: `SELECT Id FROM User WHERE Email = '${installerEmail}' LIMIT 1`
- Fallback: Search by name if email not found
- Skip Event creation if User not found (log warning)

**Task 3.4: Handle Errors Gracefully**
- Same error handling as training flow
- Log but don't throw
- Continue booking flow

**Success Criteria:**
- Installation bookings create Salesforce Events
- Events assigned to installer
- Linked to merchant
- Non-blocking on failure

---

### Phase 4: Testing & Validation

**Task 4.1: Manual Testing - Training Booking**
Test scenarios:
1. Book new remote training
   - Verify Lark event created
   - Verify Salesforce Event created
   - Check Event fields (Subject, Start/End, Assigned To, Related To)
   - Verify meeting link in Description
2. Book new onsite training
   - Verify Location field populated
   - Verify Description doesn't have meeting link
3. Reschedule existing training
   - Verify new Lark event created
   - Verify new Salesforce Event created
   - (Note: Old Salesforce Event won't be deleted automatically)

**Task 4.2: Manual Testing - Installation Booking**
Test scenarios:
1. Book new installation
   - Verify Lark event created
   - Verify Salesforce Event created
   - Check Event assigned to installer
   - Verify address in Location field
2. Reschedule installation
   - Same as training rescheduling tests

**Task 4.3: Error Scenario Testing**
1. Simulate Salesforce connection failure
   - Verify booking still succeeds
   - Verify error logged to console
2. Test with trainer not found in Salesforce
   - Verify Event creation skipped
   - Verify booking continues
3. Test with invalid date/time format
   - Verify error handled gracefully

**Task 4.4: Verify KPI Tracking**
1. Open trainer's Salesforce profile
2. Go to Activity tab
3. Verify Events appear with:
   - Correct date/time
   - Proper assignment
   - Link to merchant
   - Meeting details in Description

**Success Criteria:**
- All bookings create Events in Salesforce
- Events properly linked for KPI tracking
- Failures don't block bookings
- Error logs are clear and actionable

---

## Data Flow Diagram

```
User books via Portal
        ↓
1. Create Lark VC Meeting (remote training only)
        ↓
2. Create Lark Calendar Event ✓
        ↓
3. Update Salesforce Fields ✓ (existing)
        ↓
4. Create Salesforce Event ← NEW
   (Non-blocking, log errors)
        ↓
5. Return success to user
```

---

## Technical Specifications

### Salesforce Event Object (Activity)
- **API Name:** `Event`
- **Documentation:** https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_event.htm

### Required Fields (Salesforce Official)
- `IsAllDayEvent` (boolean) - Default: false
- `IsPrivate` (boolean) - Default: false
- `IsRecurrence` (boolean) - Default: false
- `IsReminderSet` (boolean) - Default: false

**IMPORTANT:** In practice, you must also provide EITHER:
- **Option 1:** `StartDateTime` + `EndDateTime` (RECOMMENDED)
- **Option 2:** `ActivityDateTime` + `DurationInMinutes`

When you set StartDateTime and EndDateTime, Salesforce automatically populates ActivityDateTime and DurationInMinutes.

### Fields We'll Use
- `Subject` (text, 255 chars) - Required for meaningful events
- `StartDateTime` (datetime) - ISO 8601 format with timezone
- `EndDateTime` (datetime) - ISO 8601 format with timezone
- `OwnerId` (reference to User) - Assigns event to trainer for KPI tracking
- `WhatId` (polymorphic reference) - Links to Account/Custom Object (merchant)
- `WhoId` (reference to Contact/Lead) - Optional, for linking to specific contact
- `Type` (picklist) - "Meeting" or custom value
- `Description` (long text, 32000 chars) - Meeting link + details
- `Location` (text, 255 chars) - For onsite meetings
- `IsAllDayEvent` (boolean) - Set to false

### Field Relationships (WhoId vs WhatId)
**Reference:** https://www.salesforceben.com/what-is-the-difference-between-whoid-and-whatid/

- **WhoId:** Person-related field
  - Accepts: Contact or Lead ID
  - Use for: Linking to specific person attending

- **WhatId:** Object-related field
  - Accepts: Account, Opportunity, Campaign, or Custom Object ID
  - Use for: Linking to merchant/account
  - In our case: Use `Onboarding_Trainer__c` ID (merchant record)

### DateTime Format
- **Format:** ISO 8601 with timezone
- **Example:** `2024-11-19T14:30:00+08:00`
- **Timezone:** Always Singapore (GMT+8)
- **Matches:** Existing format in Onboarding_Portal__c updates

---

## API Implementation Details

### Using JSforce Library

The codebase already uses `jsforce` for Salesforce integration. We'll follow the same pattern.

**Reference:** https://jsforce.github.io/document/

### Event Creation Code Pattern

```typescript
import { getSalesforceConnection } from './salesforce'

export async function createSalesforceEvent(params: {
  subject: string
  startDateTime: string  // ISO 8601 with timezone
  endDateTime: string    // ISO 8601 with timezone
  ownerId: string        // Salesforce User ID (18 chars)
  whatId: string         // Merchant/Account ID (18 chars)
  type?: string          // "Training" or "Installation"
  description?: string   // Meeting details
  location?: string      // Physical address for onsite
}): Promise<string | null> {
  try {
    const conn = await getSalesforceConnection()

    const eventData = {
      Subject: params.subject,
      StartDateTime: params.startDateTime,
      EndDateTime: params.endDateTime,
      OwnerId: params.ownerId,
      WhatId: params.whatId,
      Type: params.type || 'Meeting',
      Description: params.description || '',
      Location: params.location || '',
      IsAllDayEvent: false,
      IsPrivate: false,
      IsRecurrence: false,
      IsReminderSet: false
    }

    const result = await conn.sobject('Event').create(eventData)

    if (result.success) {
      console.log('Created Salesforce Event:', result.id)
      return result.id
    } else {
      console.error('Failed to create Salesforce Event:', result.errors)
      return null
    }
  } catch (error) {
    console.error('Error creating Salesforce Event:', error)
    return null
  }
}
```

### REST API Endpoint (Alternative)

If not using jsforce, the raw REST API call would be:

```bash
POST /services/data/v58.0/sobjects/Event
Host: your-instance.salesforce.com
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "Subject": "Training: Merchant Name",
  "StartDateTime": "2024-11-19T14:30:00+08:00",
  "EndDateTime": "2024-11-19T16:30:00+08:00",
  "OwnerId": "0058d000001234ABC",
  "WhatId": "a0B8d000001234ABC",
  "Type": "Meeting",
  "Description": "Meeting link and details",
  "Location": "123 Main St, Singapore",
  "IsAllDayEvent": false
}
```

**Response (Success):**
```json
{
  "id": "00U8d000001234ABC",
  "success": true,
  "errors": []
}
```

---

### Error Handling Strategy
- **Philosophy:** Fail silently, don't block bookings
- **Logging:** Console errors with full context
- **Monitoring:** Consider adding metrics/alerts later
- **Retries:** Not implemented initially (can add later)

---

## Files to Create/Modify

### New Files
1. `/lib/salesforce-events.ts` - Event creation helper

### Modified Files
1. `/app/api/lark/book-training/route.ts` - Add Event creation after Lark booking
2. `/lib/installer-availability.ts` - Add Event creation for installations

### Optional Enhancements
1. Add `Training_Salesforce_Event_ID__c` field to `Onboarding_Portal__c` object
2. Add `Installation_Salesforce_Event_ID__c` field to `Onboarding_Portal__c` object
3. Implement Event deletion/update on rescheduling

---

## Future Considerations

### Rescheduling Handling
Currently, when rescheduling:
- Old Lark event is deleted
- New Lark event is created
- Salesforce fields are updated

With Salesforce Events:
- Old Event will remain (not auto-deleted)
- New Event will be created

**Options:**
1. Keep both (shows history)
2. Delete old Event before creating new one (requires storing Event ID)
3. Update existing Event instead of creating new one

**Recommendation:** Keep both for now (audit trail). Implement deletion later if needed.

### Error Monitoring
- Add structured logging (e.g., Winston, Pino)
- Send alerts on Event creation failures
- Track success rate metrics

### Retry Logic
- Implement exponential backoff for transient Salesforce errors
- Queue failed Event creations for retry
- Use background job system (Bull, Agenda)

---

## Rollout Plan

1. **Phase 1:** Implement helper function, test in isolation
2. **Phase 2:** Integrate with training bookings, test in staging
3. **Phase 3:** Integrate with installation bookings, test in staging
4. **Phase 4:** Deploy to production with monitoring
5. **Phase 5:** Verify KPI tracking data after 1 week

---

## Success Metrics

- Salesforce Events created: 100% of bookings (best effort)
- Event creation failure rate: < 5%
- Zero booking failures due to Event creation
- Trainer KPI data completeness: Measurable improvement
- Average response time impact: < 200ms added latency

---

## Important Implementation Notes from Research

### 1. OwnerId vs Assigned To
- In the UI, "Assigned To" = OwnerId field
- OwnerId must be a valid Salesforce User ID (18 chars)
- OwnerId is polymorphic (can be User or Queue), but we'll always use User
- When creating via API, use `OwnerId` (not `Owner`)

### 2. WhatId Limitations
- WhatId accepts: Account, Opportunity, Campaign, Custom Objects
- **For our case:** Use `Onboarding_Trainer__c` ID (the merchant record)
- This links the Event to the merchant in the Activity timeline

### 3. StartDateTime vs ActivityDateTime
- **Use StartDateTime + EndDateTime** (preferred, more intuitive)
- Salesforce auto-calculates ActivityDateTime and DurationInMinutes
- Do NOT manually set ActivityDateTime (let Salesforce handle it)

### 4. Timezone Handling
- Salesforce accepts ISO 8601 format with timezone offset
- Must include timezone: `2024-11-19T14:30:00+08:00` ✓
- Without timezone will default to org timezone (risky)

### 5. Type Field Values
- Type is a picklist field
- Common values: "Call", "Meeting", "Email"
- Can use custom values if configured in org
- Default to "Meeting" for safety

### 6. Event Visibility
- IsPrivate = false (default) - Event visible to others with access
- IsPrivate = true - Only owner sees details
- For KPI tracking, keep as false

---

## Questions for Clarification

1. Should we delete old Salesforce Events when rescheduling, or keep as history?
2. Do we need to track Event creation success rate?
3. Should Events be editable by trainers, or read-only?
4. Are there any custom Event fields we should populate?
5. Should we batch Event creation or do it inline with booking?
6. What should the Event Type picklist value be? ("Meeting", "Training", or custom value?)
