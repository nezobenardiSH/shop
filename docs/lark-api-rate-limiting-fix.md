# Lark API Rate Limiting Fix

## Overview

This document describes the fix implemented to prevent Lark API rate limiting errors when checking trainer availability.

## Problem

The system was making too many parallel API calls to Lark, triggering rate limiting errors:

```
Lark API error: method rate limited
❌ Error fetching instances for recurring event: Error: Lark API error: method rate limited
```

### Root Cause

The `getCombinedAvailability()` function used `Promise.all()` to check all trainers simultaneously:

```typescript
// BEFORE: All trainers checked in parallel
const availabilityPromises = trainers.map(async (trainer) => {
  // ... fetch availability
})
const results = await Promise.all(availabilityPromises)
```

Each trainer availability check makes multiple Lark API calls:
- 1x FreeBusy API call
- 1x Calendar Events API call
- 1x `/instances` call per recurring event

**Example with 5 trainers, each with 3 recurring events:**
- 5 × (1 + 1 + 3) = **25 simultaneous API calls**
- Lark rate limit: ~10-20 concurrent requests
- Result: Rate limiting errors, failed availability checks

## Solution

Implemented controlled concurrency to limit the number of parallel API calls.

### Implementation Details

**File:** `lib/trainer-availability.ts`

#### 1. Added Concurrency Limiter Utility

```typescript
/**
 * Process items with limited concurrency to avoid rate limiting
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param maxConcurrent - Maximum number of concurrent operations (default: 3)
 */
async function processWithConcurrencyLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  maxConcurrent: number = 3
): Promise<R[]> {
  const results: R[] = []
  let currentIndex = 0

  async function processNext(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++
      const result = await processor(items[index])
      results[index] = result
    }
  }

  // Start maxConcurrent workers
  const workers = Array(Math.min(maxConcurrent, items.length))
    .fill(null)
    .map(() => processNext())

  await Promise.all(workers)
  return results
}
```

#### 2. Updated getCombinedAvailability()

```typescript
// AFTER: Max 3 trainers checked at a time
const results = await processWithConcurrencyLimit(
  trainers,
  async (trainer) => {
    // ... fetch availability (same logic)
  },
  3 // Max 3 trainers at a time
)
```

## Behavior Comparison

| Aspect | Before | After |
|--------|--------|-------|
| Concurrency | All trainers in parallel | Max 3 at a time |
| API calls (5 trainers) | ~25 simultaneous | ~15 max |
| Rate limiting | Frequent errors | Reliable |
| Speed (5 trainers) | ~2 seconds | ~4 seconds |

## Performance Impact

With max 3 concurrent trainers:
- 3 × (1 + 1 + ~3) = ~15 concurrent API calls
- Within Lark's rate limits
- Acceptable performance (~4 seconds for 5 trainers)

## Functions Affected

| Function | Change |
|----------|--------|
| `getCombinedAvailability()` | Uses controlled concurrency |
| `getSlotAvailability()` | No change (already sequential) |

## Related Documentation

- [Lark Token Refresh Error Handling](./lark-token-refresh-error-handling.md)
- [Lark Permissions Setup](./lark-permissions-setup.md)
