# Lark Token Refresh Error Handling

## Overview

This document describes the smart error handling implementation for Lark OAuth token refresh failures.

## Problem

Previously, when a token refresh failed for **any** reason, the system would delete the user's token from the database. This caused users to lose their authorization due to transient errors such as:

- Rate limiting from Lark API
- Network timeouts
- Temporary Lark API outages

Users would then need to manually re-authorize, even though the underlying issue was temporary.

## Solution

The system now differentiates between **permanent** and **transient** errors:

| Error Type | Action | Examples |
|------------|--------|----------|
| **Permanent** | Delete token (requires re-authorization) | Expired refresh token, revoked access |
| **Transient** | Keep token (retry on next request) | Rate limit, network timeout, 5xx errors |

## Implementation Details

### File: `lib/lark-oauth-service.ts`

#### Helper Method: `isPermanentRefreshError()`

```typescript
private isPermanentRefreshError(error: any): boolean {
  const message = (error?.message || '').toLowerCase()

  const permanentPatterns = [
    'invalid_grant',
    'invalid_refresh_token',
    'token_expired',
    'refresh token expired',
    'refresh token invalid',
    'code: 20003',      // Lark invalid token code
    'code: 99991668',   // Refresh token invalid
    'code: 99991663',   // Token expired
  ]

  return permanentPatterns.some(pattern => message.includes(pattern))
}
```

#### Updated Error Handling in `getValidAccessToken()`

```typescript
} catch (error) {
  console.error(`Failed to refresh token for ${userEmail}:`, error)

  if (this.isPermanentRefreshError(error)) {
    console.log(`Permanent refresh failure - deleting token for ${userEmail}`)
    await prisma.larkAuthToken.delete({
      where: { userEmail }
    })
  } else {
    console.log(`Transient refresh failure - keeping token for ${userEmail}`)
  }

  return null
}
```

## Lark API Error Codes Reference

| Code | Description | Classification |
|------|-------------|----------------|
| 20003 | Invalid token | Permanent |
| 99991668 | Refresh token invalid | Permanent |
| 99991663 | Token expired | Permanent |
| 99991400 | Rate limited | Transient |
| 5xx | Server error | Transient |

## Behavior Summary

### Before
```
Token refresh fails → Token deleted → User must re-authorize
```

### After
```
Token refresh fails
├── Permanent error → Token deleted → User must re-authorize
└── Transient error → Token kept → Retry on next request
```

## Logging

The system logs the classification of each refresh failure:

- `Permanent refresh failure - deleting token for {email}` - Token will be removed
- `Transient refresh failure - keeping token for {email} (will retry later)` - Token preserved

## Related Documentation

- [Lark Permissions Setup](./lark-permissions-setup.md)
