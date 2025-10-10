# Lark Callback URL Alternatives

## If Lark Won't Accept the URL

### Try These Variations:

1. **Without the /api prefix** (some platforms don't allow /api in callback URLs):
   ```
   https://onboarding-portal-b0ay.onrender.com/lark/auth/callback
   ```

2. **With trailing slash**:
   ```
   https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback/
   ```

3. **Just the base URL** (then handle redirect in app):
   ```
   https://onboarding-portal-b0ay.onrender.com/
   ```

4. **Alternative path structure**:
   ```
   https://onboarding-portal-b0ay.onrender.com/auth/lark/callback
   ```

## Quick Fix Solutions

### Solution 1: Use Base URL Only
If Lark only accepts base URLs:

1. Set in Lark:
   ```
   https://onboarding-portal-b0ay.onrender.com
   ```

2. Update our callback route to handle at root level:
   - Move `/app/api/lark/auth/callback/route.ts` to `/app/lark-callback/page.tsx`

### Solution 2: Different Path Structure
If Lark doesn't like "/api" paths:

1. Create a new route without /api:
   ```
   /app/lark/callback/route.ts
   ```

2. Update Lark with:
   ```
   https://onboarding-portal-b0ay.onrender.com/lark/callback
   ```

### Solution 3: Use a Redirect Service
If Lark has strict URL requirements:

1. Use a URL shortener or redirect service
2. Point it to your actual callback URL
3. Use the shortened URL in Lark

## What's Happening in Lark Console?

The callback URL field might:
- Not accept certain characters (like underscore or hyphen)
- Have length restrictions
- Not allow certain paths (/api)
- Require HTTPS (which we have)
- Need URL encoding

## Immediate Workaround

Try entering just the domain:
```
https://onboarding-portal-b0ay.onrender.com
```

Then we'll handle the OAuth callback at the root level.

## Let Me Know

1. **What error does Lark show** when you try to save?
2. **Can you save just the base URL** without the path?
3. **Is there a placeholder or example** shown in the field?

Based on your answer, I'll adjust the code to work with whatever URL format Lark accepts.