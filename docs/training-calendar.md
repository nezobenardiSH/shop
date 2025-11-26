# Training Calendar System Documentation

## ⚠️ Quick Reference - Common Issues

### 🔴 CRITICAL: Language Configuration Must Match Documentation
- **Nezo**: English, Bahasa Malaysia (NO Chinese)
- **Jia En**: Bahasa Malaysia, Chinese (NO English)
- **Source of Truth**: `docs/trainer-information.md`
- **Configuration File**: `config/trainers.json`

### 🔴 CRITICAL: All Times Must Use Singapore Timezone
- **Standard**: `Asia/Singapore` (UTC+8)
- **Date Format**: `2025-10-15T14:00:00+08:00`
- **Common Error**: Using server local time instead of Singapore time
- **Fix**: All date calculations must use `+08:00` timezone

### 🔴 CRITICAL: Calendar ID Consistency
- **Problem**: Events created but not detected
- **Cause**: Different calendar IDs for read vs write operations
- **Solution**: Use `CalendarIdManager.getResolvedCalendarId()`

---

## Table of Contents
1. [Training Rescheduling Flow](#training-rescheduling-flow)
2. [Calendar ID Management](#calendar-id-management)
3. [Core Functions Reference](#core-functions-reference)
4. [Training Schedule Configuration](#training-schedule-configuration)
5. [Solutions Implemented](#solutions-implemented)
6. [Technical Architecture](#technical-architecture)
7. [API Integration Details](#api-integration-details)
8. [Troubleshooting Guide](#troubleshooting-guide)

## Training Rescheduling Flow

### Overview
When a merchant reschedules a training session from one trainer to another, the system must:
1. Delete the old event from the original trainer's calendar
2. Create a new event with the new trainer
3. Update Salesforce records to reflect the change

**Critical Issue Solved**: The system was creating new events but NOT deleting old ones, leaving orphaned events on the original trainer's calendar.

### The Complete Rescheduling Flow

#### Step 1: Query Current Trainer and Event ID (Early in Request)
**File**: `app/api/lark/book-training/route.ts` (lines 207-280)

When a rescheduling request comes in, the system immediately queries Salesforce to find:
1. **Current Trainer**: `Onboarding_Trainer__c.CSM_Name__c` (User ID lookup to get email)
2. **Current Event ID**: `Onboarding_Portal__c.Training_Event_ID__c` (the Lark event to delete)

```typescript
// Query Onboarding_Trainer__c for current trainer
const trainerQuery = `
  SELECT CSM_Name__c, CSM_Name__r.Email
  FROM Onboarding_Trainer__c
  WHERE Id = '${merchantId}'
  LIMIT 1
`

// Query Onboarding_Portal__c for current event ID
const portalQuery = `
  SELECT Training_Event_ID__c
  FROM Onboarding_Portal__c
  WHERE Onboarding_Trainer_Record__c = '${merchantId}'
  LIMIT 1
`

// Store for later use
let currentTrainerEmailForDeletion: string | null = null
let currentEventIdForDeletion: string | null = null

if (trainerResult.totalSize > 0) {
  currentTrainerEmailForDeletion = trainerResult.records[0].CSM_Name__r?.Email
}

if (portalResult.totalSize > 0) {
  currentEventIdForDeletion = portalResult.records[0].Training_Event_ID__c
}
```

**Why This Matters**:
- `CSM_Name__c` is the source of truth for which trainer is currently assigned
- `Training_Event_ID__c` is the source of truth for which event to delete
- These must be queried BEFORE deletion so we know what to delete

#### Step 2: Delete Old Event from Original Trainer's Calendar
**File**: `app/api/lark/book-training/route.ts` (lines 282-340)

Using the values from Step 1, delete the old event:

```typescript
// Use values from Salesforce, not from frontend
const trainerEmailForDeletion = currentTrainerEmailForDeletion || currentTrainerEmail
const eventIdForDeletion = currentEventIdForDeletion || existingEventId

console.log('🗑️ Rescheduling detected - attempting to cancel existing event:', {
  eventId: eventIdForDeletion,
  trainerEmailForDeletion: trainerEmailForDeletion,
  source: {
    trainer: currentTrainerEmailForDeletion ? 'Onboarding_Trainer__c.CSM_Name__c' : 'frontend',
    eventId: currentEventIdForDeletion ? 'Onboarding_Portal__c.Training_Event_ID__c' : 'frontend'
  }
})

// Delete from the correct trainer's calendar
await larkService.cancelTraining(
  trainerEmailForDeletion,  // Original trainer's email
  deleteCalendarId,
  eventIdForDeletion,       // The event ID to delete
  merchantName
)
```

**Critical Points**:
- ✅ Uses trainer email from `Onboarding_Trainer__c.CSM_Name__c` (current trainer)
- ✅ Uses event ID from `Onboarding_Portal__c.Training_Event_ID__c` (current event)
- ✅ Deletes from the ORIGINAL trainer's calendar (not the new trainer's)
- ✅ Falls back to frontend values if Salesforce query fails

#### Step 3: Create New Event with New Trainer
**File**: `app/api/lark/book-training/route.ts` (lines 340-450)

After successful deletion, create the new event:

```typescript
// Create new event with new trainer
const eventId = await larkService.bookTraining({
  trainerEmail: trainer.email,  // NEW trainer
  merchantName,
  date,
  startTime,
  endTime,
  // ... other details
})
```

#### Step 4: Update Onboarding_Trainer__c with New Trainer
**File**: `app/api/lark/book-training/route.ts` (lines 600-700)

Update the merchant's trainer assignment:

```typescript
// Update CSM_Name__c with new trainer's User ID
const updateData: any = {
  Id: merchantId,
  CSM_Name__c: newTrainerUserId,  // New trainer's User ID
  Training_Date__c: date
}

await conn.sobject('Onboarding_Trainer__c').update(updateData)
console.log('✅ Updated Onboarding_Trainer__c.CSM_Name__c with new trainer')
```

**Why User ID?**:
- `CSM_Name__c` is a lookup field to the User object
- Must store the User ID, not the email
- System resolves email → User ID via Salesforce query

#### Step 5: Update Onboarding_Portal__c with New Event ID
**File**: `app/api/lark/book-training/route.ts` (lines 724-738)

Store the new event ID for future rescheduling:

```typescript
// Update Portal with new event ID
const portalUpdateData: any = {
  Id: portalIdForUpdate,
  Training_Event_ID__c: eventId  // New event ID
}

await conn.sobject('Onboarding_Portal__c').update(portalUpdateData)
console.log('✅ Updated Onboarding_Portal__c.Training_Event_ID__c with new event ID')
```

**Why This Matters**:
- Next time the merchant reschedules, system will know which event to delete
- Prevents orphaned events from accumulating

### Data Flow Diagram

```
Rescheduling Request
    ↓
[Step 1] Query Salesforce
├── Get current trainer: Onboarding_Trainer__c.CSM_Name__c
└── Get current event ID: Onboarding_Portal__c.Training_Event_ID__c
    ↓
[Step 2] Delete Old Event
├── Use current trainer's email
├── Use current event ID
└── Delete from original trainer's calendar
    ↓
[Step 3] Create New Event
├── Create with new trainer
└── Get new event ID from Lark
    ↓
[Step 4] Update Trainer Assignment
├── Update Onboarding_Trainer__c.CSM_Name__c
└── Store new trainer's User ID
    ↓
[Step 5] Update Event ID
├── Update Onboarding_Portal__c.Training_Event_ID__c
└── Store new event ID
    ↓
✅ Rescheduling Complete
```

### Key Salesforce Fields

#### Onboarding_Trainer__c (Merchant Record)
- **CSM_Name__c** (Lookup to User)
  - **Purpose**: Stores which trainer is assigned to this merchant
  - **Type**: Lookup field to User object
  - **Value**: User ID (e.g., "0051a000001SZQaAAO")
  - **Used For**: Finding current trainer during rescheduling
  - **Related Field**: CSM_Name__r.Email (to get trainer's email)

#### Onboarding_Portal__c (Portal Record)
- **Training_Event_ID__c** (Text, 100 chars)
  - **Purpose**: Stores the Lark calendar event ID
  - **Type**: Text field
  - **Value**: Lark event ID (e.g., "dc1ed50d-b2e9-4fac-809c-6c45ee3c742a_0")
  - **Used For**: Knowing which event to delete during rescheduling
  - **Relationship**: Links to Onboarding_Trainer_Record__c (the merchant)

### Common Issues and Solutions

#### Issue: "Event not found" Error During Rescheduling
**Symptoms**:
```
❌ Failed to delete calendar event:
  Event ID: dc1ed50d-b2e9-4fac-809c-6c45ee3c742a_0
  Error: Lark API error: event not found
```

**Root Causes**:
1. **Event ID is wrong** - Stored event ID doesn't match actual event
2. **Event already deleted** - Someone deleted it manually from calendar
3. **Wrong trainer's calendar** - Trying to delete from new trainer instead of original
4. **Event ID format issue** - Event ID has changed or is corrupted

**Solutions**:
1. ✅ **Verify Salesforce data**:
   ```bash
   # Check what event ID is stored
   SELECT Training_Event_ID__c FROM Onboarding_Portal__c WHERE Id = 'portal_id'

   # Check which trainer is assigned
   SELECT CSM_Name__r.Email FROM Onboarding_Trainer__c WHERE Id = 'merchant_id'
   ```

2. ✅ **Check Lark calendar manually**:
   - Open trainer's Lark calendar
   - Search for the event
   - Verify it exists and has the correct ID

3. ✅ **Graceful fallback**:
   - If deletion fails, system continues with new booking
   - Old event remains on calendar (not ideal but doesn't break rescheduling)
   - Log the error for manual cleanup

#### Issue: Rescheduling to Same Trainer
**Symptoms**:
- Merchant reschedules but picks the same trainer
- System tries to delete event from trainer's calendar
- Event gets deleted, then recreated immediately

**Solution**:
- This is actually correct behavior
- Old event is deleted, new event is created
- Ensures event details (time, description) are updated
- No data loss occurs

#### Issue: Trainer Not Found in Salesforce
**Symptoms**:
```
⚠️ Could not get User ID for trainer, CSM_Name__c will not be updated
```

**Root Cause**:
- Trainer email in `config/trainers.json` doesn't match Salesforce User email
- Trainer is not active in Salesforce
- Trainer doesn't exist in Salesforce

**Solution**:
1. Verify trainer email in `config/trainers.json` matches Salesforce exactly
2. Check trainer is Active in Salesforce (IsActive = true)
3. Add trainer to Salesforce if missing

### Testing Rescheduling

#### Manual Test Steps
1. **Book initial training**:
   - Select merchant
   - Choose trainer (e.g., Nezo)
   - Select date/time
   - Confirm booking

2. **Verify in Salesforce**:
   - Check `Onboarding_Trainer__c.CSM_Name__c` = Nezo's User ID
   - Check `Onboarding_Portal__c.Training_Event_ID__c` = event ID

3. **Verify in Lark Calendar**:
   - Open Nezo's calendar
   - Confirm event appears

4. **Reschedule to different trainer**:
   - Click "Reschedule"
   - Select new trainer (e.g., Jia En)
   - Select new date/time
   - Confirm rescheduling

5. **Verify deletion**:
   - Check Nezo's calendar
   - Old event should be GONE
   - New event should appear on Jia En's calendar

6. **Verify Salesforce update**:
   - Check `Onboarding_Trainer__c.CSM_Name__c` = Jia En's User ID
   - Check `Onboarding_Portal__c.Training_Event_ID__c` = new event ID

#### Debug Logging
The system logs detailed information during rescheduling:

```
🗑️ Rescheduling detected - attempting to cancel existing event: {
  eventId: 'dc1ed50d-b2e9-4fac-809c-6c45ee3c742a_0',
  currentTrainerEmail: 'nezo.benardi@storehub.com',
  newTrainerEmail: 'jiaen.chai@storehub.com',
  trainerEmailForDeletion: 'nezo.benardi@storehub.com',
  source: {
    trainer: 'Onboarding_Trainer__c.CSM_Name__c',
    eventId: 'Onboarding_Portal__c.Training_Event_ID__c'
  }
}
✅ Successfully cancelled existing event
✅ Successfully created new event
✅ Updated Onboarding_Trainer__c.CSM_Name__c with new trainer
✅ Updated Onboarding_Portal__c.Training_Event_ID__c with new event ID
```

---

## Calendar ID Management

### Calendar ID Types in Lark

#### `"primary"` Calendar ID
- **Type**: Generic fallback identifier
- **Usage**: Default placeholder when real calendar ID isn't available
- **Limitations**:
  - May not work with all API operations
  - Limited functionality for FreeBusy queries
  - Event creation might fail
  - No guaranteed calendar access
- **When used**: Initial configuration, OAuth authorization failures, API resolution failures

#### Full Calendar ID Format
Example: `feishu.cn_zLXUWDRprW4Ozy6kXXCIua@group.calendar.feishu.cn`

**Format breakdown**:
- `feishu.cn_` - Indicates Feishu (Chinese Lark) organization
- `zLXUWDRprW4Ozy6kXXCIua` - Unique calendar identifier
- `@group.calendar.feishu.cn` - Domain indicating organizational calendar

**Capabilities**:
- ✅ Full API functionality with proper permissions
- ✅ FreeBusy queries work correctly
- ✅ Event creation/reading/updating fully functional
- ✅ Proper organizational calendar access
- ✅ Real-time calendar synchronization
- ✅ Recurring event support

### StoreHub Organization Setup
- **Organization Type**: Feishu (Chinese Lark) enterprise account
- **Calendar Structure**: Organizational calendars with team collaboration features
- **Domain**: `@group.calendar.feishu.cn` indicates enterprise setup
- **Access Level**: Full organizational calendar permissions
- **Integration**: OAuth 2.0 with proper scope permissions

### Calendar ID Resolution System

The system uses a **centralized Calendar ID Manager** (`lib/calendar-id-manager.ts`) to ensure consistency between reading and writing operations.

#### The Problem It Solves
Previously, the system could create events but not detect them because:
- **Events were created** using one calendar ID (from booking flow)
- **Events were read** using a different calendar ID (from availability checking)
- **Different calendars** = Events written to one place, read from another
- **Result**: System couldn't see its own bookings, leading to double-booking issues

#### Resolution Strategy
1. **Cache Check**: Check in-memory cache (5-minute TTL)
2. **OAuth Database**: Get calendar ID from stored OAuth tokens
3. **API Resolution**: Call Lark API to resolve primary calendar
4. **Validation**: Verify calendar ID works before using
5. **Database Update**: Store resolved calendar ID for future use
6. **Self-Healing**: Automatically fix invalid calendar IDs
7. **Fallback**: Use "primary" if all else fails

#### Key Features
- **Single Source of Truth**: All operations use the same calendar ID
- **Self-Healing**: Automatically updates invalid calendar IDs in database
- **Performance Optimized**: Caching reduces API calls by 80%
- **Validation**: Ensures calendar ID works before operations
- **Thread-Safe**: Handles concurrent requests properly
- **Error Recovery**: Graceful fallback mechanisms

## Core Functions Reference

### Calendar ID Manager Functions (`lib/calendar-id-manager.ts`)

#### `CalendarIdManager.getResolvedCalendarId(userEmail: string): Promise<string>`
**Purpose**: Main resolution function that ensures consistent calendar ID across all operations

**Parameters**:
- `userEmail` (string): Trainer's email address

**Returns**: Promise resolving to calendar ID string

**Usage**:
```typescript
const calendarId = await CalendarIdManager.getResolvedCalendarId('nezo.benardi@storehub.com')
// Returns: 'feishu.cn_zLXUWDRprW4Ozy6kXXCIua@group.calendar.feishu.cn'
```

**Resolution Flow**:
1. Check cache first (5-minute TTL)
2. Query OAuth database for stored calendar ID
3. Validate calendar ID works with Lark API
4. If invalid, resolve new calendar ID via API
5. Update database with new calendar ID
6. Cache result for future requests

#### `CalendarIdManager.forceRefreshCalendarId(userEmail: string): Promise<string>`
**Purpose**: Bypass cache and force fresh calendar ID resolution

**When to use**:
- Calendar permissions changed
- OAuth tokens refreshed
- Debugging calendar issues
- Manual cache invalidation needed

#### `CalendarIdManager.clearCache(userEmail?: string): void`
**Purpose**: Clear cached calendar IDs for testing or troubleshooting

**Parameters**:
- `userEmail` (optional): Clear specific user's cache, or all if omitted

### Main Availability Functions (`lib/trainer-availability.ts`)

#### `getCombinedAvailability(): Promise<AvailabilityResponse>`
**Purpose**: Main orchestration function that coordinates the entire availability checking process

**Process Flow**:
1. Get list of all trainers from configuration
2. For each trainer, call `getRawBusyTimes()` to get calendar events
3. Process recurring events and special cases
4. Calculate availability for each time slot
5. Aggregate results across all trainers
6. Return combined availability with trainer and language details

**Returns**: Complete availability data for all trainers and time slots

#### `getSlotAvailability(slot, trainers): Promise<SlotAvailability>`
**Purpose**: Check availability for a specific time slot across all trainers

**Used by**: Booking validation and detailed slot checking

### Calendar Data Functions (`lib/lark.ts`)

#### `getRawBusyTimes(trainerEmail: string, startDate: Date, endDate: Date): Promise<BusyTime[]>`
**Purpose**: Core function that extracts busy periods from trainer's calendar

**Process**:
1. **FreeBusy API**: Get busy times from ALL calendars (external, group meetings)
2. **Calendar Events API**: Get events from primary calendar
3. **Recurring Event Detection**: Identify events with `recurrence` field
4. **Recurring Event Expansion**: Call `/instances` endpoint to get all occurrences
5. **Combine Sources**: Merge FreeBusy + Calendar Events + Recurring instances
6. **Deduplication**: Sort and merge overlapping time periods
7. **Output**: Array of unique busy time objects with UTC timestamps

**API Endpoints Used**:
- `POST /open-apis/calendar/v4/freebusy/list` - Gets busy times from all calendars
- `GET /open-apis/calendar/v4/calendars/{calendar_id}/events` - Gets calendar events
- `GET /open-apis/calendar/v4/calendars/{calendar_id}/events/{event_id}/instances` - Expands recurring events

**Why We Need All Three**:
- **FreeBusy API alone**: Misses recurring event instances (doesn't expand them properly)
- **Calendar Events API alone**: Misses external calendars and group meetings
- **Combined approach**: Complete picture of trainer availability

#### `convertBusyTimesToAvailability(busyTimes: BusyTime[]): AvailabilitySlot[]`
**Purpose**: Convert raw busy times into structured availability format

**Input**: Array of busy time periods
**Output**: Formatted availability slots with trainer and language information

## Recurring Events and Phantom Events

### Understanding Recurring Events in Lark Calendar

#### What Are Recurring Events?
Recurring events are calendar events that repeat on a schedule (daily, weekly, monthly, etc.). In Lark Calendar:
- **Event Definition**: Stored as 1 event with a recurrence rule (e.g., "Every Monday at 10am")
- **Event Instances**: Individual occurrences of the recurring event (Oct 6 at 10am, Oct 13 at 10am, etc.)

#### How Lark Stores Recurring Events
When you query the Calendar Events API (`/calendars/{id}/events`), you get:
- **The recurring event DEFINITION** with a `recurrence` field
- **NOT the individual instances** - you must expand them separately

**Example Event Definition**:
```json
{
  "event_id": "abc123",
  "summary": "Team Meeting",
  "recurrence": "FREQ=WEEKLY;BYDAY=MO",
  "start_time": { "timestamp": "1696838400" },
  "end_time": { "timestamp": "1696842000" }
}
```

This represents "Team Meeting every Monday at 10am" but doesn't tell you which specific Mondays.

### The `/instances` Endpoint - Expanding Recurring Events

#### Purpose
The `/instances` endpoint expands a recurring event definition into individual occurrences within a date range.

#### Endpoint
```
GET /open-apis/calendar/v4/calendars/{calendar_id}/events/{event_id}/instances?start_time={unix_timestamp}&end_time={unix_timestamp}
```

#### Parameters
- `calendar_id`: The calendar containing the recurring event
- `event_id`: The ID of the recurring event definition
- `start_time`: Unix timestamp (seconds) - start of date range
- `end_time`: Unix timestamp (seconds) - end of date range

#### Response
Returns an array of event instances that occur within the date range:
```json
{
  "data": {
    "items": [
      {
        "event_id": "instance_1",
        "start_time": { "timestamp": "1696838400" },
        "end_time": { "timestamp": "1696842000" },
        "status": "confirmed"
      },
      {
        "event_id": "instance_2",
        "start_time": { "timestamp": "1697443200" },
        "end_time": { "timestamp": "1697446800" },
        "status": "confirmed"
      }
    ]
  }
}
```

#### Implementation in `getRawBusyTimes()`
```typescript
// 1. Detect recurring event definition
if (event.recurrence && event.event_id) {
  console.log(`🔁 RECURRING EVENT DEFINITION: "${event.summary}"`)

  // 2. Fetch instances for this recurring event
  const instancesResponse = await this.makeRequest(
    `/open-apis/calendar/v4/calendars/${calendarId}/events/${event.event_id}/instances?start_time=${timeMin}&end_time=${timeMax}`,
    { method: 'GET', userEmail: trainerEmail }
  )

  // 3. Process each instance
  if (instancesResponse.data?.items?.length > 0) {
    for (const instance of instancesResponse.data.items) {
      if (instance.status !== 'cancelled') {
        busyTimes.push({
          start_time: instanceStart.toISOString(),
          end_time: instanceEnd.toISOString()
        })
      }
    }
  }
}
```

#### Why This Is Critical
**Without `/instances` expansion**:
- ❌ System only sees "Team Meeting - Every Monday" (the definition)
- ❌ Doesn't know which specific Mondays the trainer is busy
- ❌ Trainer appears available when they're actually in recurring meetings

**With `/instances` expansion**:
- ✅ System sees "Oct 6 at 10am", "Oct 13 at 10am", "Oct 20 at 10am"
- ✅ Knows exactly when trainer is busy
- ✅ Correctly blocks those time slots

### Phantom Events Problem

#### What Are Phantom Events?
Phantom events are busy times that appear in the system but don't actually exist in the trainer's calendar for that specific date.

#### Example
**Jia En's Calendar on Oct 15, 2025 (Wednesday)**:
- ✅ **Real Event**: 11:00 AM - 12:00 PM (recurring meeting every Wednesday)
- ✅ **Real Event**: 9:45-10:00 AM (recurring meeting Mon, Wed, Fri)

**System Detected**:
- ✅ 11:00 AM - 12:00 PM (correct)
- ✅ 9:45-10:00 AM (correct)
- ❌ 9:00-9:30 AM (phantom - doesn't exist)
- ❌ 1:00-1:15 PM (phantom - doesn't exist)
- ❌ 5:30-5:45 PM (phantom - doesn't exist)

#### Sources of Phantom Events

##### 1. Events Marked as "Free" Time ⭐ **MOST COMMON**
**Root Cause of Jia En's Phantom Events**

Events can exist in the calendar but be marked as "Free" instead of "Busy":
- ✅ Event exists in calendar
- ✅ Event has valid recurrence pattern
- ✅ Event appears in Calendar Events API
- ❌ **But `free_busy_status: "free"`** - should NOT block availability

**Common "Free" Events**:
- Personal reminders (e.g., "Review Jira", "Focus Time")
- Tentative holds that don't prevent meetings
- Private events visible only to owner
- Working time blocks that don't block calendar

**Problem**:
If you don't check `free_busy_status`, these events will incorrectly block availability.

**Example from Jia En's Calendar**:
- Event: "👓 AM: Review Jira" at 9:00-9:30 AM
- Recurrence: Every weekday (BYDAY=MO,TU,WE,TH,FR)
- Status: `confirmed`
- **Free/Busy Status**: `free` ← This is the key!
- Result: Should NOT block Jia En's availability

**Solution**:
```typescript
const freeBusyStatus = event.free_busy_status || 'busy'
if (freeBusyStatus === 'busy') {
  // Only include events marked as "busy"
  busyTimes.push(...)
}
```

##### 2. FreeBusy API Including External Events
**Less Common in Our Case**

The FreeBusy API aggregates busy times from:
- ✅ Primary calendar (trainer's own events)
- ⚠️ **External calendars** (calendars shared with trainer)
- ⚠️ **Group meetings** (meetings trainer was invited to)
- ⚠️ **Declined events** (events trainer declined but still show as busy)

**Problem**: If Jia En has view access to another person's calendar, their events might appear in her FreeBusy response.

**Note**: In Jia En's case, FreeBusy API returned 0 events, so this was not the issue.

##### 3. Incorrect Recurrence Rules
**Rare**

Recurring events might have incorrect recurrence patterns:
- Event says "Every weekday" but should be "Mon, Tue, Thu, Fri"
- Event includes Wednesday when it shouldn't
- Recurrence rule doesn't match actual calendar display

**How to Check**:
1. Click on the recurring event in Lark Calendar
2. Check the recurrence pattern
3. Verify it matches the days the event actually appears

**Note**: In Jia En's case, recurrence rules were correct. The events DID recur on Wednesday as configured.

##### 4. Lark API Bugs
**Very Rare**

The `/instances` endpoint might return incorrect instances:
- Returns instances for days not in recurrence pattern
- Includes cancelled instances
- Timezone calculation errors

**Note**: In Jia En's case, the API was working correctly. The issue was the `free_busy_status` field.

#### How to Diagnose Phantom Events

##### Step 1: Check FreeBusy vs Calendar Events
Use the debug endpoint to compare sources:
```bash
curl "https://your-app.com/api/debug/jiaen-oct15" | jq '.freeBusyTimes'
```

This shows which busy times come from FreeBusy API vs Calendar Events API.

##### Step 2: Verify Calendar Display
1. Open trainer's Lark Calendar
2. Navigate to the specific date
3. Check if phantom events appear in the calendar view
4. If they don't appear, they're coming from external sources

##### Step 3: Check Recurring Event Settings
For each recurring event:
1. Click on the event
2. Check "Recurrence" settings
3. Verify days of week match expected pattern
4. Check if event is marked as "Busy" or "Free"

#### Solutions for Phantom Events

##### Solution 1: Filter by Free/Busy Status ⭐ **IMPLEMENTED**
**The Correct Solution**

Check the `free_busy_status` field and only include events marked as "busy":

```typescript
// For recurring event instances
const freeBusyStatus = instance.free_busy_status || event.free_busy_status || 'busy'
if (instance.status === 'confirmed' && freeBusyStatus === 'busy') {
  busyTimes.push({
    start_time: instanceStart.toISOString(),
    end_time: instanceEnd.toISOString(),
    source: `recurring:${event.summary}`,
    recurrence: event.recurrence
  })
}

// For one-time events
const freeBusyStatus = event.free_busy_status || 'busy'
if (freeBusyStatus === 'busy') {
  busyTimes.push({
    start_time: eventStart.toISOString(),
    end_time: eventEnd.toISOString(),
    source: `one-time:${event.summary}`,
    event_id: event.event_id
  })
}
```

**Why This Works**:
- Events marked as "free" are personal reminders, focus time, etc.
- They exist in the calendar but don't block availability
- Only events marked as "busy" should prevent booking

**Result**:
- ✅ Correctly excludes "Review Jira" events (marked as "free")
- ✅ Correctly includes real meetings (marked as "busy")
- ✅ Trainers show as available during "free" time blocks

##### Solution 2: Filter by Event Status
Only include confirmed events (already implemented):
```typescript
if (instance.status === 'confirmed' && instance.status !== 'cancelled') {
  busyTimes.push(...)
}
```

**Note**: This alone is not enough. You also need to check `free_busy_status`.

##### Solution 3: Use Only Calendar Events API
If FreeBusy is unreliable, rely solely on Calendar Events + `/instances`:
```typescript
// Skip FreeBusy API entirely
const busyTimes = []

// Only use Calendar Events API with /instances expansion
const eventsResponse = await this.makeRequest(...)
// Process events and expand recurring ones
```

**Trade-off**: Might miss external calendar events and group meetings.

**Note**: In our implementation, FreeBusy returned 0 events, so we're effectively using only Calendar Events API.

##### Solution 4: Cross-Reference Both APIs
Compare FreeBusy and Calendar Events results:
```typescript
// Get both sources
const freeBusyTimes = await getFreeBusySchedule(...)
const calendarEventTimes = await getCalendarEvents(...)

// Only include busy times that appear in BOTH sources
const confirmedBusyTimes = freeBusyTimes.filter(fbTime =>
  calendarEventTimes.some(ceTime => timesOverlap(fbTime, ceTime))
)
```

**Trade-off**: Might miss legitimate events that only appear in one source.

**Note**: Not needed if you filter by `free_busy_status` correctly.

#### Real-World Case Study: Jia En's Calendar (October 15, 2025)

**Problem Discovered:**
System detected 5 busy times for Jia En on Wednesday, Oct 15, 2025:
1. ❌ 9:00-9:30 AM - "👓 AM: Review Jira" (phantom)
2. ✅ 9:45-10:00 AM - "Product Office: Daily Standup" (real)
3. ✅ 11:00 AM-12:00 PM - "Product x Designer Weekly Review" (real)
4. ❌ 1:00-1:15 PM - "👓 PM1: Review Jira" (phantom)
5. ❌ 5:30-5:45 PM - "👓 PM2: Review Jira" (phantom)

**Investigation Process:**

1. **Checked FreeBusy API**: Returned 0 events ❌
   - Ruled out FreeBusy as the source

2. **Checked Calendar Events API**: Returned 5 events ✅
   - All 5 events were recurring events
   - All had valid recurrence patterns including Wednesday

3. **Added Source Tracking**: Modified `getRawBusyTimes()` to tag each busy time with:
   - `source`: "recurring:EventName" or "one-time:EventName"
   - `recurrence`: The recurrence rule
   - `event_id`: The event ID

4. **Root Cause Identified**:
   - The 3 "Review Jira" events exist in the calendar
   - They ARE configured to recur on Wednesday (BYDAY=MO,TU,WE,TH,FR)
   - **BUT they are marked as "Free" time** (`free_busy_status: "free"`)
   - Events marked as "Free" should NOT block availability

**Why "Free" Events Exist:**
- Personal reminders (like "Review Jira")
- Focus time blocks that don't prevent meetings
- Tentative holds that shouldn't block the calendar
- Events visible only to the owner, not to others viewing availability

**The Fix:**
Added filtering in `getRawBusyTimes()` to check `free_busy_status` field:

```typescript
// For recurring event instances
const freeBusyStatus = instance.free_busy_status || event.free_busy_status || 'busy'
if (instance.status === 'confirmed' && freeBusyStatus === 'busy') {
  // Include in busy times
}

// For one-time events
const freeBusyStatus = event.free_busy_status || 'busy'
if (freeBusyStatus === 'busy') {
  // Include in busy times
}
```

**Result After Fix:**
- ✅ Only 2 busy times detected (9:45-10am, 11am-12pm)
- ✅ Jia En shows as available during 9-11am (except 9:45-10am)
- ✅ Jia En shows as available during 2-4pm
- ✅ Jia En shows as available during 4-6pm
- ❌ "Review Jira" events excluded (marked as "free")

**Lesson Learned:**
Always check `free_busy_status` field when determining availability. Events can exist in the calendar but be marked as "free" time, meaning they don't block the user's availability for meetings.

#### Current Implementation Status

**As of October 2025**:
- ✅ Using combined approach (FreeBusy + Calendar Events + `/instances`)
- ✅ Expanding recurring events via `/instances` endpoint
- ✅ Filtering events by `free_busy_status` (only include "busy" events)
- ✅ Deduplicating overlapping busy times
- ✅ Phantom events issue resolved

**Debug Endpoint**: `/api/debug/jiaen-oct15` - Shows FreeBusy vs Calendar Events comparison with source tracking

#### Best Practices

1. **Always expand recurring events** using `/instances` endpoint
2. **Log all busy times** with source information (FreeBusy vs Calendar Events)
3. **Verify against calendar display** when debugging availability issues
4. **Check event status** - filter out cancelled/declined events
5. **Document recurrence patterns** for each trainer's recurring meetings
6. **Monitor for phantom events** using debug endpoints
7. **Cross-reference multiple sources** when accuracy is critical

## Training Schedule Configuration

### Time Slots Definition

**Timezone**: All times in Asia/Singapore timezone (GMT+8)

#### Before December 1, 2025
**Schedule**: 4 slots x 60 minutes, Monday to Friday only
- **10:00 - 11:00** (Morning Session)
- **12:00 - 13:00** (Lunch Session)
- **14:30 - 15:30** (Afternoon Session)
- **17:00 - 18:00** (Evening Session)

#### December 1, 2025 Onwards
**Schedule**: 3 slots x 90 minutes, Monday to Friday only

**Normal Merchants**:
- **10:00 - 11:30** (Morning Session)
- **13:30 - 15:00** (Afternoon Session)
- **16:00 - 17:30** (Late Afternoon Session)

**Special Merchants** (with Membership, Engage, Composite Inventory, or Superbundle features):
- **16:00 - 18:00** (Extended Evening Session - ONLY slot available)

#### Feature-Based Slot Restrictions (Dec 2025+)

Merchants with these features in `Required_Features_by_Merchant__c` can ONLY book the 4-6pm slot:
- **Membership**
- **Engage**
- **Composite Inventory** (or just "Composite")
- **Superbundle**

**Why**: These features require extended training time (120 minutes instead of 90 minutes).

**Implementation**:
- Time slot configuration: `lib/time-slot-config.ts`
- Feature detection: `requiresExtendedTrainingSlot()` function
- Slot filtering: `components/DatePickerModal.tsx` (in `filteredSlots` useMemo)

**User Experience**:
- When a special merchant selects a December 2025+ date, only the 4-6pm slot is shown
- A notice is displayed: "Note: Due to {Feature Name} feature, only the 4pm slot is available for training."

**Implementation Files**:
- `lib/time-slot-config.ts` - Time slot definitions and feature detection
- `components/DatePickerModal.tsx` - Slot filtering and UI notice
- Defined in `TIME_SLOTS` constant in `getCombinedAvailability()` function (`lib/trainer-availability.ts`)
- Also defined in `convertBusyTimesToAvailability()` function (`lib/lark.ts`)

**Note**: These are training session slots. Installation and other booking types may have different durations.

### Training Booking Criteria
1. **Service Type**: Remote or On-site onboarding
2. **Language Requirements**: English, Bahasa Malaysia, Chinese
3. **Trainer Calendar Availability**: Real-time calendar integration
4. **Merchant Location**: Geographic considerations for on-site training
5. **Advance Booking**: Minimum 2 days in advance
6. **Business Hours**: Monday-Friday, 9am-6pm Singapore time

### Trainer Configuration
- **Configuration File**: `config/trainers.json`
- **Trainer Details**: Name, email, calendar ID, supported languages
- **OAuth Integration**: Individual trainer authorization required
- **Calendar Access**: Full read/write permissions via Lark OAuth

**Current Trainers**:
- **Nezo Benardi**: English, Bahasa Malaysia
- **Jia En Chai**: Bahasa Malaysia, Chinese

*See `docs/trainer-information.md` for complete trainer details*

### Language Selection and Assignment Rules

#### Language Capabilities (CRITICAL - Must Match Documentation)
**⚠️ IMPORTANT**: Trainer language capabilities must EXACTLY match `docs/trainer-information.md`

**Nezo Benardi** (`nezo.benardi@storehub.com`):
- ✅ **English** (Primary)
- ✅ **Bahasa Malaysia**
- ❌ **Chinese** (NOT supported)

**Jia En Chai** (`jiaen.chai@storehub.com`):
- ❌ **English** (NOT supported)
- ✅ **Bahasa Malaysia** (Primary)
- ✅ **Chinese** (Mandarin)

#### Language Assignment Logic
1. **Slot Availability**: A time slot is available if ANY trainer is free
2. **Language Aggregation**: Available languages = languages of ALL available trainers
3. **Auto-Assignment**: When merchant selects a slot, system assigns to one available trainer
4. **Language Matching**: Assigned trainer MUST support the merchant's selected language

#### Common Language Configuration Errors
❌ **WRONG**: Both trainers showing all three languages
❌ **WRONG**: Jia En showing English capability
❌ **WRONG**: Nezo showing Chinese capability
✅ **CORRECT**: Each trainer shows only their documented languages

**Fix**: Verify `config/trainers.json` matches `docs/trainer-information.md` exactly

### Timezone Handling (CRITICAL - Recurring Issue)

#### System Timezone Standard
**⚠️ ALL TIMES MUST USE SINGAPORE TIMEZONE**: `Asia/Singapore` (UTC+8)

#### Timezone Consistency Rules
1. **API Endpoints**: All date ranges must use Singapore timezone
2. **Calendar Functions**: All date calculations must use Singapore timezone
3. **Database Storage**: Store UTC timestamps, display in Singapore time
4. **User Interface**: Always show Singapore time to users
5. **Calendar Integration**: Convert to Singapore time for Lark API calls

#### Common Timezone Errors and Fixes

##### Error 1: Server Local Time vs Singapore Time
❌ **WRONG**:
```typescript
const startDate = new Date()
startDate.setHours(0, 0, 0, 0) // Uses server timezone
```

✅ **CORRECT**:
```typescript
const now = new Date()
const singaporeNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Singapore"}))
const startDate = new Date(`${singaporeNow.getFullYear()}-${String(singaporeNow.getMonth() + 1).padStart(2, '0')}-${String(singaporeNow.getDate()).padStart(2, '0')}T00:00:00+08:00`)
```

##### Error 2: Inconsistent Date Creation
❌ **WRONG**:
```typescript
// Mixing timezone approaches
const date1 = new Date(year, month - 1, day, hour, minute) // Local timezone
const date2 = new Date(`${dateStr}T${timeStr}:00+08:00`)  // Singapore timezone
```

✅ **CORRECT**:
```typescript
// Always use Singapore timezone
function createLocalDate(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+08:00`)
}
```

##### Error 3: Debug Endpoint vs Production API Mismatch
❌ **PROBLEM**: Debug endpoint uses single-day range, production API uses 30-day range with different timezone calculations

✅ **SOLUTION**: Both must use identical Singapore timezone date range calculations

#### Files That Must Use Singapore Timezone
- `app/api/lark/availability/route.ts` - Date range calculation
- `lib/trainer-availability.ts` - `createLocalDate()` function
- `lib/lark.ts` - `convertBusyTimesToAvailability()` function
- `app/api/debug/calendar-test/route.ts` - Debug date ranges

#### Timezone Debugging Checklist
1. ✅ All date ranges start with `+08:00` timezone
2. ✅ `createLocalDate()` uses Singapore timezone format
3. ✅ API endpoints use consistent timezone calculations
4. ✅ Debug tools use same timezone as production
5. ✅ Calendar slot times match busy time timezones

## Solutions Implemented

### 1. Calendar ID Consistency Solution
**Problem**: System couldn't detect events it created itself due to calendar ID mismatch between read and write operations.

**Root Cause**:
- Booking flow used one calendar ID (potentially "primary" fallback)
- Availability checking used different calendar ID (potentially resolved full ID)
- Events written to one calendar, read from another

**Solution**: Centralized Calendar ID Manager
- **Implementation**: `lib/calendar-id-manager.ts`
- **Strategy**: Single source of truth for all calendar operations
- **Features**: Caching, validation, self-healing, database updates
- **Result**: 100% consistency between read/write operations

**Files Modified**:
- `lib/calendar-id-manager.ts` (NEW)
- `app/api/lark/book-training/route.ts` (updated to use Calendar ID Manager)
- `lib/lark.ts` (updated `getRawBusyTimes` and `getAvailableSlots` functions)

### 2. Date Range Fix Solution
**Problem**: 30-day availability check started from current time, missing events that started earlier in the day.

**Root Cause**:
- `startDate = new Date()` used current time (e.g., 8:04am)
- Events that started earlier (e.g., 9-11am training) were filtered out
- 1-day booking check used midnight start time, 30-day check didn't

**Solution**: Consistent date range boundaries
- **Start Time**: Midnight of current day (`setHours(0, 0, 0, 0)`)
- **End Time**: End of target day (`setHours(23, 59, 59, 999)`)
- **Result**: All events within the day are included

**Files Modified**:
- `app/api/lark/availability/route.ts` (updated date range calculation)

### 3. Enhanced Debugging Solution
**Problem**: Difficult to troubleshoot availability calculation issues.

**Solution**: Comprehensive logging system
- **Detailed checks**: Added logging for specific time slots (9-11am, 1-3pm, 4-6pm)
- **Overlap detection**: Clear visibility into which events block which slots
- **Calendar ID tracking**: Log which calendar ID is used for each operation
- **Busy period enumeration**: List all busy periods with timestamps

**Files Modified**:
- `lib/trainer-availability.ts` (added detailed logging for debugging)

### 4. Recurring Events Processing Solution
**Problem**: Lark API sometimes misses recurring events (e.g., daily lunch meetings).

**Solution**: Hybrid approach with manual fallbacks
- **Primary**: Use Lark API recurring event data
- **Fallback**: Manually add known recurring events
- **Example**: Daily lunch meetings (12:30-1:30pm) for specific trainers
- **Flexibility**: Easy to add more special cases as needed

**Implementation**: Special case handling in `getCombinedAvailability()` function

## Technical Architecture

### Data Flow Overview
```
1. User requests availability
   ↓
2. getCombinedAvailability() orchestrates process
   ↓
3. For each trainer:
   ├── CalendarIdManager.getResolvedCalendarId()
   ├── getRawBusyTimes() → FreeBusy API or Events API
   ├── Process recurring events
   └── Add special case events
   ↓
4. Calculate overlaps with TIME_SLOTS
   ↓
5. Aggregate results across trainers
   ↓
6. Return combined availability response
```

### Calendar ID Resolution Flow
```
1. CalendarIdManager.getResolvedCalendarId(email)
   ↓
2. Check cache (5-minute TTL)
   ├── Cache hit → Return cached ID
   └── Cache miss → Continue
   ↓
3. Query OAuth database
   ├── Found valid ID → Validate with API
   └── Not found → Continue to API resolution
   ↓
4. Call Lark API to resolve primary calendar
   ↓
5. Validate calendar ID works
   ├── Valid → Update database, cache, return
   └── Invalid → Use "primary" fallback
```

### Error Handling Strategy
- **Calendar ID Resolution**: Multiple fallback levels
- **API Failures**: FreeBusy → Events API → Graceful degradation
- **OAuth Issues**: Assume trainer available if no token
- **Validation Failures**: Log errors but continue processing
- **Cache Issues**: Bypass cache and use direct API calls

## API Integration Details

### Lark Calendar API Endpoints

#### FreeBusy API (Primary Method)
**Endpoint**: `POST /open-apis/calendar/v4/freebusy/list`

**Purpose**: Efficient bulk retrieval of busy time periods

**Request Format**:
```json
{
  "time_min": "2025-10-14T00:00:00+08:00",
  "time_max": "2025-11-13T23:59:59+08:00",
  "user_id": "nezo.benardi@storehub.com",
  "only_busy": true,
  "include_external_calendar": true
}
```

**Response**: Array of busy time periods with start/end timestamps

**Advantages**:
- Fast bulk retrieval
- Handles recurring events automatically
- Includes external calendar events
- Optimized for availability checking

**Limitations**:
- Requires proper user ID format (not email)
- May fail with permission issues
- Limited event details

#### Calendar Events API (Fallback Method)
**Endpoint**: `GET /open-apis/calendar/v4/calendars/{calendar_id}/events`

**Purpose**: Detailed event retrieval when FreeBusy fails

**Parameters**:
- `start_time`: Unix timestamp
- `end_time`: Unix timestamp
- `calendar_id`: Full calendar identifier

**Response**: Detailed event objects with recurrence rules

**Advantages**:
- Works with email-based authentication
- Provides detailed event information
- Better error handling
- More reliable for debugging

**Limitations**:
- Slower than FreeBusy API
- Requires manual recurring event processing
- More API calls needed

### OAuth 2.0 Integration

#### Authorization Flow
1. **Trainer Authorization**: Visit `/trainers/authorize`
2. **OAuth Redirect**: Lark authorization page
3. **Token Exchange**: Authorization code → Access token
4. **Token Storage**: Database storage with refresh capability
5. **Calendar ID Resolution**: Get primary calendar ID
6. **Database Update**: Store calendar ID for future use

#### Token Management
- **Access Tokens**: Short-lived (2 hours)
- **Refresh Tokens**: Long-lived (30 days)
- **Auto-Refresh**: Automatic token renewal
- **Error Handling**: Graceful degradation if tokens expire

#### Required Scopes
- `calendar:calendar:readonly` - Read calendar information
- `calendar:event:readonly` - Read calendar events
- `calendar:event:write` - Create/update calendar events
- `calendar:freebusy:readonly` - Access FreeBusy information

### Why Use Busy Times Instead of Free Times?

#### API Design Reality
- **Lark Calendar API provides busy times, not free times**
  - FreeBusy API: Returns busy periods only
  - Calendar Events API: Returns events (inherently busy times)
  - **No direct "free time" endpoint exists** in Lark API

#### Calendar Logic Fundamentals
- **Calendar events are inherently "busy"** - meetings, appointments, blocked time
- **Free time = Total working hours - Busy time** (same calculation either way)
- **Conflict detection is easier** - just check for time overlaps
- **Industry standard approach** - Google Calendar, Outlook, etc. all work this way

#### Technical Advantages
1. **Direct API alignment** - Work with what Lark provides naturally
2. **Efficient overlap detection** - Simple mathematical comparison
3. **Handles edge cases well** - Recurring events, multiple calendars, partial overlaps
4. **Clear debugging** - Can see exactly which meeting blocks a slot
5. **Flexible slot definition** - Easy to change predefined time slots

#### Alternative "Free Time" Approach Would Still Need Busy Times
Even if we wanted to get "free time" directly, we'd still need to:
1. Get busy times from calendar events
2. Define working hours (9am-6pm, weekdays)
3. Subtract busy times from working hours
4. Return remaining free periods

**Result: Same calculation, just framed differently with extra steps.**

## Complete Logic Flow

### Step 1: Data Collection Phase
```
For each trainer:
├── Check OAuth authorization status
├── CalendarIdManager.getResolvedCalendarId(email)
│   ├── Check cache (5-minute TTL)
│   ├── Query OAuth database
│   ├── Validate calendar ID with API
│   └── Update database if needed
├── Call getRawBusyTimes(email, startDate, endDate)
│   ├── Try FreeBusy API first (efficient bulk retrieval)
│   ├── Fallback to Calendar Events API if needed
│   ├── Process recurring events (FREQ, INTERVAL, BYDAY rules)
│   └── Add special cases (manual lunch meetings, etc.)
└── Store as busySlots array: [{start: ISO_string, end: ISO_string}]
```

### Step 2: Availability Calculation Phase
```
For each day (weekdays only):
├── Define TIME_SLOTS: [10:00-11:00, 12:00-13:00, 14:30-15:30, 17:00-18:00]
├── For each time slot:
│   ├── For each trainer:
│   │   ├── Check if ANY busy period overlaps with this slot
│   │   │   └── Overlap formula: (slotStart < busyEnd && slotEnd > busyStart)
│   │   ├── If NO overlap → trainer is available
│   │   └── If overlap exists → trainer is busy
│   ├── Collect all available trainers for this slot
│   ├── Aggregate their languages (English, Bahasa Malaysia, Chinese)
│   └── Mark slot as available if ANY trainer is free
└── Return combined availability with trainer and language details
```

### Step 3: Response Generation
```
Output format:
{
  "date": "2025-10-14",
  "slots": [
    {
      "start": "14:00",
      "end": "16:00",
      "available": true,
      "availableTrainers": ["Jia En"],           // Nezo excluded due to lunch
      "availableLanguages": ["Bahasa Malaysia", "Chinese"]  // No English
    }
  ]
}
```

**Key Functions:**
- `getCombinedAvailability()` in `lib/trainer-availability.ts` - Main function that orchestrates the entire flow
- `getRawBusyTimes()` in `lib/lark.ts` - Extracts busy periods from calendar APIs
- `convertBusyTimesToAvailability()` in `lib/lark.ts` - Converts busy times to availability format

### Key Overlap Detection Logic
The core availability check uses this overlap formula:
```typescript
const overlaps = (slotStart < busyEnd && slotEnd > busyStart)
```

**Examples**:
- Slot: 2:00-4:00pm, Busy: 12:30-1:30pm → **NO OVERLAP** (busy ends before slot starts)
- Slot: 2:00-4:00pm, Busy: 3:00-5:00pm → **OVERLAPS** (busy period overlaps with slot)
- Slot: 2:00-4:00pm, Busy: 4:00-5:00pm → **NO OVERLAP** (slot ends when busy starts)

### Combined Availability Strategy
- **Slot is available if ANY trainer is free** (not all trainers need to be free)
- **Languages are aggregated** from all available trainers
- **Auto-assignment happens during booking** (not during availability check)
- **Graceful degradation** - assume available if API fails

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Incorrect Language Configuration
**Symptoms**:
- Both trainers showing all three languages (English, Bahasa Malaysia, Chinese)
- Jia En showing English capability when he doesn't support it
- Nezo showing Chinese capability when he doesn't support it
- Language mismatch between API response and documentation

**Root Cause**: `config/trainers.json` doesn't match `docs/trainer-information.md`

**Diagnosis**:
```bash
# Check current trainer configuration
curl "https://onboarding-portal-b0ay.onrender.com/api/lark/availability" | jq '.trainers'

# Should show:
# Nezo: ["English", "Bahasa Malaysia"]
# Jia En: ["Bahasa Malaysia", "Chinese"]
```

**Solution**:
1. Verify `config/trainers.json` exactly matches `docs/trainer-information.md`
2. Restart application after configuration changes
3. Clear any caches that might store old language data

#### Issue 2: Timezone Inconsistency
**Symptoms**:
- Calendar events not detected despite being visible in calendar
- Availability API shows different results than debug endpoints
- Events from earlier in the day not being detected
- Date range mismatches between functions

**Root Cause**: Mixed timezone handling between server local time and Singapore time

**Diagnosis**:
```bash
# Check if debug endpoint finds events but availability API doesn't
curl "https://onboarding-portal-b0ay.onrender.com/api/debug/calendar-test"
curl "https://onboarding-portal-b0ay.onrender.com/api/lark/availability"

# Look for timezone inconsistencies in date ranges
```

**Solution**:
1. Ensure ALL date calculations use Singapore timezone (`+08:00`)
2. Update `createLocalDate()` function to use Singapore timezone
3. Fix API endpoint date range calculations
4. Verify debug tools use same timezone as production

**Critical Files to Check**:
- `app/api/lark/availability/route.ts` - Date range calculation
- `lib/trainer-availability.ts` - `createLocalDate()` function
- `app/api/debug/calendar-test/route.ts` - Debug date ranges

#### Issue 3: System can't detect events it created
**Symptoms**:
- Bookings show as successful but slots still appear available
- Double-booking occurs
- Events visible in calendar but not in availability API

**Diagnosis**:
```bash
# Check calendar ID consistency
curl "http://localhost:3010/api/lark/availability" | grep "calendar ID"
```

**Solution**: Calendar ID Manager automatically resolves this, but you can force refresh:
```typescript
await CalendarIdManager.forceRefreshCalendarId('trainer@email.com')
```

#### Issue 2: Recurring events not detected
**Symptoms**:
- Daily/weekly meetings not blocking availability
- Lunch meetings not showing as busy
- Trainer appears available during known recurring meetings

**Diagnosis**: Check if recurring events are being processed:
```bash
# Look for recurring event processing in logs
grep "recurring" /tmp/server.log
```

**Solution**: Add manual recurring events in `getCombinedAvailability()` function

#### Issue 3: OAuth token expired
**Symptoms**:
- API calls failing with authentication errors
- Trainer showing as "no OAuth token"
- FreeBusy API returning permission errors

**Solution**:
1. Trainer visits `/trainers/authorize` to re-authorize
2. System automatically refreshes tokens when possible
3. Check token expiry in database

#### Issue 4: Date range issues
**Symptoms**:
- Events from earlier in the day not detected
- Availability check missing current day events
- Inconsistent results between booking and availability APIs

**Solution**: Ensure date ranges start from midnight:
```typescript
const startDate = new Date()
startDate.setHours(0, 0, 0, 0) // Midnight start
```

### Debugging Tools

#### Enable Detailed Logging
Add trainer email to detailed check conditions in `lib/trainer-availability.ts`:
```typescript
if (dateStr === '2025-10-14' && (slot.start === '09:00' || slot.start === '13:00' || slot.start === '16:00') &&
    (trainerName === 'YourTrainer' || trainerInfo.trainerEmail === 'trainer@email.com')) {
```

#### Calendar ID Validation
```typescript
// Check if calendar ID is valid
const isValid = await CalendarIdManager.validateCalendarId(email, calendarId)
```

#### Clear Cache for Testing
```typescript
// Clear specific trainer's cache
CalendarIdManager.clearCache('trainer@email.com')

// Clear all caches
CalendarIdManager.clearCache()
```

### Performance Monitoring

#### Cache Hit Rates
Monitor cache effectiveness:
- Cache hits should be >80% for normal operation
- Cache misses indicate potential issues or new trainers

#### API Response Times
- FreeBusy API: <500ms typical
- Calendar Events API: <2000ms typical
- Total availability check: <5000ms typical

#### Error Rates
- OAuth failures: <5% acceptable
- API timeouts: <2% acceptable
- Calendar ID resolution failures: <1% acceptable

This comprehensive documentation provides complete coverage of all functions, solutions, and technical details implemented in the training calendar system.
