# Implementation Plan: Move Trainers/Installers from JSON to Database

## Overview
Remove JSON file dependency for trainers/installers. Use database (`LarkAuthToken` table) as single source of truth.

**Status:** Not Started
**Created:** 2025-12-22

---

## Current vs Target State

| Entity | Current | Target |
|--------|---------|--------|
| Trainers | DB + JSON (redundant) | DB only |
| Installers | JSON only | DB only |
| External Vendors | JSON | Hardcoded (no change) |

---

## How It Will Work

| Action | Result |
|--------|--------|
| Admin adds trainer/installer | Written to DB → immediately queryable |
| Admin removes trainer/installer | `isActive: false` → excluded from queries |
| Admin revokes authorization | Tokens cleared → still listed, skipped if no tokens |

---

## Tasks

### Batch 1: Migration Script

#### Task 1.1: Create migration script
- **File:** `scripts/migrate-installers-to-db.ts`
- **Status:** ✅ Complete
- **Details:**
  - Read `config/installers.json`
  - For each internal installer (klangValley, penang, johorBahru):
    - Insert into `LarkAuthToken` with `userType: 'installer'`
    - Set `location` field based on region
    - Set `isActive: true`
  - Skip external vendors (Surftek)

**Test:** Run script, verify installers appear in `LarkAuthToken` table

---

### Batch 2: Config Loader Updates

#### Task 2.1: Update loadTrainersConfig()
- **File:** `lib/config-loader.ts`
- **Status:** ✅ Complete
- **Details:**
  ```typescript
  export async function loadTrainersConfig() {
    const trainers = await prisma.larkAuthToken.findMany({
      where: { userType: 'trainer', isActive: true }
    })
    return {
      trainers: trainers.map(t => ({
        name: t.userName,
        email: t.userEmail,
        calendarId: t.calendarId || 'primary',
        languages: JSON.parse(t.languages || '["English"]'),
        location: JSON.parse(t.location || '["Within Klang Valley"]'),
        larkUserId: t.larkUserId || ''
      })),
      defaultCalendarId: 'primary',
      timezone: 'Asia/Singapore'
    }
  }
  ```

**Test:** Call `/api/lark/availability` and verify trainers are returned

#### Task 2.2: Update loadInstallersConfig()
- **File:** `lib/config-loader.ts`
- **Status:** ✅ Complete
- **Details:**
  ```typescript
  export async function loadInstallersConfig() {
    const installers = await prisma.larkAuthToken.findMany({
      where: { userType: 'installer', isActive: true }
    })

    const result = {
      klangValley: { installers: [] as any[] },
      penang: { installers: [] as any[] },
      johorBahru: { installers: [] as any[] },
      external: { vendors: [{ name: 'Surftek', isActive: true }] },
      settings: { defaultTimeSlots: ['09:00-12:00', '12:00-15:00', '15:00-18:00'] }
    }

    for (const inst of installers) {
      const loc = JSON.parse(inst.location || '["Within Klang Valley"]')[0]
      const key = loc === 'Penang' ? 'penang'
                : loc === 'Johor Bahru' ? 'johorBahru'
                : 'klangValley'
      result[key].installers.push({
        name: inst.userName,
        email: inst.userEmail,
        larkCalendarId: inst.calendarId || '',
        isActive: inst.isActive
      })
    }
    return result
  }
  ```

**Test:** Call installer availability API and verify installers are returned

---

### Batch 3: Admin API Updates

#### Task 3.1: Update Add User API (trainers)
- **File:** `app/api/admin/users/add/route.ts`
- **Status:** ✅ Complete
- **Details:**
  - Remove JSON file write for trainers (lines 76-99)
  - Keep only DB write

**Test:** Add trainer via /admin, verify only DB is updated (no JSON change)

#### Task 3.2: Update Add User API (installers)
- **File:** `app/api/admin/users/add/route.ts`
- **Status:** ✅ Complete
- **Details:**
  - Change installer logic to create `LarkAuthToken` record
  - Set `userType: 'installer'`
  - Remove JSON file write

**Test:** Add installer via /admin, verify it appears in DB

#### Task 3.3: Update Get Users API
- **File:** `app/api/admin/users/route.ts`
- **Status:** ✅ Complete (no changes needed - uses config-loader)
- **Details:**
  - Fetch installers from DB instead of JSON
  - Query `LarkAuthToken` where `userType: 'installer'`

**Test:** Open /admin, verify installers list loads from DB

#### Task 3.4: Update Remove Users API
- **File:** `app/api/admin/users/remove/route.ts`
- **Status:** ✅ Complete
- **Details:**
  - For installers: Set `isActive: false` in DB (soft delete)
  - Remove JSON file update logic

**Test:** Remove installer via /admin, verify `isActive: false` in DB

---

### Batch 4: Installer List API

#### Task 4.1: Update Installer List API
- **File:** `app/api/installers/list/route.ts`
- **Status:** ✅ Complete

#### Task 4.2: Update Trainer List API
- **File:** `app/api/trainers/list/route.ts`
- **Status:** ✅ Complete

#### Task 4.3: Update Book Training API
- **File:** `app/api/lark/book-training/route.ts`
- **Status:** ✅ Complete
- **Details:**
  - Remove static JSON import
  - Use `loadInstallersConfig()` from config-loader

**Test:** Call `/api/installers/list`, verify response matches DB data

---

### Batch 5: Testing & Cleanup

#### Task 5.1: End-to-end testing
- **Status:** ⬜ Not Started
- **Checklist:**
  - [ ] Migration script runs without errors
  - [ ] Admin can add new trainer → appears in DB
  - [ ] Admin can add new installer → appears in DB
  - [ ] Trainer availability check works
  - [ ] Installer availability check works
  - [ ] External vendor (Surftek) booking still works
  - [ ] Removing trainer/installer sets `isActive: false`
  - [ ] Revoking authorization clears tokens but keeps record

#### Task 5.2: Cleanup (optional)
- **Status:** ⬜ Not Started
- **Details:**
  - Remove unused JSON imports
  - Keep JSON files as backup (do not delete)

---

## Files Summary

| File | Action |
|------|--------|
| `scripts/migrate-installers-to-db.ts` | CREATE |
| `lib/config-loader.ts` | MODIFY |
| `app/api/admin/users/add/route.ts` | MODIFY |
| `app/api/admin/users/route.ts` | MODIFY |
| `app/api/admin/users/remove/route.ts` | MODIFY |
| `app/api/installers/list/route.ts` | MODIFY |

---

## Risk Mitigation

- Keep JSON files as backup (don't delete)
- Run migration script locally first
- Test availability endpoints immediately after each change
- Can rollback by reverting config-loader to read JSON

---

## Deployment Steps

1. Run migration script locally against production DB
2. Verify data in DB (check installer count matches JSON)
3. Deploy code changes
4. Test all availability endpoints
5. Monitor for errors