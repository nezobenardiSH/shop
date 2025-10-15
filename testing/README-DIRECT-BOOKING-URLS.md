# Direct Booking URLs - Testing Guide

## Overview

This directory contains Playwright end-to-end tests for the Direct Booking URLs feature.

## Test File

**Location:** `testing/e2e/direct-booking-urls.spec.ts`

## What's Being Tested

### 1. **POS Training URL** (`?booking=pos-training`)
- ✅ Modal opens automatically
- ✅ Language selection is visible
- ✅ No languages are pre-selected (opt-in)
- ✅ URL parameter is removed after modal opens

### 2. **BackOffice Training URL** (`?booking=backoffice-training`)
- ✅ Modal opens automatically
- ✅ Language selection is visible
- ✅ No languages are pre-selected (opt-in)
- ✅ URL parameter is removed after modal opens

### 3. **Installation URL** (`?booking=installation`)
- ✅ Modal opens automatically
- ✅ No language selection (not needed for installation)
- ✅ URL parameter is removed after modal opens

### 4. **Edge Cases**
- ✅ Invalid booking parameter does NOT open modal
- ✅ No parameter does NOT open modal
- ✅ Modal can be closed and URL stays clean
- ✅ Multiple booking types work in sequence

### 5. **User Interactions**
- ✅ User can select language(s)
- ✅ Slots are filtered based on selected language
- ✅ Calendar/date picker is visible

## Running the Tests

### Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   Server should be running on `http://localhost:3010`

2. **Ensure Playwright is installed:**
   ```bash
   npm install
   ```

### Run All Direct Booking URL Tests

**Option 1: Using the shell script (recommended)**
```bash
./testing/test-direct-booking-urls.sh
```

**Option 2: Using Playwright directly**
```bash
cd testing
npx playwright test e2e/direct-booking-urls.spec.ts
```

**Option 3: Run with UI mode (interactive)**
```bash
cd testing
npx playwright test e2e/direct-booking-urls.spec.ts --ui
```

**Option 4: Run specific test**
```bash
cd testing
npx playwright test e2e/direct-booking-urls.spec.ts -g "POS Training"
```

### Run with Different Browsers

```bash
# Chrome only
npx playwright test e2e/direct-booking-urls.spec.ts --project=chromium

# Firefox only
npx playwright test e2e/direct-booking-urls.spec.ts --project=firefox

# Safari only
npx playwright test e2e/direct-booking-urls.spec.ts --project=webkit

# All browsers
npx playwright test e2e/direct-booking-urls.spec.ts
```

## Test Configuration

### Environment Variables

Set these in your `.env.local` or pass them when running tests:

```bash
BASE_URL=http://localhost:3010  # Default
TEST_MERCHANT=Nasi-Lemak         # Default test merchant
```

### Custom Test Merchant

To test with a different merchant:

```bash
# Edit the test file
# Change: const TEST_MERCHANT = 'Nasi-Lemak'
# To:     const TEST_MERCHANT = 'Your-Merchant-Name'
```

## Test Output

### Successful Run
```
🧪 Testing Direct Booking URLs Feature
========================================

📡 Checking if development server is running...
✅ Server is running on http://localhost:3010

🎭 Running Playwright tests...

Running 8 tests using 1 worker

  ✓ should auto-open POS Training modal from URL parameter (5s)
  ✓ should auto-open BackOffice Training modal from URL parameter (4s)
  ✓ should auto-open Installation modal from URL parameter (4s)
  ✓ should NOT open modal for invalid booking parameter (3s)
  ✓ should NOT open modal without booking parameter (3s)
  ✓ should allow user to select language and see filtered slots (4s)
  ✓ should close modal and keep URL clean (4s)
  ✓ should handle multiple booking types in sequence (8s)

  8 passed (35s)

✅ All tests passed!
```

### Failed Run
```
❌ Some tests failed!

  1) should auto-open POS Training modal from URL parameter
     Error: Timeout 10000ms exceeded waiting for modal to be visible
```

## Debugging Failed Tests

### 1. Run in Debug Mode
```bash
cd testing
npx playwright test e2e/direct-booking-urls.spec.ts --debug
```

### 2. Run in Headed Mode (see browser)
```bash
cd testing
npx playwright test e2e/direct-booking-urls.spec.ts --headed
```

### 3. Generate Trace
```bash
cd testing
npx playwright test e2e/direct-booking-urls.spec.ts --trace on
```

Then view the trace:
```bash
npx playwright show-trace trace.zip
```

### 4. Take Screenshots on Failure
Screenshots are automatically saved to `testing/test-results/` on failure.

## Common Issues

### Issue: "Server is not running"
**Solution:** Start the dev server first:
```bash
npm run dev
```

### Issue: "Modal not visible"
**Possible causes:**
- Merchant data not loading from Salesforce
- Network timeout
- Modal component not rendering

**Debug:**
```bash
# Run with headed mode to see what's happening
npx playwright test e2e/direct-booking-urls.spec.ts --headed --debug
```

### Issue: "URL parameter not removed"
**Possible causes:**
- Router.replace() not working
- React state not updating
- Suspense boundary issue

**Check:**
- Browser console for errors
- Network tab for failed requests
- React DevTools for state

### Issue: "Language checkboxes not found"
**Possible causes:**
- Modal type is not training (installation doesn't have language selection)
- Component structure changed
- Selector needs updating

**Fix:**
Update the selector in the test file to match current component structure.

## Test Maintenance

### When to Update Tests

1. **Modal structure changes** - Update selectors
2. **New booking types added** - Add new test cases
3. **Language options change** - Update language selection tests
4. **URL format changes** - Update URL construction

### Adding New Tests

```typescript
test('should test new feature', async ({ page }) => {
  console.log('Testing new feature...')
  
  await page.goto(`${BASE_URL}/merchant/${TEST_MERCHANT}?booking=new-type`)
  await page.waitForLoadState('networkidle')
  
  // Your test assertions here
  
  console.log('✅ New feature works')
})
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Direct Booking URLs

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run dev &
      - run: sleep 10  # Wait for server to start
      - run: ./testing/test-direct-booking-urls.sh
```

## Performance Benchmarks

Expected test execution times:
- Single test: ~3-5 seconds
- Full suite: ~30-40 seconds
- With all browsers: ~2-3 minutes

## Related Documentation

- **Feature Documentation:** `docs/direct-booking-urls.md`
- **Implementation:** `app/merchant/[merchantId]/page.tsx`
- **Modal Component:** `components/DatePickerModal.tsx`
- **Playwright Config:** `testing/playwright.config.ts`

---

*Last Updated: October 2025*
*Test Coverage: 8 test cases*
*Browsers: Chrome, Firefox, Safari*

