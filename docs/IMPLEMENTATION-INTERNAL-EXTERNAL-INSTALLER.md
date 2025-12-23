# Implementation Plan: Internal User External Installer Selection

## Overview

Allow internal users to choose between internal and external (Surftek) installers regardless of merchant location.

**Current Behavior:**
- Location determines installer type (Klang Valley/Penang/Johor → Internal, elsewhere → External)
- Internal users see installer dropdown but only internal installers
- Location validation applies to all users

**New Behavior:**
- Internal users can choose ANY installer type (internal or external)
- Dropdown shows both internal installers AND external option with visual separation
- **No location validation for internal users** - their selection is used directly
- Regular merchants still get automatic location-based routing (unchanged)

**Decision Flow:**
```
Internal user makes a selection?
├── YES → Use their selection directly (NO location check)
│   ├── "External" selected → Surftek flow
│   └── Internal installer selected → Internal flow
│
└── NO (regular merchant) → Run getInstallerType() for auto-routing
    ├── KV/Penang/Johor → Internal flow
    └── Other locations → Surftek flow
```

---

## Task Breakdown

### Task 1: Add Translation Keys
**Files:** `messages/en.json`, `messages/ms.json`, `messages/zh.json`

**Add these keys:**
```json
{
  "allInternalInstallers": "All Internal Installers",
  "externalInstaller": "External Installer (Surftek)",
  "internalInstallers": "Internal Installers",
  "external": "External"
}
```

**Malay translations:**
```json
{
  "allInternalInstallers": "Semua Pemasang Dalaman",
  "externalInstaller": "Pemasang Luar (Surftek)",
  "internalInstallers": "Pemasang Dalaman",
  "external": "Luar"
}
```

**Chinese translations:**
```json
{
  "allInternalInstallers": "所有内部安装人员",
  "externalInstaller": "外部安装人员 (Surftek)",
  "internalInstallers": "内部安装人员",
  "external": "外部"
}
```

**Test:** Verify translations load correctly in all 3 languages.

---

### Task 2: Update Installer Dropdown UI
**File:** `components/DatePickerModal.tsx`
**Location:** Lines ~1870-1889

**Current code:**
```tsx
<select value={selectedInstallerEmail} onChange={...}>
  <option value="">{t('selectInstaller')}</option>
  <option value="all">{t('allInstallers')}</option>
  {availableInstallersList.map(installer => (
    <option key={installer.email} value={installer.email}>
      {installer.name} ({installer.region})
    </option>
  ))}
</select>
```

**New code:**
```tsx
<select value={selectedInstallerEmail} onChange={...}>
  <option value="">{t('selectInstaller')}</option>
  <optgroup label={t('internalInstallers')}>
    <option value="all">{t('allInternalInstallers')}</option>
    {availableInstallersList.map(installer => (
      <option key={installer.email} value={installer.email}>
        {installer.name} ({installer.region})
      </option>
    ))}
  </optgroup>
  <optgroup label={t('external')}>
    <option value="external">{t('externalInstaller')}</option>
  </optgroup>
</select>
```

**Test:**
1. Login as internal user
2. Open installation booking modal
3. Verify dropdown shows optgroups with separator
4. Verify "All Internal Installers" text (not "All Installers")
5. Verify "External Installer (Surftek)" option appears

---

### Task 3: Update Availability Logic for External Selection
**File:** `components/DatePickerModal.tsx`
**Location:** Lines ~670-751 (fetchAvailability function)

**Changes:**
When `selectedInstallerEmail === 'external'`:
1. Skip the API call to `/api/installation/availability`
2. Generate hardcoded external vendor slots
3. Set `isExternalVendor = true`

**Add this logic in fetchAvailability (around line 670):**
```tsx
// Handle external installer selection for internal users
if (bookingType === 'installation' && selectedInstallerEmail === 'external') {
  console.log('🔧 Internal user selected external installer - generating external slots')

  // Generate external vendor availability (same as current external flow)
  const externalAvailability = []
  const startDate = new Date()
  startDate.setDate(startDate.getDate() + 2) // 2-day advance booking

  for (let i = 0; i < 14; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + i)

    // Skip weekends
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      continue
    }

    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`

    externalAvailability.push({
      date: dateStr,
      slots: [
        { start: '09:00', end: '11:00', available: true, availableTrainers: ['External Vendor'] },
        { start: '11:00', end: '13:00', available: true, availableTrainers: ['External Vendor'] },
        { start: '14:00', end: '16:00', available: true, availableTrainers: ['External Vendor'] },
        { start: '16:00', end: '18:00', available: true, availableTrainers: ['External Vendor'] }
      ]
    })
  }

  setAvailability(externalAvailability)
  setIsExternalVendor(true)
  setLoading(false)
  return
}
```

**Test:**
1. Login as internal user
2. Select "External Installer (Surftek)" from dropdown
3. Verify calendar shows dates starting from day after tomorrow
4. Verify weekends are skipped
5. Verify time slots show: 9-11AM, 11AM-1PM, 2-4PM, 4-6PM
6. Verify external vendor notice message appears

---

### Task 4: Update Booking Submission
**File:** `components/DatePickerModal.tsx`
**Location:** Lines ~885-896 (handleConfirmBooking function)

**Changes:**
When submitting installation booking with `selectedInstallerEmail === 'external'`:
- Add `useExternalVendor: true` to request body

**Find the installation booking request body and add:**
```tsx
if (bookingType === 'installation') {
  const installationRequestBody = {
    merchantId,
    date: selectedDate,
    timeSlot: selectedSlot,
    // ... existing fields
  }

  // NEW: Handle external installer selection for internal users
  if (isInternalUser && selectedInstallerEmail === 'external') {
    installationRequestBody.useExternalVendor = true
  } else if (isInternalUser && selectedInstallerEmail) {
    // Existing logic for internal installer selection
    if (selectedInstallerEmail === 'all' && selectedSlot?.installerEmail) {
      installationRequestBody.selectedInstallerEmail = selectedSlot.installerEmail
    } else if (selectedInstallerEmail !== 'all') {
      installationRequestBody.selectedInstallerEmail = selectedInstallerEmail
    }
  }

  // ... rest of submission
}
```

**Test:**
1. Select "External Installer (Surftek)"
2. Pick date and time slot
3. Confirm booking
4. Check network request includes `useExternalVendor: true`

---

### Task 5: Remove Location Validation for Internal Users
**File:** `app/api/installation/book/route.ts`
**Location:** Lines ~58-60

**Key Change:** No `getInstallerType()` call when internal user makes ANY selection.

**Current logic:**
```tsx
const installerType = await getInstallerType(merchantId)

if (installerType === 'internal') {
  // Internal path
} else {
  // External path
}
```

**New logic (simplified - no location check for internal users):**
```tsx
const { useExternalVendor, selectedInstallerEmail } = body

// Internal user explicitly chose external vendor - go directly to Surftek
if (useExternalVendor) {
  console.log('🔧 Internal user selected external vendor - skipping location validation')
  return await submitExternalInstallationRequest(
    merchantId,
    onboardingTrainerName || merchantName,
    date,
    timeSlot,
    undefined, // existingEventId
    intercomTicketUrl
  )
}

// Internal user explicitly chose internal installer - go directly to internal flow
if (selectedInstallerEmail) {
  console.log('🔧 Internal user selected internal installer - skipping location validation')
  return await bookInternalInstallation(
    merchantId,
    onboardingTrainerName || merchantName,
    date,
    timeSlot,
    [], // availableInstallers - will be resolved inside using selectedInstallerEmail
    existingEventId,
    selectedInstallerEmail
  )
}

// Regular merchant flow only - use location-based routing
const installerType = await getInstallerType(merchantId)
if (installerType === 'internal') {
  return await bookInternalInstallation(...)
} else {
  return await submitExternalInstallationRequest(...)
}
```

**Why this is simpler:**
- Internal users bypass `getInstallerType()` entirely
- Their selection is trusted and used directly
- Location validation only runs for regular merchants

**Test:**
1. **Test A - External for KL merchant:**
   - Find a merchant in Klang Valley (normally would get internal installer)
   - Login as internal user
   - Select "External Installer (Surftek)"
   - Complete booking
   - Verify Surftek ticket is created
   - Verify Salesforce shows "External Vendor" as installer

2. **Test B - Internal for Sabah merchant:**
   - Find a merchant in Sabah (normally would get external)
   - Login as internal user
   - Select an internal installer (e.g., "Fairul")
   - Complete booking
   - Verify internal installer is assigned
   - Verify Lark calendar event created

---

## Testing Checklist

### Dropdown UI
- [ ] Optgroups display correctly with labels
- [ ] "All Internal Installers" text shows (not "All Installers")
- [ ] External option appears in separate section
- [ ] Works in all 3 languages

### External Selection Flow
- [ ] Selecting external generates hardcoded slots (no API call)
- [ ] Slots show 9-11, 11-1, 2-4, 4-6
- [ ] Weekends skipped
- [ ] 2-day advance booking enforced
- [ ] External vendor notice appears

### Booking Flow (No Location Validation for Internal Users)
- [ ] Internal user + External selection → Surftek flow (regardless of merchant location)
- [ ] Internal user + Internal selection → Internal flow (regardless of merchant location)
- [ ] Regular user → Location-based routing (unchanged)

### Cross-Location Tests (New)
- [ ] Internal user assigns internal installer to Sabah merchant → Works
- [ ] Internal user assigns external to KL merchant → Works
- [ ] Internal user assigns Penang installer to KL merchant → Works

### Edge Cases
- [ ] Switching between external and internal in dropdown reloads availability
- [ ] Canceling and reopening modal resets selection
- [ ] Works for merchants in covered areas (KV, Penang, Johor)
- [ ] Works for merchants in external areas (Sabah, Sarawak, etc.)

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `components/DatePickerModal.tsx` | Dropdown with optgroups, external availability generation, booking flag |
| `app/api/installation/book/route.ts` | `useExternalVendor` check to bypass location routing |
| `messages/en.json` | 4 new translation keys |
| `messages/ms.json` | 4 new translation keys |
| `messages/zh.json` | 4 new translation keys |

---

## Rollback Plan

If issues occur:
1. Revert all 5 files to previous commit
2. Translation keys can remain (unused keys don't break anything)
3. No database changes required

---

## Key Simplification

**Before:** Location validation ran for ALL users, internal users could only "override" in limited cases.

**After:**
- Internal users: NO location validation - selection is used directly
- Regular merchants: Location validation still applies (auto-routing)

This means internal users have **full flexibility** to:
- Assign any internal installer to any merchant (even outside their normal region)
- Assign external vendor (Surftek) to any merchant (even in covered areas like KL)
