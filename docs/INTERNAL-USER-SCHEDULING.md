# Internal User Scheduling System

This document explains how the internal user scheduling system works for the Onboarding Portal. Internal team members have relaxed scheduling rules and additional features compared to regular merchants.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Relaxed Scheduling Rules](#relaxed-scheduling-rules)
4. [Trainer/Installer Selection](#trainerinstaller-selection)
5. [All Trainers Feature](#all-trainers-feature)
6. [Technical Implementation](#technical-implementation)
7. [API Endpoints](#api-endpoints)
8. [Files Modified](#files-modified)

---

## Overview

Internal team members (StoreHub staff) have special privileges when scheduling training and installation appointments:

| Feature | Regular Users | Internal Users |
|---------|--------------|----------------|
| Weekend scheduling | Blocked | Allowed (Sat/Sun) |
| Rescheduling buffer | 1 business day minimum | Can reschedule to tomorrow |
| Trainer selection | Auto-assigned | Can manually choose |
| Installer selection | Auto-assigned | Can manually choose |
| View all trainers | No | Yes (with "All Trainers" option) |

---

## Authentication

### How Internal Users Are Identified

Internal users authenticate using a universal **Internal Team PIN** configured in the environment:

```env
# .env.local
INTERNAL_TEAM_PIN=0000  # Default value
```

### Authentication Flow

```
User enters PIN
       │
       ▼
┌─────────────────────────────────────┐
│  Is PIN === INTERNAL_TEAM_PIN?      │
└─────────────────────────────────────┘
       │
       ├── YES → isInternalUser: true
       │         userName: "StoreHub Team"
       │
       └── NO  → Check against merchant's phone number
                 isInternalUser: false
```

### Code Location

**File:** `lib/auth-utils.ts` (lines 42-74)

```typescript
export function isInternalTeamPIN(pin: string): boolean {
  const internalPIN = process.env.INTERNAL_TEAM_PIN || '0000'
  return pin === internalPIN
}
```

The `isInternalUser` flag is stored in the JWT token and passed to components.

---

## Relaxed Scheduling Rules

### 1. Weekend Scheduling

**Regular users:** Cannot select Saturday or Sunday
**Internal users:** Can select any day including weekends

**Code Location:** `components/DatePickerModal.tsx` (lines 649-656)

```typescript
// Only block Saturday (6) and Sunday (0) for non-internal users
if (!isInternalUser && (singaporeDay === 0 || singaporeDay === 6)) {
  return false // Block weekend
}
```

### 2. Rescheduling Buffer

**Regular users:** Must have at least 1 business day buffer when rescheduling
**Internal users:** Can reschedule to as early as tomorrow

**Code Location:** `components/DatePickerModal.tsx` (lines 675-700)

```typescript
if (currentBooking?.eventId) {
  if (isInternalUser) {
    // Internal users have no minimum rescheduling buffer
    const tomorrow = new Date(minDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    minDate = tomorrow
  } else {
    // Regular users require 1 business day buffer
    // ... buffer calculation logic
  }
}
```

---

## Trainer/Installer Selection

### Dropdown UI

When an internal user opens the scheduling modal, they see a dropdown to select a specific trainer or installer:

**For Training:**
```
┌─────────────────────────────────────────┐
│ Select Trainer (Internal Only)          │
├─────────────────────────────────────────┤
│ -- Select a trainer --                  │
│ All Trainers                            │
│ John Lai (English)                      │
│ Vwie Gan (English, Bahasa Malaysia, Chinese) │
│ Evelyn Cham (English, Bahasa Malaysia)  │
└─────────────────────────────────────────┘
```

**For Installation:**
```
┌─────────────────────────────────────────┐
│ Select Installer (Internal Only)        │
├─────────────────────────────────────────┤
│ -- Select an installer --               │
│ Fairul (Klang Valley)                   │
│ Ahmad (Penang)                          │
└─────────────────────────────────────────┘
```

### How Selection Works

1. Internal user selects a trainer/installer from dropdown
2. System fetches that specific person's calendar availability
3. Calendar updates to show only their available dates/times
4. When booking is confirmed, that specific person is assigned (no auto-assignment)

---

## All Trainers Feature

### Overview

When internal user selects **"All Trainers"**, the system shows expanded time slots with individual trainer names, allowing them to see everyone's availability at once.

### User Flow

```
1. Select "All Trainers" from dropdown
       │
       ▼
2. Select a language (e.g., "English")
       │
       ▼
3. Select a date from calendar
       │
       ▼
4. View expanded slots:
   ┌─────────────────────────────────────┐
   │ 10:00 AM - 11:30 AM (John Lai)      │
   │ 10:00 AM - 11:30 AM (Vwie Gan)      │
   │ 2:00 PM - 3:30 PM (John Lai)        │
   │ 2:00 PM - 3:30 PM (Evelyn Cham)     │
   │ 4:00 PM - 5:30 PM (Vwie Gan)        │
   └─────────────────────────────────────┘
       │
       ▼
5. Select a specific slot (includes trainer)
       │
       ▼
6. Booking is created for that trainer
```

### How It Works Technically

1. **Fetch Combined Availability**
   - When "All Trainers" selected, system fetches combined availability from all trainers
   - API: `/api/lark/availability?includeWeekends=true`

2. **Expand Slots**
   - Each time slot is expanded into multiple slots (one per available trainer)
   - Trainers are filtered by selected language
   - Slots are sorted by time, then by trainer name

3. **Booking**
   - When user selects a slot, the `trainerEmail` from that slot is used
   - Booking API receives the specific trainer to assign

### Code Location

**Slot Expansion Logic:** `components/DatePickerModal.tsx` (lines 1030-1067)

```typescript
if (isInternalUser && selectedTrainerEmail === 'all' && selectedLanguages.length > 0) {
  const expandedSlots = []

  filtered.forEach(slot => {
    const trainersForSlot = slot.availableTrainers || []

    // Filter trainers by selected language
    const trainersWithLanguage = trainersForSlot.filter(trainerName => {
      const trainerInfo = availableTrainersList.find(t => t.name === trainerName)
      return selectedLanguages.some(lang => trainerInfo.languages?.includes(lang))
    })

    // Create individual slot for each trainer
    trainersWithLanguage.forEach(trainerName => {
      expandedSlots.push({
        ...slot,
        trainerName: trainerName,
        trainerEmail: trainerInfo?.email,
        displayLabel: `${slot.start} - ${trainerName}`
      })
    })
  })

  return expandedSlots
}
```

---

## Technical Implementation

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Modal Opens                                   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Check: Is internal user?                                            │
└─────────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
┌─────────────────────────┐         ┌─────────────────────────────────┐
│  Regular User           │         │  Internal User                   │
│  - Fetch combined       │         │  - Fetch trainer/installer list  │
│    availability         │         │  - Wait for selection            │
│  - Show calendar        │         │  - Show dropdown                 │
└─────────────────────────┘         └─────────────────────────────────┘
                                                  │
                                                  ▼
                                    ┌─────────────────────────────────┐
                                    │  User selects trainer           │
                                    └─────────────────────────────────┘
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          │                       │                       │
                          ▼                       ▼                       ▼
              ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
              │ Specific Trainer  │   │ "All Trainers"    │   │ Specific Installer│
              │ Fetch individual  │   │ Fetch combined    │   │ Fetch individual  │
              │ availability      │   │ availability      │   │ availability      │
              └───────────────────┘   └───────────────────┘   └───────────────────┘
                          │                       │                       │
                          ▼                       ▼                       ▼
              ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
              │ Show trainer's    │   │ Expand slots to   │   │ Show installer's  │
              │ available slots   │   │ show per-trainer  │   │ available slots   │
              └───────────────────┘   └───────────────────┘   └───────────────────┘
                          │                       │                       │
                          └───────────────────────┼───────────────────────┘
                                                  │
                                                  ▼
                                    ┌─────────────────────────────────┐
                                    │  User selects slot & confirms   │
                                    └─────────────────────────────────┘
                                                  │
                                                  ▼
                                    ┌─────────────────────────────────┐
                                    │  Booking API called with        │
                                    │  selectedTrainerEmail or        │
                                    │  selectedInstallerEmail         │
                                    └─────────────────────────────────┘
```

### Props Added to DatePickerModal

```typescript
interface DatePickerModalProps {
  // ... existing props
  isInternalUser?: boolean  // NEW: Identifies internal team members
}
```

### State Variables Added

```typescript
// Internal user manual selection states
const [availableTrainersList, setAvailableTrainersList] = useState([])
const [availableInstallersList, setAvailableInstallersList] = useState([])
const [selectedTrainerEmail, setSelectedTrainerEmail] = useState('')
const [selectedInstallerEmail, setSelectedInstallerEmail] = useState('')
```

### TimeSlot Interface Extended

```typescript
interface TimeSlot {
  start: string
  end: string
  available: boolean
  availableTrainers?: string[]
  availableLanguages?: string[]
  // Added for "All Trainers" expanded slots
  trainerName?: string
  trainerEmail?: string
  displayLabel?: string
}
```

---

## API Endpoints

### GET /api/trainers/list

Returns list of all trainers for internal user dropdown.

**Response:**
```json
{
  "success": true,
  "trainers": [
    {
      "name": "John Lai",
      "email": "john.lai@storehub.com",
      "languages": ["English"],
      "location": ["Klang Valley"]
    },
    {
      "name": "Vwie Gan",
      "email": "vwie.gan@storehub.com",
      "languages": ["English", "Bahasa Malaysia", "Chinese"],
      "location": ["Klang Valley", "Penang"]
    }
  ]
}
```

### GET /api/installers/list

Returns list of all internal installers for dropdown.

**Response:**
```json
{
  "success": true,
  "installers": [
    {
      "name": "Fairul",
      "email": "fairul@storehub.com",
      "region": "Klang Valley"
    },
    {
      "name": "Ahmad",
      "email": "ahmad@storehub.com",
      "region": "Penang"
    }
  ]
}
```

### GET /api/lark/availability

Extended with new parameters for internal users.

**New Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `includeWeekends` | boolean | Include Saturday/Sunday in results |
| `startDate` | string | Custom start date (YYYY-MM-DD) |
| `endDate` | string | Custom end date (YYYY-MM-DD) |

**Example:**
```
/api/lark/availability?includeWeekends=true&startDate=2025-12-13&endDate=2025-12-31
```

### GET /api/installation/availability

Extended with `includeWeekends` parameter.

**Example:**
```
/api/installation/availability?merchantId=xxx&startDate=2025-12-01&endDate=2025-12-15&includeWeekends=true
```

---

## Files Modified

### Core Files

| File | Changes |
|------|---------|
| `components/DatePickerModal.tsx` | Added internal user logic, trainer dropdown, slot expansion |
| `app/merchant/[merchantId]/page.tsx` | Pass `isInternalUser` prop to DatePickerModal |
| `lib/trainer-availability.ts` | Added `includeWeekends` parameter |
| `lib/installer-availability.ts` | Added `includeWeekends` parameter, manual installer selection |

### API Routes

| File | Changes |
|------|---------|
| `app/api/trainers/list/route.ts` | NEW: Returns trainer list |
| `app/api/installers/list/route.ts` | NEW: Returns installer list |
| `app/api/lark/availability/route.ts` | Added `includeWeekends`, `startDate`, `endDate` params |
| `app/api/installation/availability/route.ts` | Added `includeWeekends` param |
| `app/api/lark/book-training/route.ts` | Accept `selectedTrainerEmail` for manual assignment |
| `app/api/installation/book/route.ts` | Accept `selectedInstallerEmail` for manual assignment |

---

## Branch Information

These changes are stored in the branch:

```
feature/internal-user-scheduling
```

To apply these changes:

```bash
git checkout feature/internal-user-scheduling
# or
git merge feature/internal-user-scheduling
```
