# Local Development OAuth Setup

## Adding Multiple Redirect URLs in Lark

In the Callback Configuration page you showed, you can add multiple URLs for both production and local development.

### Option 1: Multiple URLs in Same Field (If Supported)

Try adding both URLs separated by a comma or newline:

```
https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback
http://localhost:3010/api/lark/auth/callback
```

Or try one per line:
```
https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback
http://localhost:3010/api/lark/auth/callback
```

### Option 2: Environment-Based Configuration

If Lark only allows one URL, you have several options:

## Solution 1: Use ngrok (Recommended for Development)

1. **Install ngrok**
   ```bash
   # Mac
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Run your app locally**
   ```bash
   npm run dev
   # App runs on http://localhost:3010
   ```

3. **Start ngrok tunnel**
   ```bash
   ngrok http 3010
   ```

4. **Get your ngrok URL**
   ```
   Forwarding: https://abc123.ngrok.io -> localhost:3010
   ```

5. **Update .env.local**
   ```env
   LARK_REDIRECT_URI=https://abc123.ngrok.io/api/lark/auth/callback
   NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
   ```

6. **Add ngrok URL to Lark**
   Add the ngrok URL to your Lark app callback configuration

## Solution 2: Switch Between Environments

### For Local Development:
1. In Lark Console, temporarily change the URL to:
   ```
   http://localhost:3010/api/lark/auth/callback
   ```

2. Update `.env.local`:
   ```env
   LARK_REDIRECT_URI=http://localhost:3010/api/lark/auth/callback
   NEXT_PUBLIC_APP_URL=http://localhost:3010
   ```

### For Production Testing:
1. Change back to production URL in Lark Console:
   ```
   https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback
   ```

2. Update `.env.local`:
   ```env
   LARK_REDIRECT_URI=https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback
   NEXT_PUBLIC_APP_URL=https://onboarding-portal-b0ay.onrender.com
   ```

## Solution 3: Create Two Lark Apps

1. **Production App** - For production use
   - Redirect: `https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback`

2. **Development App** - For local development
   - Redirect: `http://localhost:3010/api/lark/auth/callback`
   - Different App ID and Secret

Then use different `.env` files:
- `.env.production` - Production app credentials
- `.env.local` - Development app credentials

## Solution 4: Dynamic Redirect URI (Advanced)

Modify your OAuth service to detect environment:

```typescript
// lib/lark-oauth-service.ts
constructor() {
  this.baseUrl = process.env.LARK_DOMAIN || 'https://open.larksuite.com'
  this.appId = process.env.LARK_APP_ID || ''
  this.appSecret = process.env.LARK_APP_SECRET || ''
  
  // Dynamic redirect URI based on environment
  if (process.env.NODE_ENV === 'development') {
    this.redirectUri = 'http://localhost:3010/api/lark/auth/callback'
  } else {
    this.redirectUri = process.env.LARK_REDIRECT_URI || 
      'https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback'
  }
}
```

## Testing Locally

Once configured for local:

1. **Start your development server**
   ```bash
   npm run dev
   ```

2. **Visit local authorization page**
   ```
   http://localhost:3010/trainers/authorize
   ```

3. **Click "Authorize with Lark"**
   - Should redirect to Lark
   - After authorization, redirects back to localhost

## Recommended Approach

For easiest development:
1. **Try adding both URLs** to the Lark callback field first
2. **If that doesn't work, use ngrok** - it's the most flexible
3. **As a last resort**, switch URLs when needed

## Environment Variables for Local

Your `.env.local` for local development:
```env
# Local Development
LARK_APP_ID=cli_a8549d99f97c502f
LARK_APP_SECRET=M7Wzk5ZGORiSJJp7xKjxEdzWEOBVtpNT
LARK_DOMAIN=https://open.larksuite.com
LARK_REDIRECT_URI=http://localhost:3010/api/lark/auth/callback
NEXT_PUBLIC_APP_URL=http://localhost:3010

# Database (same as production)
DATABASE_URL=postgresql://...

# Disable mock mode
MOCK_LARK_BOOKING=false
MOCK_LARK_BUSY=false
```