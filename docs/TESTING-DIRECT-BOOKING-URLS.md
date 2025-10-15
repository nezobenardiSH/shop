# Testing Direct Booking URLs - Manual Testing Guide

## Overview

The Direct Booking URLs feature has been implemented successfully. This document provides manual testing instructions since automated Playwright tests require authentication setup.

## Implementation Summary

### What Was Implemented

1. ✅ **URL Parameter Support** - Added `useSearchParams` hook with Suspense wrapper
2. ✅ **Auto-Open Modal Logic** - Modal automatically opens when `?booking=` parameter is detected
3. ✅ **Three Booking Types:**
   - `?booking=pos-training`
   - `?booking=backoffice-training`
   - `?booking=installation`
4. ✅ **URL Cleanup** - Parameter is removed after modal opens using `router.replace()`
5. ✅ **Language Opt-In** - No languages pre-selected (changed from all selected)
6. ✅ **Prevent Multiple Triggers** - Added `hasProcessedUrlParam` state flag

### Files Modified

1. **`app/merchant/[merchantId]/page.tsx`**
   - Added `Suspense` import
   - Added `useSearchParams` hook
   - Created `TrainerPortalContent` component
   - Added `TrainerPortal` wrapper with Suspense
   - Added `hasProcessedUrlParam` state
   - Added useEffect to handle URL parameters
   - Uses `router.replace()` to clean URL

2. **`components/DatePickerModal.tsx`**
   - Changed default `selectedLanguages` from `['Chinese', 'Bahasa Malaysia', 'English']` to `[]`

3. **`testing/playwright.config.ts`**
   - Changed `testDir` from `'./tests'` to `'./e2e'`

### Files Created

1. **`testing/e2e/direct-booking-urls.spec.ts`** - Playwright test suite (8 test cases)
2. **`testing/test-direct-booking-urls.sh`** - Shell script to run tests
3. **`testing/README-DIRECT-BOOKING-URLS.md`** - Testing documentation
4. **`docs/direct-booking-urls.md`** - Feature documentation

## Manual Testing Instructions

### Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Ensure you're logged in** to the merchant portal

3. **Have a valid merchant ID** (e.g., from your Salesforce data)

### Test Cases

#### Test 1: POS Training URL

**URL:**
```
http://localhost:3010/merchant/[YOUR-MERCHANT-ID]?booking=pos-training
```

**Expected Behavior:**
1. Page loads
2. Booking modal opens automatically
3. Modal title shows "Schedule POS Training" or similar
4. Language checkboxes are visible
5. **NO languages are pre-selected** ✅
6. URL changes to: `http://localhost:3010/merchant/[YOUR-MERCHANT-ID]` (parameter removed)
7. Modal stays open

**How to Verify:**
- [ ] Modal opens automatically
- [ ] English checkbox is NOT checked
- [ ] Bahasa Malaysia checkbox is NOT checked
- [ ] Chinese checkbox is NOT checked
- [ ] URL parameter is removed from browser address bar
- [ ] Modal remains open after URL cleanup

---

#### Test 2: BackOffice Training URL

**URL:**
```
http://localhost:3010/merchant/[YOUR-MERCHANT-ID]?booking=backoffice-training
```

**Expected Behavior:**
1. Page loads
2. Booking modal opens automatically
3. Modal title shows "Schedule BackOffice Training" or similar
4. Language checkboxes are visible
5. **NO languages are pre-selected** ✅
6. URL parameter is removed
7. Modal stays open

**How to Verify:**
- [ ] Modal opens automatically
- [ ] No languages pre-selected
- [ ] URL parameter removed
- [ ] Modal remains open

---

#### Test 3: Installation URL

**URL:**
```
http://localhost:3010/merchant/[YOUR-MERCHANT-ID]?booking=installation
```

**Expected Behavior:**
1. Page loads
2. Booking modal opens automatically
3. Modal title shows "Schedule Installation" or similar
4. **NO language selection** (installation doesn't need language)
5. URL parameter is removed
6. Modal stays open

**How to Verify:**
- [ ] Modal opens automatically
- [ ] No language selection shown (or if shown, not required)
- [ ] URL parameter removed
- [ ] Modal remains open

---

#### Test 4: Invalid Booking Parameter

**URL:**
```
http://localhost:3010/merchant/[YOUR-MERCHANT-ID]?booking=invalid-type
```

**Expected Behavior:**
1. Page loads normally
2. **Modal does NOT open**
3. URL parameter may or may not be removed (doesn't matter)
4. Page shows normal merchant portal view

**How to Verify:**
- [ ] Modal does NOT open
- [ ] Page loads normally

---

#### Test 5: No Booking Parameter

**URL:**
```
http://localhost:3010/merchant/[YOUR-MERCHANT-ID]
```

**Expected Behavior:**
1. Page loads normally
2. **Modal does NOT open**
3. Page shows normal merchant portal view

**How to Verify:**
- [ ] Modal does NOT open
- [ ] Page loads normally

---

#### Test 6: Language Selection and Slot Filtering

**URL:**
```
http://localhost:3010/merchant/[YOUR-MERCHANT-ID]?booking=pos-training
```

**Steps:**
1. Wait for modal to open
2. Select "English" language checkbox
3. Observe available time slots

**Expected Behavior:**
1. Modal opens with no languages selected
2. After selecting English, available slots appear
3. Slots are filtered to show only trainers who speak English

**How to Verify:**
- [ ] Can select language(s)
- [ ] Slots appear after language selection
- [ ] Calendar/date picker is visible

---

#### Test 7: Modal Close and URL Persistence

**URL:**
```
http://localhost:3010/merchant/[YOUR-MERCHANT-ID]?booking=pos-training
```

**Steps:**
1. Wait for modal to open
2. Wait for URL to be cleaned (parameter removed)
3. Close the modal (click Cancel or X button)
4. Check the URL

**Expected Behavior:**
1. Modal opens
2. URL parameter is removed
3. Modal closes when Cancel/X is clicked
4. URL remains clean (no parameter)

**How to Verify:**
- [ ] URL parameter removed after modal opens
- [ ] Modal can be closed
- [ ] URL stays clean after closing modal

---

#### Test 8: Multiple Booking Types in Sequence

**Steps:**
1. Visit: `http://localhost:3010/merchant/[YOUR-MERCHANT-ID]?booking=pos-training`
2. Close modal
3. Visit: `http://localhost:3010/merchant/[YOUR-MERCHANT-ID]?booking=backoffice-training`
4. Close modal
5. Visit: `http://localhost:3010/merchant/[YOUR-MERCHANT-ID]?booking=installation`

**Expected Behavior:**
1. Each URL opens the correct modal
2. Each modal can be closed
3. URLs are cleaned each time
4. No errors or unexpected behavior

**How to Verify:**
- [ ] POS Training modal opens correctly
- [ ] BackOffice Training modal opens correctly
- [ ] Installation modal opens correctly
- [ ] All URLs are cleaned properly

---

## Browser Testing

Test in multiple browsers:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## Mobile Testing

Test on mobile devices:
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Responsive view in desktop browser

## Common Issues and Debugging

### Issue: Modal doesn't open

**Possible Causes:**
1. Not logged in (page redirects to login)
2. Invalid merchant ID
3. Salesforce data not loading
4. JavaScript error in console

**Debug Steps:**
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Look for console.log: "Auto-opening booking modal from URL parameter: [type]"

### Issue: URL parameter not removed

**Possible Causes:**
1. Router.replace() not working
2. React state not updating
3. Suspense boundary issue

**Debug Steps:**
1. Check browser console for errors
2. Check if `hasProcessedUrlParam` state is being set
3. Verify `router.replace()` is being called

### Issue: Languages are pre-selected

**Possible Causes:**
1. Wrong modal component being used
2. State not initialized correctly

**Debug Steps:**
1. Check which modal component is rendering (DatePickerModal vs BookingModal)
2. Verify `selectedLanguages` initial state is `[]`

### Issue: Modal opens multiple times

**Possible Causes:**
1. `hasProcessedUrlParam` flag not working
2. useEffect dependencies causing re-runs

**Debug Steps:**
1. Check console for multiple "Auto-opening" messages
2. Verify `hasProcessedUrlParam` is being set to `true`

## Testing Checklist

Use this checklist to verify all functionality:

### Core Functionality
- [ ] POS Training URL opens correct modal
- [ ] BackOffice Training URL opens correct modal
- [ ] Installation URL opens correct modal
- [ ] Invalid parameter does NOT open modal
- [ ] No parameter does NOT open modal

### Language Selection
- [ ] No languages pre-selected (opt-in)
- [ ] Can select English
- [ ] Can select Bahasa Malaysia
- [ ] Can select Chinese
- [ ] Can select multiple languages
- [ ] Slots filter based on selected languages

### URL Behavior
- [ ] URL parameter is removed after modal opens
- [ ] URL stays clean after closing modal
- [ ] URL cleanup doesn't cause page reload
- [ ] Browser back button works correctly

### User Experience
- [ ] Modal opens smoothly
- [ ] No flash of content
- [ ] No multiple modal instances
- [ ] Can close modal with Cancel button
- [ ] Can close modal with X button
- [ ] Can complete booking flow

### Edge Cases
- [ ] Refresh page with parameter (should open modal again)
- [ ] Multiple tabs with different parameters
- [ ] Slow network connection
- [ ] Mobile devices
- [ ] Different browsers

## Automated Testing (Future)

To enable automated Playwright tests:

1. **Set up authentication** in Playwright tests
2. **Use test merchant data** that doesn't require real Salesforce
3. **Mock Lark Calendar API** for consistent test data
4. **Run tests:**
   ```bash
   ./testing/test-direct-booking-urls.sh
   ```

Current test status: ❌ Requires authentication setup

## Success Criteria

The feature is working correctly if:

✅ All 8 manual test cases pass  
✅ No console errors  
✅ URL parameters work in all browsers  
✅ Language opt-in behavior works  
✅ URL cleanup works smoothly  
✅ Modal opens/closes correctly  
✅ No performance issues  

---

*Last Updated: October 2025*
*Status: Implementation Complete - Manual Testing Required*

