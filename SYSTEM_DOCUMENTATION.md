# StoreHub Merchant Onboarding Portal - System Documentation

**Version:** 1.0
**Last Updated:** November 2025
**Target Audience:** Internal Development Team, Customer Success Managers, Operations Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Business Rules & Constraints](#business-rules--constraints)
4. [What the Portal CAN Do](#what-the-portal-can-do)
5. [What the Portal CANNOT Do](#what-the-portal-cannot-do)
6. [Scheduling Logic & Date Validation](#scheduling-logic--date-validation)
7. [Rescheduling System](#rescheduling-system)
8. [Trainer Assignment Logic](#trainer-assignment-logic)
9. [Installer Assignment Logic](#installer-assignment-logic)
10. [Salesforce Integration](#salesforce-integration)
11. [Lark Calendar Integration](#lark-calendar-integration)
12. [Critical System Flows](#critical-system-flows)
13. [Known Limitations](#known-limitations)
14. [Recent Bug Fixes](#recent-bug-fixes)
15. [Configuration Management](#configuration-management)
16. [Troubleshooting Guide](#troubleshooting-guide)

---

## Executive Summary

The **Merchant Onboarding Portal** is a self-service platform that enables merchants to manage their onboarding journey from account creation to go-live. The system integrates with **Salesforce CRM** for data management and **Lark Calendar** for scheduling.

### Key Capabilities

✅ **Self-service booking** for training and installation
✅ **Real-time availability** from trainer/installer calendars
✅ **Automated rescheduling** with proper event cleanup
✅ **Location-based assignment** for onsite services
✅ **Language-based filtering** for trainer matching
✅ **Strict date validation** to enforce business rules
✅ **Multi-stage progress tracking**

### Technology Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (production), Prisma ORM
- **CRM:** Salesforce REST API
- **Calendar:** Lark Open Platform API (OAuth 2.0)
- **Deployment:** Render
- **Authentication:** JWT with HTTP-only cookies

---

## System Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Merchant      │
│   Browser       │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────────────────────────────┐
│   Next.js Application (Render)          │
│   ┌───────────────────────────────┐    │
│   │  Frontend (React/Next.js)     │    │
│   │  - Portal UI                  │    │
│   │  - Authentication             │    │
│   │  - Booking Modals             │    │
│   └───────────────┬───────────────┘    │
│                   │                     │
│   ┌───────────────▼───────────────┐    │
│   │  API Routes (/api/*)          │    │
│   │  - Auth, Booking, Upload      │    │
│   └─┬─────────────┬────────────┬──┘    │
│     │             │            │        │
└─────┼─────────────┼────────────┼────────┘
      │             │            │
      ↓             ↓            ↓
┌──────────┐  ┌──────────┐  ┌──────────┐
│Salesforce│  │   Lark   │  │PostgreSQL│
│   CRM    │  │ Calendar │  │ Database │
└──────────┘  └──────────┘  └──────────┘
```

### Component Breakdown

| Layer | Components | Responsibility |
|-------|------------|----------------|
| **Presentation** | React Components, Next.js Pages | User interface, user interactions |
| **API** | Next.js API Routes | Business logic, request handling |
| **Integration** | Salesforce API, Lark API | External system communication |
| **Data** | PostgreSQL via Prisma | OAuth tokens, analytics, session data |
| **Authentication** | JWT middleware | Session management, security |

### Key Libraries

| Library | Purpose | File Location |
|---------|---------|---------------|
| `lib/trainer-availability.ts` | Calculate trainer availability | Training booking logic |
| `lib/installer-availability.ts` | Calculate installer availability | Installation booking logic |
| `lib/lark.ts` | Lark Calendar API client | Calendar operations |
| `lib/salesforce.ts` | Salesforce API client | CRM data operations |
| `lib/service-type-detector.ts` | Detect onsite vs remote training | Service type logic |
| `lib/location-matcher.ts` | Map states to location categories | Location-based filtering |
| `lib/calendar-id-manager.ts` | Resolve and cache calendar IDs | Calendar consistency |
| `lib/lark-oauth-service.ts` | OAuth token management | Token refresh, validation |
| `lib/auth.ts` | JWT authentication | Merchant authentication |

---

## Business Rules & Constraints

### Date & Time Rules

#### Universal Booking Rules

| Rule | Constraint | Rationale |
|------|------------|-----------|
| **No Same-Day Booking** | Cannot book appointments for today (D+0) | Minimum 1 business day notice required |
| **Earliest Booking** | Tomorrow (D+1) | Give staff time to prepare |
| **Booking Window** | Maximum 14 days from eligible date | Prevent far-future bookings that may change |
| **Weekdays Only** | Monday - Friday only | Staff availability |
| **No Weekends** | Saturday and Sunday blocked | No staff on weekends |
| **Timezone** | All times in Asia/Singapore (UTC+8) | Consistent timezone handling |

#### Training-Specific Rules

| Rule | Constraint | Reason |
|------|------------|--------|
| **After Installation** | Training date ≥ Installation date + 1 day | Merchant needs system installed first |
| **Before Go-Live** | Training date < Go-Live date | Training completes before going live |
| **After Hardware Fulfillment** | Hardware Fulfillment stage must be complete | Hardware must be ready |
| **Session Duration** | 1 hour sessions | Standard training length |
| **Language Requirement** | At least one trainer speaks merchant's required language | Communication requirement |
| **Location Requirement (Onsite)** | Trainer must cover merchant's location | Physical proximity needed |

#### Installation-Specific Rules

| Rule | Constraint | Reason |
|------|------------|--------|
| **After Hardware Fulfillment** | Hardware Fulfillment stage must be complete | Cannot install without hardware |
| **Before Training** | Installation date < Training date (if training scheduled) | Logical sequence |
| **Before Go-Live** | Installation date < Go-Live date | System must be installed |
| **Session Duration** | 2 hour sessions | Installation takes longer |

### Rescheduling Rules

#### When Rescheduling is Allowed

✅ **Anytime before scheduled date**
✅ **Must give minimum 1 business day notice**
✅ **New date must follow all booking rules**
✅ **New date must respect stage dependencies**

#### Rescheduling Window

| Constraint | Rule | Example |
|------------|------|---------|
| **Minimum Notice** | Cannot reschedule if appointment is tomorrow or today | If appointment is Dec 15, cannot reschedule on Dec 14 or Dec 15 |
| **Must Reschedule By** | D-2 (2 days before) | For Dec 15 appointment, must reschedule by Dec 13 |
| **Can Reschedule To** | Any eligible date within D+1 to D+14 window | From Dec 13, can reschedule to Dec 14-27 |

**Example Scenario:**
```
Current Date: December 10
Scheduled Training: December 15

✅ Can reschedule on Dec 10, 11, 12, 13
❌ Cannot reschedule on Dec 14 or Dec 15
✅ Can reschedule TO: Dec 14, 15, 16... Dec 28 (within 14 day window)
```

#### What Happens During Rescheduling

1. **Old event is deleted** from original trainer/installer calendar
2. **New event is created** in new trainer/installer calendar
3. **Salesforce is updated** with new date and trainer/installer assignment
4. **New event ID is stored** in Salesforce for future rescheduling
5. **Both trainers notified** (old and new)

---

## What the Portal CAN Do

### Merchant Capabilities

✅ **View onboarding progress** in real-time across 8 stages
✅ **Self-service training booking** with real-time availability
✅ **Self-service installation booking** (for Klang Valley, Penang, JB)
✅ **Request installation** (for outside covered areas)
✅ **Reschedule appointments** with automated cleanup
✅ **Upload documents** (menus, videos, business documents)
✅ **View scheduled appointments** with date, time, trainer/installer
✅ **Track completion status** for each onboarding stage
✅ **Access portal 24/7** from any device

### System Capabilities

✅ **Real-time calendar availability** from Lark calendars
✅ **Automated date validation** enforcing business rules
✅ **Location-based trainer filtering** for onsite training
✅ **Language-based trainer filtering**
✅ **Automatic trainer assignment** based on availability and requirements
✅ **Automatic installer assignment** based on location and availability
✅ **Salesforce bi-directional sync** (read and write)
✅ **Calendar event management** (create, delete, update in Lark)
✅ **OAuth token management** with automatic refresh
✅ **Session management** with 24-hour JWT tokens
✅ **Usage analytics tracking** (page views, bookings, uploads)
✅ **Multi-trainer availability aggregation**
✅ **Recurring event handling** in calendar availability
✅ **Graceful error handling** with fallbacks

---

## What the Portal CANNOT Do

### Technical Limitations

❌ **Cannot override business rules** (e.g., booking on weekends)
❌ **Cannot book past dates** or edit historical data
❌ **Cannot skip onboarding stages** (must complete in order)
❌ **Cannot schedule Training before Installation**
❌ **Cannot book same-day appointments**
❌ **Cannot book beyond 14-day window**
❌ **Cannot guarantee specific trainer** (auto-assigned by availability)
❌ **Cannot manually create Salesforce records** (read-only for most fields)
❌ **Cannot modify completed onboarding stages**
❌ **Cannot change service type** (Onsite ↔ Remote) without CSM intervention

### Feature Gaps

❌ **No email notifications** (relies on Lark notifications only)
❌ **No SMS notifications**
❌ **No automated reminders** for upcoming appointments
❌ **No multi-language UI** (English only)
❌ **No mobile app** (web-only, mobile-responsive)
❌ **No video conferencing integration** for remote training
❌ **No payment processing**
❌ **No multi-location support** for single merchant (assumes one location)
❌ **No appointment waiting list** if fully booked
❌ **No bulk operations** (one booking at a time)

### Business Rule Limitations

❌ **Cannot book outside coverage areas** (external vendor required)
❌ **Cannot guarantee immediate confirmation** for external installations
❌ **Cannot override go-live date constraints**
❌ **Cannot force-assign specific trainer/installer**
❌ **Cannot split multi-day training** (single session only)
❌ **Cannot book after business hours** (5 PM latest start)
❌ **Cannot customize time slots** (fixed 1-hour or 2-hour blocks)
❌ **Cannot handle emergency/rush installations**

### Data Limitations

❌ **Cannot modify merchant phone numbers** (Salesforce-managed)
❌ **Cannot change merchant location** after account creation
❌ **Cannot update product configurations**
❌ **Cannot access other merchants' data**
❌ **Cannot view historical bookings** (only current/future)
❌ **Cannot export analytics data** (internal only)

---

## Scheduling Logic & Date Validation

### Date Eligibility Calculation

**Source:** `lib/trainer-availability.ts` (lines 50-95)

#### Step 1: Calculate Base Earliest Date

```typescript
function getEarliestEligibleDate(
  installationDate: Date | null,
  trainingDate: Date | null,
  goLiveDate: Date | null,
  bookingType: 'training' | 'installation'
): Date {
  const today = new Date()
  const tomorrow = addBusinessDays(today, 1) // Always D+1 minimum

  if (bookingType === 'training') {
    // Training must be after Installation
    if (installationDate) {
      const afterInstall = addBusinessDays(installationDate, 1)
      return afterInstall > tomorrow ? afterInstall : tomorrow
    }
  }

  if (bookingType === 'installation') {
    // Installation has no prior stage requirement
    // (Hardware Fulfillment is checked separately)
  }

  return tomorrow
}
```

#### Step 2: Apply Business Day Filter

```typescript
function addBusinessDays(date: Date, days: number): Date {
  let result = new Date(date)
  let addedDays = 0

  while (addedDays < days) {
    result.setDate(result.getDate() + 1)

    // Skip weekends
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++
    }
  }

  return result
}
```

#### Step 3: Calculate Latest Eligible Date

```typescript
const latestDate = addBusinessDays(earliestDate, 14) // 14-day window
```

#### Step 4: Filter Against Go-Live Date

```typescript
if (goLiveDate && latestDate > goLiveDate) {
  latestDate = goLiveDate
}
```

#### Step 5: Generate Date Range

```typescript
const eligibleDates = []
let currentDate = earliestDate

while (currentDate <= latestDate) {
  if (isBusinessDay(currentDate)) {
    eligibleDates.push(currentDate)
  }
  currentDate = addDays(currentDate, 1)
}
```

### Time Slot Availability Logic

**Source:** `lib/trainer-availability.ts` (lines 150-250)

#### For Each Eligible Date and Time Slot:

```typescript
for (const date of eligibleDates) {
  const slots = getTrainingTimeSlots() // 10-11, 12-1, 2:30-3:30, 5-6

  for (const slot of slots) {
    const slotStart = createLocalDate(date, slot.start) // UTC+8
    const slotEnd = createLocalDate(date, slot.end)

    // Check each trainer's availability
    const availableTrainers = []

    for (const trainer of trainers) {
      // Get trainer's busy times from Lark calendar
      const busyTimes = await lark.getFreeBusy(trainer.calendarId, date)

      // Check if slot conflicts with busy times
      const isSlotBusy = busyTimes.some(busy => {
        return (slotStart >= busy.start && slotStart < busy.end) ||
               (slotEnd > busy.start && slotEnd <= busy.end) ||
               (slotStart <= busy.start && slotEnd >= busy.end)
      })

      if (!isSlotBusy) {
        availableTrainers.push(trainer)
      }
    }

    // Slot is available if ANY trainer is free
    const available = availableTrainers.length > 0

    slots.push({
      start: slot.start,
      end: slot.end,
      available: available,
      availableTrainers: availableTrainers.map(t => t.name),
      availableLanguages: getUniqueLanguages(availableTrainers)
    })
  }
}
```

### Location Filtering (Onsite Training Only)

**Source:** `lib/service-type-detector.ts`, `lib/location-matcher.ts`

#### Step 1: Detect Service Type

```typescript
// From Salesforce field: Onboarding_Services_Bought__c
const serviceType = await getServiceType(merchantId)

if (serviceType.includes("Onsite Training")) {
  // Apply location filtering
  shouldFilterByLocation = true
} else if (serviceType.includes("Remote Training")) {
  // No location filtering
  shouldFilterByLocation = false
} else {
  // Service type not configured
  throw new Error("Training delivery method not configured")
}
```

#### Step 2: Match Merchant Location

```typescript
// Map merchant's state to location category
const merchantState = merchant.Shipping_State__c // e.g., "Selangor"
const locationCategory = mapStateToLocation(merchantState)
// Returns: "Within Klang Valley", "Penang", "Johor Bahru", or "Outside Klang Valley"
```

#### Step 3: Filter Trainers

```typescript
let eligibleTrainers = allTrainers

if (shouldFilterByLocation) {
  eligibleTrainers = allTrainers.filter(trainer => {
    // Trainers with no location restriction can serve anywhere
    if (!trainer.locations || trainer.locations.length === 0) {
      return true
    }

    // Check if trainer covers merchant's location
    return trainer.locations.includes(locationCategory)
  })
}
```

#### Location Mapping

| Merchant State | Location Category | Available Trainers |
|----------------|-------------------|-------------------|
| Selangor, Kuala Lumpur, Putrajaya | Within Klang Valley | John Lai, Vwie Gan, Khairul Uwais, Evelyn Cham |
| Penang, Pulau Pinang | Penang | Suvisa Foo |
| Johor, Johor Bahru | Johor Bahru | Farhan Nasir |
| Other states | Outside Klang Valley | (Contact CSM) |

---

## Rescheduling System

### Complete Rescheduling Flow

**Source:** `app/api/lark/book-training/route.ts` (lines 200-350)

#### Scenario: Merchant reschedules training from Dec 15 (Trainer A) to Dec 20 (Trainer B)

##### Step 1: Query Current Trainer & Event ID from Salesforce

```typescript
// Get current trainer assignment
const onboardingTrainer = await salesforce.query(`
  SELECT CSM_Name__c, CSM_Name__r.Email
  FROM Onboarding_Trainer__c
  WHERE Id = '${merchantId}'
`)

const currentTrainerId = onboardingTrainer.CSM_Name__c // User ID
const currentTrainerEmail = onboardingTrainer.CSM_Name__r.Email

// Get current event ID
const onboardingPortal = await salesforce.query(`
  SELECT Training_Event_ID__c
  FROM Onboarding_Portal__c
  WHERE Onboarding_Trainer__c = '${merchantId}'
`)

const existingEventId = onboardingPortal.Training_Event_ID__c
```

**Why this matters:** Previous versions tried to delete events from the wrong trainer's calendar, causing orphaned events.

##### Step 2: Delete Old Event from Current Trainer's Calendar

```typescript
if (existingEventId && currentTrainerEmail) {
  try {
    await larkService.cancelTraining(
      currentTrainerEmail,  // Use current trainer's email
      existingEventId       // Event ID from Salesforce
    )

    console.log(`✅ Deleted event ${existingEventId} from ${currentTrainerEmail}`)
  } catch (error) {
    console.warn(`⚠️ Could not delete old event: ${error.message}`)
    // Continue with new booking anyway
  }
}
```

**Lark API Call:**
```typescript
DELETE /open-apis/calendar/v4/calendars/{calendar_id}/events/{event_id}
```

##### Step 3: Calculate Availability for New Date

```typescript
const availability = await getTrainerAvailability(
  newDate,
  merchantLocation,
  serviceType,
  requiredLanguage
)

// Find available trainers for selected time slot
const selectedSlot = availability.find(slot =>
  slot.start === requestedTime
)

if (!selectedSlot.available) {
  throw new Error("Selected time slot is not available")
}
```

##### Step 4: Select New Trainer

```typescript
// Pick first available trainer for the new time slot
const newTrainer = selectedSlot.availableTrainers[0]

// Look up new trainer's details
const newTrainerConfig = trainersConfig.trainers.find(t =>
  t.name === newTrainer
)

const newTrainerEmail = newTrainerConfig.email
const newTrainerId = await salesforce.getUserIdByEmail(newTrainerEmail)
```

##### Step 5: Create New Event in New Trainer's Calendar

```typescript
const newEventId = await larkService.createTrainingEvent({
  trainerEmail: newTrainerEmail,
  merchantName: merchant.companyName,
  trainingDate: newDate,
  startTime: requestedTime,
  duration: 60, // minutes
  location: merchant.address,
  notes: `Training session for ${merchant.companyName}`
})

console.log(`✅ Created new event ${newEventId} in ${newTrainerEmail}'s calendar`)
```

**Lark API Call:**
```typescript
POST /open-apis/calendar/v4/calendars/{calendar_id}/events
{
  "summary": "Training: [Merchant Name]",
  "start_time": {
    "timestamp": "1702800000" // Unix timestamp
  },
  "end_time": {
    "timestamp": "1702803600"
  },
  "location": "Merchant Address",
  "description": "Training session details"
}
```

##### Step 6: Update Salesforce with New Assignment

```typescript
// Update trainer assignment
await salesforce.update('Onboarding_Trainer__c', merchantId, {
  CSM_Name__c: newTrainerId,  // New trainer's User ID
  Training_Date__c: newDate    // New training date
})

// Update event ID in Onboarding Portal
await salesforce.update('Onboarding_Portal__c', portalRecordId, {
  Training_Event_ID__c: newEventId  // New event ID for future rescheduling
})

console.log(`✅ Updated Salesforce: Trainer ${newTrainerId}, Date ${newDate}, Event ${newEventId}`)
```

##### Step 7: Send Notifications

```typescript
// Notify new trainer
await larkService.sendNotification(
  newTrainerEmail,
  `New training scheduled: ${merchant.companyName} on ${newDate} at ${requestedTime}`
)

// Optionally notify old trainer (if different)
if (newTrainerEmail !== currentTrainerEmail) {
  await larkService.sendNotification(
    currentTrainerEmail,
    `Training for ${merchant.companyName} on ${oldDate} has been rescheduled`
  )
}
```

### Critical Fields Used in Rescheduling

| Object | Field | Purpose |
|--------|-------|---------|
| `Onboarding_Trainer__c` | `CSM_Name__c` | Current trainer assignment (User lookup) |
| `Onboarding_Trainer__c` | `Training_Date__c` | Current training date |
| `Onboarding_Portal__c` | `Training_Event_ID__c` | Lark event ID for deletion |
| `User` | `Email` | Trainer's email for Lark API |

**⚠️ Critical:** Always query `CSM_Name__c` to get the current trainer before deleting events. Never assume the trainer hasn't changed.

---

## Trainer Assignment Logic

### Dynamic Trainer Selection

**Source:** `config/trainers.json`, `lib/trainer-availability.ts`

#### Trainer Configuration

```json
{
  "trainers": [
    {
      "name": "John Lai",
      "email": "john.lai@storehub.com",
      "languages": ["English"],
      "locations": ["Within Klang Valley"],
      "larkUserId": "ou_xxx",
      "calendarId": "xxx",
      "salesforceId": ""
    },
    {
      "name": "Vwie Gan",
      "email": "vwie.gan@storehub.com",
      "languages": ["English", "Bahasa Malaysia", "Chinese"],
      "locations": ["Within Klang Valley"],
      "larkUserId": "ou_yyy",
      "calendarId": "yyy",
      "salesforceId": ""
    }
  ]
}
```

#### Assignment Priority (in order)

1. **Service Type Match**
   - Onsite training → Filter by location
   - Remote training → All trainers available

2. **Location Match** (if onsite)
   - Merchant in Klang Valley → Only Klang Valley trainers
   - Merchant in Penang → Only Penang trainers
   - Merchant in Johor Bahru → Only Johor Bahru trainers

3. **Language Match**
   - Filter trainers who speak required language
   - Required language from Salesforce or merchant preference

4. **Availability Match**
   - Check Lark calendar for busy times
   - Only show slots where at least ONE trainer is free

5. **First Available Selection**
   - When booking, select first available trainer from filtered list
   - Merchant doesn't choose specific trainer

#### Example Assignment Scenarios

**Scenario 1: Onsite Training, Klang Valley, English**
```
Eligible Trainers: John Lai, Vwie Gan, Khairul Uwais, Evelyn Cham
Selected: First available from this list at requested time
```

**Scenario 2: Onsite Training, Penang, Chinese**
```
Location Filter: Penang → Suvisa Foo
Language Filter: Chinese → Suvisa Foo (speaks Chinese)
Eligible Trainers: Suvisa Foo
Selected: Suvisa Foo (if available)
```

**Scenario 3: Remote Training, English**
```
Location Filter: None (remote)
Language Filter: English → All trainers
Eligible Trainers: All 6 trainers
Selected: First available from all trainers
```

**Scenario 4: Onsite Training, Outside Klang Valley**
```
Location Filter: Outside Klang Valley → No trainers configured
Eligible Trainers: None
Result: "No trainers available" → Contact CSM
```

---

## Installer Assignment Logic

### Internal vs External Installers

**Source:** `config/installers.json`, `lib/installer-availability.ts`

#### Location-Based Assignment

```typescript
function getInstallerType(merchantLocation: string): string {
  const locationCategory = mapStateToLocation(merchantLocation)

  switch (locationCategory) {
    case 'Within Klang Valley':
      return 'internal' // Use calendar-based booking

    case 'Penang':
      return 'internal' // Use calendar-based booking

    case 'Johor Bahru':
      return 'internal' // Use calendar-based booking

    case 'Outside Klang Valley':
      return 'external' // Use request-based booking

    default:
      return 'external'
  }
}
```

#### Internal Installer Configuration

```json
{
  "internal": {
    "klangValley": {
      "installers": [
        {
          "name": "Fattah",
          "email": "fattah@storehub.com",
          "larkUserId": "ou_aaa",
          "calendarId": "aaa"
        },
        {
          "name": "Fairul",
          "email": "fairul@storehub.com",
          "larkUserId": "ou_bbb",
          "calendarId": "bbb"
        },
        {
          "name": "Azroll",
          "email": "azroll@storehub.com",
          "larkUserId": "ou_ccc",
          "calendarId": "ccc"
        }
      ]
    },
    "penang": {
      "installers": [
        {
          "name": "Steven Tan",
          "email": "steven.tan@storehub.com",
          "larkUserId": "ou_ddd",
          "calendarId": "ddd"
        }
      ]
    }
  }
}
```

#### External Installer Configuration

```json
{
  "external": {
    "vendorName": "External Installation Partners",
    "contactEmail": "installations@externalvendor.com",
    "contactPhone": "+60 3-XXXX-XXXX",
    "responseTime": "24 hours",
    "bookingType": "request-based"
  }
}
```

#### Internal Installation Flow

```
1. Merchant selects date from calendar
2. System checks availability of all installers in merchant's region
3. Slot is available if ANY installer is free
4. System auto-assigns first available installer
5. Calendar event created immediately
6. Status: "Scheduled"
7. Salesforce updated with installer and date
```

#### External Installation Flow

```
1. Merchant submits installation request
2. Request sent to external vendor
3. Status: "Pending Vendor Confirmation"
4. Vendor calls merchant within 24 hours
5. Manual coordination of date and time
6. Vendor confirms date
7. Vendor updates portal (or CSM updates)
8. Status: "Scheduled"
```

---

## Salesforce Integration

### Key Objects & Fields

#### Onboarding_Trainer__c (Primary Merchant Record)

| Field API Name | Type | Purpose |
|----------------|------|---------|
| `Id` | ID | Unique record ID |
| `Name` | Text | Merchant name |
| `CSM_Name__c` | Lookup (User) | Current assigned trainer |
| `Training_Date__c` | Date | Scheduled training date |
| `Installation_Date__c` | Date | Scheduled installation date |
| `Go_Live_Date__c` | Date | Target go-live date |
| `Merchant_Location__c` | Picklist | State/location |
| `Shipping_State__c` | Text | Merchant shipping state |
| `Onboarding_Services_Bought__c` | Picklist | "Onsite Training" or "Remote Training" |
| `Business_Owner__c` | Text | Owner name |
| `Business_Owner_Contact__c` | Phone | Owner phone (used for PIN auth) |
| `Merchant_PIC__c` | Text | PIC name |
| `Merchant_PIC_Contact__c` | Phone | PIC phone (used for PIN auth) |
| `Operation_Manager__c` | Text | Ops manager name |
| `Operation_Manager_Contact__c` | Phone | Ops phone (used for PIN auth) |
| `Stage_1_Preparation__c` | Checkbox | Stage 1 complete |
| `Stage_2_Kickoff_Call__c` | Checkbox | Stage 2 complete |
| `Stage_3_Hardware_Fulfillment__c` | Checkbox | Stage 3 complete |
| `Stage_4_Product_Setup__c` | Checkbox | Stage 4 complete |
| `Stage_5_Installation__c` | Checkbox | Stage 5 complete |
| `Stage_6_Training__c` | Checkbox | Stage 6 complete |
| `Stage_7_Ready_Go_Live__c` | Checkbox | Stage 7 complete |
| `Stage_8_Go_Live__c` | Checkbox | Stage 8 complete (final) |

#### Onboarding_Portal__c (Portal-Specific Data)

| Field API Name | Type | Purpose |
|----------------|------|---------|
| `Id` | ID | Unique record ID |
| `Onboarding_Trainer__c` | Lookup | Link to Onboarding_Trainer__c |
| `Training_Event_ID__c` | Text | Lark event ID for rescheduling |
| `Installation_Event_ID__c` | Text | Lark event ID for rescheduling |
| `Portal_Last_Accessed__c` | DateTime | Last portal login |
| `Documents_Uploaded__c` | Number | Count of uploaded documents |

#### User (Salesforce Standard)

| Field API Name | Type | Purpose |
|----------------|------|---------|
| `Id` | ID | Unique user ID (used in CSM_Name__c) |
| `Email` | Email | Trainer/installer email |
| `Name` | Text | Trainer/installer name |

### API Operations

#### Read Operations

```typescript
// Get merchant data
const merchant = await salesforce.query(`
  SELECT Id, Name, CSM_Name__c, Training_Date__c, Installation_Date__c,
         Go_Live_Date__c, Merchant_Location__c, Shipping_State__c,
         Onboarding_Services_Bought__c, Business_Owner_Contact__c,
         Stage_1_Preparation__c, Stage_2_Kickoff_Call__c,
         Stage_3_Hardware_Fulfillment__c, Stage_4_Product_Setup__c,
         Stage_5_Installation__c, Stage_6_Training__c,
         Stage_7_Ready_Go_Live__c, Stage_8_Go_Live__c
  FROM Onboarding_Trainer__c
  WHERE Name = '${merchantSlug}'
  LIMIT 1
`)

// Get current trainer email
const trainer = await salesforce.query(`
  SELECT CSM_Name__r.Email
  FROM Onboarding_Trainer__c
  WHERE Id = '${merchantId}'
`)

// Get event ID
const portal = await salesforce.query(`
  SELECT Training_Event_ID__c
  FROM Onboarding_Portal__c
  WHERE Onboarding_Trainer__c = '${merchantId}'
`)
```

#### Write Operations

```typescript
// Update training assignment
await salesforce.update('Onboarding_Trainer__c', merchantId, {
  CSM_Name__c: newTrainerId,
  Training_Date__c: '2025-12-20'
})

// Update event ID
await salesforce.update('Onboarding_Portal__c', portalRecordId, {
  Training_Event_ID__c: 'evt_new_event_id'
})

// Update installation
await salesforce.update('Onboarding_Trainer__c', merchantId, {
  Installation_Date__c: '2025-12-15'
})

// Mark stage as complete
await salesforce.update('Onboarding_Trainer__c', merchantId, {
  Stage_5_Installation__c: true
})
```

### Authentication with Salesforce

**OAuth 2.0 Password Flow**

```typescript
const auth = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'password',
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
    username: SF_USERNAME,
    password: `${SF_PASSWORD}${SF_SECURITY_TOKEN}`
  })
})

const { access_token, instance_url } = await auth.json()
```

**All subsequent API calls:**
```typescript
fetch(`${instance_url}/services/data/v58.0/sobjects/Onboarding_Trainer__c/${id}`, {
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  }
})
```

---

## Lark Calendar Integration

### OAuth 2.0 Authorization Flow

**Source:** `lib/lark-oauth-service.ts`, `app/api/lark/auth/authorize/route.ts`

#### Step 1: Trainer/Installer Initiates Authorization

```
Trainer visits: /trainers/authorize
Installer visits: /installers/authorize
```

#### Step 2: Redirect to Lark Authorization

```typescript
const authUrl = `https://open.larksuite.com/open-apis/authen/v1/authorize?` +
  `app_id=${LARK_APP_ID}` +
  `&redirect_uri=${CALLBACK_URL}` +
  `&scope=calendar:calendar:readonly calendar:event:readonly calendar:event:write calendar:freebusy:readonly` +
  `&state=${userEmail}`

// Redirect user to Lark
res.redirect(authUrl)
```

#### Step 3: Lark Redirects Back with Authorization Code

```
Callback URL: /api/lark/auth/callback?code=xxx&state=user@storehub.com
```

#### Step 4: Exchange Code for Access Token

```typescript
const tokenResponse = await fetch(
  'https://open.larksuite.com/open-apis/authen/v1/access_token',
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${APP_ACCESS_TOKEN}` },
    body: JSON.stringify({ grant_type: 'authorization_code', code: authCode })
  }
)

const { access_token, refresh_token, expires_in, user_info } = await tokenResponse.json()
```

#### Step 5: Store Tokens in Database

```typescript
await prisma.larkAuthToken.upsert({
  where: { userEmail: userEmail },
  create: {
    userEmail: userEmail,
    larkUserId: user_info.user_id,
    userName: user_info.name,
    userType: 'trainer', // or 'installer'
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: new Date(Date.now() + expires_in * 1000),
    calendarId: null // Resolved later
  },
  update: {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: new Date(Date.now() + expires_in * 1000)
  }
})
```

#### Step 6: Resolve Calendar ID

**Source:** `lib/calendar-id-manager.ts`

```typescript
// Check cache first (5-minute TTL)
let calendarId = cache.get(userEmail)

if (!calendarId) {
  // Query database
  const token = await prisma.larkAuthToken.findUnique({
    where: { userEmail: userEmail }
  })

  if (token?.calendarId) {
    calendarId = token.calendarId
    cache.set(userEmail, calendarId)
  } else {
    // Resolve from Lark API
    const calendars = await larkApi.getCalendarList(access_token)
    const primaryCalendar = calendars.find(c => c.is_primary) || calendars[0]

    calendarId = primaryCalendar.calendar_id

    // Store in database
    await prisma.larkAuthToken.update({
      where: { userEmail: userEmail },
      data: { calendarId: calendarId }
    })

    cache.set(userEmail, calendarId)
  }
}

return calendarId
```

**Why Calendar ID Management is Critical:**
- Prevents reading from one calendar and writing to another
- Eliminates double-booking issues
- Ensures consistency across operations

### Calendar API Operations

#### Get Free/Busy Information

**Endpoint:** `/open-apis/calendar/v4/freebusy/query`

```typescript
const response = await fetch(
  'https://open.larksuite.com/open-apis/calendar/v4/freebusy/query',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: larkUserId,
      start_time: startTimestamp,
      end_time: endTimestamp
    })
  }
)

const { freebusy_list } = await response.json()

// Returns array of busy time ranges
// [
//   { start_time: "1702800000", end_time: "1702803600" },
//   { start_time: "1702810000", end_time: "1702813600" }
// ]
```

#### Get Calendar Events (with Recurring Events)

**Endpoint:** `/open-apis/calendar/v4/calendars/{calendar_id}/events`

```typescript
const events = await fetch(
  `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events?` +
  `start_time=${startTimestamp}&end_time=${endTimestamp}`,
  {
    headers: { 'Authorization': `Bearer ${access_token}` }
  }
)

// For recurring events, expand instances
for (const event of events) {
  if (event.recurring_rule) {
    const instances = await fetch(
      `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events/${event.event_id}/instances?` +
      `start_time=${startTimestamp}&end_time=${endTimestamp}`,
      {
        headers: { 'Authorization': `Bearer ${access_token}` }
      }
    )

    // Add all instances to busy times
  }
}
```

**Important:** Always check `free_busy_status === "busy"` and `status === "confirmed"` when processing events.

#### Create Calendar Event

**Endpoint:** `/open-apis/calendar/v4/calendars/{calendar_id}/events`

```typescript
const createResponse = await fetch(
  `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary: `Training: ${merchantName}`,
      description: `Training session for ${merchantName}`,
      start_time: {
        timestamp: startTimestamp.toString()
      },
      end_time: {
        timestamp: endTimestamp.toString()
      },
      location: merchantAddress,
      visibility: 'private',
      attendee_ability: 'can_see_others',
      free_busy_status: 'busy',
      reminders: [
        { minutes: 60 } // 1 hour before
      ]
    })
  }
)

const { event_id } = await createResponse.json()
return event_id // Store in Salesforce for rescheduling
```

#### Delete Calendar Event

**Endpoint:** `/open-apis/calendar/v4/calendars/{calendar_id}/events/{event_id}`

```typescript
await fetch(
  `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events/${eventId}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${access_token}`
    }
  }
)
```

**Critical for Rescheduling:** Always delete from the CURRENT trainer's calendar, not the new trainer.

---

## Critical System Flows

### Training Booking Complete Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Merchant clicks "Schedule Training"                   │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 2. System checks prerequisites                           │
│    ✓ Hardware Fulfillment complete?                      │
│    ✓ Installation complete or scheduled?                 │
│    ✓ Service type configured in Salesforce?              │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Detect service type                                   │
│    - Query Onboarding_Services_Bought__c                 │
│    - Determine if onsite or remote                       │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Filter trainers                                       │
│    - If onsite: Filter by location                       │
│    - Filter by language requirement                      │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Calculate date range                                  │
│    - Earliest: Tomorrow OR Installation + 1 day          │
│    - Latest: Earliest + 14 days OR Go-Live date          │
│    - Exclude weekends                                    │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Get trainer availability                              │
│    - For each eligible trainer:                          │
│      • Resolve calendar ID                               │
│      • Query Lark FreeBusy API                           │
│      • Query Lark Events API (with recurring expansion)  │
│    - For each date and time slot:                        │
│      • Check if ANY trainer is free                      │
│      • Aggregate available trainers                      │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Display calendar to merchant                          │
│    - Show available dates (green)                        │
│    - Show unavailable dates (gray)                       │
│    - Show time slots with availability                   │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 8. Merchant selects date and time                        │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 9. System selects trainer                                │
│    - Pick first available trainer from filtered list     │
│    - Get trainer's email and calendar ID                 │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 10. Create calendar event                                │
│     - Call Lark API to create event                      │
│     - Receive event ID from Lark                         │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 11. Update Salesforce                                    │
│     - Update Onboarding_Trainer__c:                      │
│       • CSM_Name__c = trainer User ID                    │
│       • Training_Date__c = selected date                 │
│     - Update Onboarding_Portal__c:                       │
│       • Training_Event_ID__c = event ID from Lark        │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 12. Send notification                                    │
│     - Notify trainer via Lark                            │
│     - Display success message to merchant                │
└─────────────────────────────────────────────────────────┘
```

### Installation Booking Complete Flow (Internal)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Merchant clicks "Schedule Installation"               │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 2. System checks prerequisites                           │
│    ✓ Hardware Fulfillment complete?                      │
│    ✓ Merchant location is Klang Valley/Penang/JB?        │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Load installers for merchant's region                 │
│    - Klang Valley: 3 installers                          │
│    - Penang: 1 installer                                 │
│    - Johor Bahru: 1 installer                            │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Calculate date range                                  │
│    - Earliest: Tomorrow                                  │
│    - Latest: Training date (if scheduled) OR +14 days    │
│    - Exclude weekends                                    │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Get installer availability                            │
│    - For each installer in region:                       │
│      • Resolve calendar ID                               │
│      • Query Lark FreeBusy API                           │
│    - For each date and time slot (2-hour blocks):        │
│      • Check if ANY installer is free                    │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Display calendar to merchant                          │
│    - Show available dates and time slots                 │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Merchant selects date and time                        │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 8. System selects installer                              │
│    - Pick first available installer for selected slot    │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 9. Create calendar event                                 │
│    - Call Lark API to create 2-hour installation event   │
│    - Receive event ID                                    │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 10. Update Salesforce                                    │
│     - Update Installation_Date__c                        │
│     - Update Installation_Event_ID__c (if field exists)  │
│     - Mark Stage_5_Installation__c = true                │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 11. Send notification                                    │
│     - Notify installer via Lark                          │
│     - Display success message to merchant                │
└─────────────────────────────────────────────────────────┘
```

---

## Known Limitations

### Technical Debt

1. **No Email Notifications**
   - System only sends Lark notifications
   - Merchants don't receive email confirmations
   - **Impact:** Medium | **Workaround:** Manual CSM emails

2. **Single Session Training Only**
   - Cannot schedule multi-day or multi-session training
   - **Impact:** Low | **Workaround:** CSM manually schedules additional sessions

3. **No Waiting List**
   - If all trainers busy, merchant sees "No availability"
   - Cannot join waiting list or get notified when slots open
   - **Impact:** Medium | **Workaround:** Try different dates or contact CSM

4. **Fixed Time Slots**
   - Cannot customize time slot durations
   - Trainers cannot define custom availability windows
   - **Impact:** Low | **Workaround:** Block calendar for unavailable times

5. **No Bulk Operations**
   - Cannot schedule multiple merchants at once (admin feature)
   - **Impact:** Low | **Workaround:** Manual scheduling

### Data Synchronization

1. **Salesforce as Source of Truth**
   - Portal reads from Salesforce but cannot create records
   - Merchant records must exist in Salesforce first
   - **Impact:** Critical | **Workaround:** CSM creates records manually

2. **No Offline Mode**
   - Portal requires internet connection
   - Cannot cache data locally
   - **Impact:** Low | **Workaround:** Requires stable internet

3. **No Real-Time Updates**
   - Changes in Salesforce don't auto-refresh portal (requires page reload)
   - **Impact:** Low | **Workaround:** Refresh page to see updates

### Security & Access Control

1. **PIN-Based Auth Only**
   - No password reset flow
   - No email/password authentication option
   - **Impact:** Medium | **Workaround:** Contact CSM to verify phone

2. **No Role-Based Access Control**
   - All merchants have same permissions
   - Cannot restrict specific features
   - **Impact:** Low | **Current State:** All features available to all merchants

3. **No Audit Logs (User-Facing)**
   - Merchants cannot see history of changes
   - **Impact:** Low | **Workaround:** Backend logs exist for debugging

### Business Logic Gaps

1. **Cannot Handle Emergency Installations**
   - No "urgent" or "rush" booking option
   - All bookings require D+1 minimum
   - **Impact:** Medium | **Workaround:** CSM manually coordinates

2. **Cannot Split Multi-Location Merchants**
   - System assumes one location per merchant
   - Multi-branch merchants require manual coordination
   - **Impact:** Low | **Workaround:** CSM handles multi-location separately

3. **No Trainer Preference**
   - Merchants cannot request specific trainer
   - Assignment is automatic
   - **Impact:** Low | **Workaround:** CSM can manually reassign

---

## Recent Bug Fixes

### November 2025 Fixes (Commit: 366fccc)

#### Issue #1: Combined Availability Showing All Trainers

**Problem:**
- When checking availability, system showed combined view of all trainers
- Merchant couldn't see specific trainer's schedule
- Caused confusion when trying to reschedule with same trainer

**Fix:**
- Added `getSingleTrainerAvailability()` function (lib/trainer-availability.ts:400)
- `/api/lark/availability` now accepts `trainerName` parameter
- When `trainerName` provided, shows only that trainer's availability
- When not provided, shows combined view (existing behavior)

**Testing:**
```bash
# Test combined availability
curl "http://localhost:3010/api/lark/availability?startDate=2025-12-01&endDate=2025-12-14&merchantId=xxx"

# Test single trainer availability
curl "http://localhost:3010/api/lark/availability?startDate=2025-12-01&endDate=2025-12-14&merchantId=xxx&trainerName=John%20Lai"
```

#### Issue #2: Location Filtering Not Applied

**Problem:**
- System showed all trainers regardless of merchant location
- Onsite training should filter by location
- Remote training should show all trainers

**Fix:**
- Enhanced `service-type-detector.ts` to properly detect onsite vs remote
- Updated `trainer-availability.ts` to pass merchant address to availability API
- API now filters trainers by location for onsite training
- Proper use of `location-matcher.ts` to map states to location categories

**Testing:**
```bash
# Test with Klang Valley merchant (should show 4 trainers)
curl "http://localhost:3010/api/lark/availability?merchantId=klang-valley-merchant"

# Test with Penang merchant (should show 1 trainer)
curl "http://localhost:3010/api/lark/availability?merchantId=penang-merchant"
```

#### Issue #3: Rescheduling Deletes from Wrong Calendar

**Problem:**
- When rescheduling, system deleted event from new trainer's calendar instead of old
- Caused orphaned events in old trainer's calendar
- Double-booking issues occurred

**Root Cause:**
- System assumed current trainer when deleting event
- Didn't query Salesforce for actual current trainer assignment

**Fix (app/api/lark/book-training/route.ts:200-250):**
```typescript
// BEFORE (incorrect)
const currentTrainer = requestBody.trainerName // Wrong! This is NEW trainer

// AFTER (correct)
// Step 1: Query Salesforce for current trainer
const onboardingTrainer = await salesforce.query(`
  SELECT CSM_Name__c, CSM_Name__r.Email
  FROM Onboarding_Trainer__c
  WHERE Id = '${merchantId}'
`)
const currentTrainerEmail = onboardingTrainer.CSM_Name__r.Email

// Step 2: Query event ID from Salesforce
const portal = await salesforce.query(`
  SELECT Training_Event_ID__c
  FROM Onboarding_Portal__c
  WHERE Onboarding_Trainer__c = '${merchantId}'
`)
const eventId = portal.Training_Event_ID__c

// Step 3: Delete from CURRENT trainer's calendar
await larkService.cancelTraining(currentTrainerEmail, eventId)

// Step 4: Create new event with NEW trainer
// Step 5: Update Salesforce with new trainer and new event ID
```

**Documentation Updated:**
- Added comprehensive flow diagrams
- Documented critical fields used
- Created troubleshooting guide for rescheduling issues

**Testing:**
```bash
# Test rescheduling flow
1. Book training with Trainer A on Dec 15
2. Verify event created in Trainer A's calendar
3. Reschedule to Dec 20 with Trainer B
4. Verify old event deleted from Trainer A
5. Verify new event created in Trainer B
6. Verify Salesforce updated with Trainer B and new event ID
```

---

## Configuration Management

### Trainer Configuration

**File:** `config/trainers.json`

**Structure:**
```json
{
  "trainers": [
    {
      "name": "John Lai",
      "email": "john.lai@storehub.com",
      "languages": ["English"],
      "locations": ["Within Klang Valley"],
      "larkUserId": "ou_xxx",
      "calendarId": "xxx",
      "salesforceId": ""
    }
  ]
}
```

**Fields:**
- `name`: Display name for trainer
- `email`: Email for Lark API and OAuth
- `languages`: Array of supported languages
- `locations`: Array of location categories trainer covers
- `larkUserId`: Lark user ID (from OAuth or Lark admin)
- `calendarId`: Resolved calendar ID (populated dynamically)
- `salesforceId`: Salesforce User ID (populated dynamically)

**Adding New Trainer:**
1. Add entry to `config/trainers.json`
2. Trainer must authorize OAuth at `/trainers/authorize`
3. System auto-resolves calendar ID on first use
4. System auto-resolves Salesforce ID from email lookup

**Modifying Trainer Availability:**
- Trainers block time in their Lark calendar
- System automatically respects calendar busy times
- No code changes needed

### Installer Configuration

**File:** `config/installers.json`

**Structure:**
```json
{
  "internal": {
    "klangValley": {
      "installers": [...]
    },
    "penang": {
      "installers": [...]
    },
    "johorBahru": {
      "installers": [...]
    }
  },
  "external": {
    "vendorName": "External Installation Partners",
    "contactEmail": "installations@externalvendor.com",
    "contactPhone": "+60 3-XXXX-XXXX"
  }
}
```

**Adding New Internal Installer:**
1. Add entry to appropriate region in `config/installers.json`
2. Installer must authorize OAuth at `/installers/authorize`
3. System auto-resolves calendar ID

**Adding New Region:**
1. Add new region to `config/installers.json`
2. Update `location-matcher.ts` to map states to new region
3. Update `installer-availability.ts` to handle new region

---

## Troubleshooting Guide

### Issue: "No trainers available for any date"

**Possible Causes:**
1. All trainers busy for entire 14-day window
2. No trainers match location requirement (onsite training)
3. No trainers speak required language
4. Service type not configured in Salesforce
5. Trainers haven't authorized OAuth

**Debugging Steps:**
```bash
# 1. Check service type
curl "http://localhost:3010/api/salesforce/merchant/${merchantId}" | jq '.Onboarding_Services_Bought__c'

# 2. Check trainer OAuth status
curl "http://localhost:3010/api/trainers/authorization-status"

# 3. Check specific trainer's calendar
curl "http://localhost:3010/api/lark/availability?merchantId=${merchantId}&trainerName=John%20Lai"

# 4. Check merchant location
curl "http://localhost:3010/api/salesforce/merchant/${merchantId}" | jq '.Shipping_State__c'
```

**Solutions:**
- Ensure `Onboarding_Services_Bought__c` is set in Salesforce
- Verify trainers have authorized OAuth
- Check if merchant location has coverage
- Try different dates or time slots
- Consider switching from onsite to remote training

### Issue: "Event not found" during rescheduling

**Possible Causes:**
1. Event ID not stored in Salesforce
2. Event already deleted from calendar
3. Trainer's calendar access revoked
4. Event ID is invalid

**Debugging Steps:**
```bash
# 1. Check event ID in Salesforce
curl "http://localhost:3010/api/salesforce/merchant/${merchantId}" | jq '.portal.Training_Event_ID__c'

# 2. Verify event exists in Lark
curl "http://localhost:3010/api/debug/check-event-exists?eventId=${eventId}&trainerEmail=${email}"

# 3. Check trainer's OAuth status
curl "http://localhost:3010/api/trainers/authorization-status" | jq ".[] | select(.email == \"${email}\")"
```

**Solutions:**
- If event ID missing: Continue with new booking (don't block on deletion)
- If trainer's access revoked: Trainer must re-authorize
- If event already deleted: Continue with new booking (log warning)

### Issue: Double-booking occurs

**Possible Causes:**
1. Multiple merchants booking same time slot simultaneously (race condition)
2. Trainer manually adds event in Lark that conflicts
3. Recurring event not properly expanded
4. Calendar ID mismatch (reading from one calendar, writing to another)

**Debugging Steps:**
```bash
# 1. Check calendar ID consistency
curl "http://localhost:3010/api/debug/calendar-test?trainerEmail=${email}"

# 2. Verify calendar events
curl "http://localhost:3010/api/debug/check-trainer-busy?trainerEmail=${email}&date=2025-12-15"

# 3. Check both FreeBusy and Events API results
tail -f logs/availability.log
```

**Solutions:**
- Verify Calendar ID Manager is being used consistently
- Check that recurring events are expanded via `/instances` endpoint
- Implement optimistic locking (future enhancement)
- Ask trainers to mark manual events as "busy"

### Issue: Merchant can't login

**Possible Causes:**
1. Phone number mismatch between portal and Salesforce
2. Merchant entering wrong phone number
3. Rate limiting (5 attempts per 15 minutes)
4. Session cookie issues

**Debugging Steps:**
```bash
# 1. Check merchant phone numbers in Salesforce
curl "http://localhost:3010/api/salesforce/merchant/${merchantId}" | jq '.Business_Owner_Contact__c, .Merchant_PIC_Contact__c, .Operation_Manager_Contact__c'

# 2. Check rate limiting
# Look for merchant IP in rate limit logs

# 3. Test with correct phone
curl -X POST "http://localhost:3010/api/auth/merchant-login" \
  -H "Content-Type: application/json" \
  -d "{\"merchantId\": \"${merchantId}\", \"pin\": \"1234\"}"
```

**Solutions:**
- Verify phone numbers match in Salesforce
- Instruct merchant to use last 4 digits only
- Wait 15 minutes if rate limited
- Clear cookies and try again

### Issue: Salesforce updates not reflecting

**Possible Causes:**
1. API call failed silently
2. Field-level security blocking write
3. Wrong object or field name
4. Salesforce token expired

**Debugging Steps:**
```bash
# 1. Check Salesforce connection
curl "http://localhost:3010/api/debug/test-merchant-data?merchantId=${merchantId}"

# 2. Check recent API logs
tail -f logs/salesforce.log

# 3. Verify field accessibility
# Check Salesforce field-level security settings

# 4. Test direct Salesforce update
curl -X POST "http://localhost:3010/api/salesforce/update-training-date" \
  -H "Content-Type: application/json" \
  -d "{\"merchantId\": \"${merchantId}\", \"trainingDate\": \"2025-12-15\"}"
```

**Solutions:**
- Ensure Salesforce user has write access to fields
- Check API logs for error responses
- Refresh Salesforce access token
- Verify field API names are correct

---

## Appendices

### A. Time Slot Definitions

**Training Time Slots (Asia/Singapore timezone):**

| Slot | Start | End | Duration |
|------|-------|-----|----------|
| 1 | 10:00 AM | 11:00 AM | 1 hour |
| 2 | 12:00 PM | 1:00 PM | 1 hour |
| 3 | 2:30 PM | 3:30 PM | 1 hour |
| 4 | 5:00 PM | 6:00 PM | 1 hour |

**Installation Time Slots (Asia/Singapore timezone):**

| Slot | Start | End | Duration |
|------|-------|-----|----------|
| 1 | 10:00 AM | 12:00 PM | 2 hours |
| 2 | 12:00 PM | 2:00 PM | 2 hours |
| 3 | 2:30 PM | 4:30 PM | 2 hours |
| 4 | 5:00 PM | 7:00 PM | 2 hours |

### B. API Endpoint Reference

#### Authentication Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/merchant-login` | Merchant PIN login |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/logout` | Logout |

#### Booking Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/lark/availability` | Get trainer availability |
| POST | `/api/lark/book-training` | Book training session |
| POST | `/api/lark/cancel-training` | Cancel training |
| GET | `/api/installation/availability` | Get installer availability |
| POST | `/api/installation/book` | Book installation |

#### Salesforce Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/salesforce/merchant/[id]` | Get merchant data |
| POST | `/api/salesforce/update-training-date` | Update training date |
| POST | `/api/salesforce/update-opportunity` | Update opportunity |

#### OAuth Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/lark/auth/authorize` | Initiate OAuth |
| GET | `/api/lark/auth/callback` | OAuth callback |
| GET | `/api/trainers/authorization-status` | Check trainer OAuth |

### C. Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `JWT_SECRET` | Session signing key | Yes |
| `SALESFORCE_USERNAME` | SF user | Yes |
| `SALESFORCE_PASSWORD` | SF password | Yes |
| `SALESFORCE_SECURITY_TOKEN` | SF token | Yes |
| `LARK_APP_ID` | OAuth app ID | Yes |
| `LARK_APP_SECRET` | OAuth app secret | Yes |
| `NODE_ENV` | Environment (production/development) | Yes |

### D. Database Schema

**LarkAuthToken Table:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `userEmail` | String | User's email (unique) |
| `larkUserId` | String | Lark user ID |
| `userName` | String | User's display name |
| `userType` | String | trainer/installer/manager |
| `accessToken` | String | OAuth access token |
| `refreshToken` | String | OAuth refresh token |
| `expiresAt` | DateTime | Token expiration |
| `calendarId` | String | Resolved calendar ID |
| `createdAt` | DateTime | Record creation |
| `updatedAt` | DateTime | Last update |

---

## Summary

The Merchant Onboarding Portal is a complex system with:

✅ **Strict business rules** enforcing proper onboarding sequence
✅ **Real-time calendar integration** with automatic availability detection
✅ **Location and language-based assignment** for optimal resource allocation
✅ **Robust rescheduling** with proper event cleanup
✅ **Salesforce bi-directional sync** maintaining data consistency
✅ **Comprehensive error handling** with graceful degradation

**Key Constraints to Remember:**
- 📅 **D-2 rescheduling deadline** (must reschedule by 2 days before)
- 📅 **D+1 earliest booking** (cannot book same day)
- 📅 **D+14 latest booking** (max 14-day window)
- 🏢 **Location-based filtering** for onsite training
- 🗣️ **Language matching** for trainer assignment
- 🔄 **Stage dependencies** (Installation → Training → Go-Live)
- 📅 **Weekdays only** (Monday-Friday)

**Recent Improvements (Nov 2025):**
- ✅ Single trainer availability view
- ✅ Proper location filtering for onsite training
- ✅ Correct rescheduling with Salesforce-sourced current trainer

**For Support:**
- Development issues: Check logs and debug endpoints
- Business rule questions: Refer to this document
- User issues: See USER_MANUAL.md

---

**End of System Documentation**

*Version 1.0 | November 2025*
