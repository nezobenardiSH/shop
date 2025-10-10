# Fix Lark OAuth Redirect URI Error

## Error
```
Error code: 20029 redirect_uri request is invalid
```

## Solution

### Step 1: Update Lark Developer Console

1. **Go to Lark Developer Console**
   - Visit: https://open.larksuite.com/app
   - Find your app (App ID: `cli_a8549d99f97c502f`)

2. **Navigate to Security Settings**
   - Click on your app
   - Go to "Security Settings" or "OAuth Redirect URLs"

3. **Add Your Production Redirect URI**
   
   Add this EXACT URL (no trailing slash):
   ```
   https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback
   ```

   **Important:** 
   - Must be HTTPS (not HTTP)
   - Must match exactly (including `/api/lark/auth/callback`)
   - No trailing slash at the end
   - Case-sensitive

4. **Also Add (for local testing)**
   ```
   http://localhost:3010/api/lark/auth/callback
   ```

5. **Save Changes**
   - Click Save/Confirm
   - Changes may take 1-2 minutes to propagate

### Step 2: Update Environment Variables

Make sure your production environment on Render has these variables:

```env
LARK_APP_ID=cli_a8549d99f97c502f
LARK_APP_SECRET=M7Wzk5ZGORiSJJp7xKjxEdzWEOBVtpNT
LARK_DOMAIN=https://open.larksuite.com
LARK_REDIRECT_URI=https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback
NEXT_PUBLIC_APP_URL=https://onboarding-portal-b0ay.onrender.com
```

### Step 3: Update on Render Dashboard

1. Go to your Render dashboard
2. Find your service: `onboarding-portal`
3. Go to Environment settings
4. Add/Update these environment variables:
   - `LARK_REDIRECT_URI`: `https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback`
   - `NEXT_PUBLIC_APP_URL`: `https://onboarding-portal-b0ay.onrender.com`

### Step 4: Redeploy

After updating environment variables on Render:
1. Trigger a manual deploy, or
2. Push a commit to trigger auto-deploy

### Step 5: Test

1. Visit: https://onboarding-portal-b0ay.onrender.com/trainers/authorize
2. Click "Authorize with Lark"
3. Should redirect to Lark without error

## Common Issues

### Still Getting Error?

1. **Check for typos** - URL must match EXACTLY
2. **Wait 2-3 minutes** - Lark needs time to update
3. **Clear browser cache** - Old redirect might be cached
4. **Check HTTPS** - Production must use HTTPS

### Multiple Redirect URIs

In Lark console, you can add multiple redirect URIs:
```
https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback
http://localhost:3010/api/lark/auth/callback
https://yourdomain.com/api/lark/auth/callback
```

This allows both local and production testing.

## Verification

To verify the correct redirect URI is being used:

1. Check the OAuth URL being generated:
   ```javascript
   console.log(larkOAuthService.getAuthorizationUrl())
   ```

2. The URL should contain:
   ```
   redirect_uri=https%3A%2F%2Fonboarding-portal-b0ay.onrender.com%2Fapi%2Flark%2Fauth%2Fcallback
   ```

## Still Need Help?

If the issue persists after following these steps:
1. Double-check the Lark app console for the exact redirect URI
2. Ensure no trailing slashes or extra characters
3. Contact Lark support with LogID: 2025101016140837A5409EBD61E4292C4F