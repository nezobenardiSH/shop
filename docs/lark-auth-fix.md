# Fixing Lark Calendar Authentication

## The Issue
Your Lark app has the correct **user-level permissions**, but the current implementation uses **tenant-level (app) authentication** which cannot access user calendars.

## Understanding Lark Authentication Types

### 1. Tenant Access Token (Currently Using)
- Path: `/open-apis/auth/v3/tenant_access_token/internal`
- Scope: App-level operations
- **Cannot access user calendars** even with permissions configured

### 2. User Access Token (Need to Use)
- Path: OAuth 2.0 flow
- Scope: User-level operations
- **Can access calendars** with proper permissions

## Solutions

### Solution A: OAuth 2.0 Flow (Recommended for Production)

1. **One-time Setup for Each Trainer**
   ```bash
   # Each trainer visits this URL once to authorize
   http://localhost:3010/api/lark/auth/authorize?email=trainer@storehub.com
   ```

2. **Authorization Flow**
   - Trainer is redirected to Lark
   - Trainer approves calendar access
   - App stores the access token
   - Calendar operations work for that trainer

### Solution B: Use App Access Token with User Context (Simpler)

Some Lark APIs accept app tokens with user context headers. Try adding user context:

```typescript
// In your API calls, add user context header
headers: {
  'Authorization': `Bearer ${appAccessToken}`,
  'X-Lark-User-Id': 'user_email@company.com', // or user's open_id
}
```

### Solution C: Service Account Approach

1. Create a dedicated service account in Lark
2. Have this account authorize the app once
3. Use its token for all calendar operations
4. Share calendars with this service account

## Quick Fix to Test

### Step 1: Check if User Context Works

Update `/lib/lark.ts` to add user context:

```typescript
async makeRequest(endpoint: string, options: RequestInit & { userEmail?: string } = {}): Promise<any> {
  const token = await this.getAccessToken()
  
  const headers: any = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  }
  
  // Add user context if provided
  if (options.userEmail) {
    headers['X-Lark-User-Id'] = options.userEmail
  }
  
  // ... rest of the method
}
```

### Step 2: Manual Token Approach (For Testing)

1. **Get a User Access Token Manually**
   
   Use Lark API Explorer or Postman to get a user token:
   - Go to: https://open.larksuite.com/document/server-docs/api-call-guide/debugging-tools/api-explorer
   - Authorize with your account
   - Copy the access token

2. **Add to Environment**
   ```env
   # .env.local
   LARK_USER_ACCESS_TOKEN=u-xxxxxxxxxxxx
   ```

3. **Use User Token for Calendar Operations**
   ```typescript
   // For testing only
   const userToken = process.env.LARK_USER_ACCESS_TOKEN
   
   // Use this token instead of app token for calendar operations
   ```

## Recommended Approach

For your use case (internal training scheduling), I recommend:

1. **Short term**: Use manual user tokens for testing
2. **Medium term**: Implement OAuth flow for trainers
3. **Long term**: Consider using Lark's SDK which handles auth better

## Testing After Fix

```bash
# Test with user token
node scripts/test-lark-calendar.js

# Should see:
# ✅ Calendar ID retrieved
# ✅ FreeBusy data returned
# ✅ User found with proper ID
```

## Alternative: Use Lark SDK

Lark provides an official SDK that handles authentication better:

```bash
npm install @larksuiteoapi/node-sdk
```

```typescript
import * as lark from '@larksuiteoapi/node-sdk'

const client = new lark.Client({
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET,
  appType: lark.AppType.SelfBuild,
  domain: lark.Domain.Feishu, // or Lark
})

// The SDK handles auth automatically
const resp = await client.calendar.calendar.list({
  params: {
    page_size: 50,
  },
})
```

## Next Steps

1. Try adding user context headers (quick test)
2. If that doesn't work, implement OAuth flow
3. Consider using Lark SDK for better auth handling

The permissions you have are correct - we just need to use the right authentication method to access them!