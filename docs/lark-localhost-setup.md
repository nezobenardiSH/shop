# Lark OAuth Localhost Setup

## URLs to Add in Lark Console

In the Lark Developer Console callback configuration, you need to add BOTH URLs:

### For Production:
```
https://onboarding-portal-b0ay.onrender.com/lark-callback
```

### For Localhost Development:
```
http://localhost:3010/lark-callback
```

## How to Add Multiple URLs in Lark

### Option 1: Multiple Lines
Try adding both URLs, one per line:
```
https://onboarding-portal-b0ay.onrender.com/lark-callback
http://localhost:3010/lark-callback
```

### Option 2: Comma Separated
If one per line doesn't work, try comma-separated:
```
https://onboarding-portal-b0ay.onrender.com/lark-callback,http://localhost:3010/lark-callback
```

### Option 3: Space Separated
Or space-separated:
```
https://onboarding-portal-b0ay.onrender.com/lark-callback http://localhost:3010/lark-callback
```

## Local Development Setup

### 1. Use the Development Environment File

For local development, use `.env.development`:
```bash
# Copy the development env file
cp .env.development .env.local

# Or just update the LARK_REDIRECT_URI in .env.local:
LARK_REDIRECT_URI=http://localhost:3010/lark-callback
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

### 2. Start Your Local Server
```bash
npm run dev
```

### 3. Test OAuth Flow Locally
Visit: http://localhost:3010/trainers/authorize

## If Lark Only Accepts One URL

If Lark only allows one redirect URL at a time, you have these options:

### Option A: Use ngrok (Recommended)

1. Install ngrok:
```bash
brew install ngrok
```

2. Start your local server:
```bash
npm run dev
```

3. Create ngrok tunnel:
```bash
ngrok http 3010
```

4. Use the ngrok URL in Lark:
```
https://abc123.ngrok.io/lark-callback
```

5. Update .env.local:
```env
LARK_REDIRECT_URI=https://abc123.ngrok.io/lark-callback
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
```

### Option B: Switch URLs When Needed

**For Local Development:**
1. Change Lark callback URL to: `http://localhost:3010/lark-callback`
2. Update .env.local accordingly
3. Test locally

**For Production Testing:**
1. Change back to: `https://onboarding-portal-b0ay.onrender.com/lark-callback`
2. Update .env.local back
3. Deploy and test

### Option C: Two Separate Apps

Create two Lark apps:
1. **Production App** - with production URL
2. **Development App** - with localhost URL

Then use different credentials in `.env.local` vs production environment.

## Current Setup

The callback route is now available at:
- `/app/lark-callback/route.ts` (without `/api` prefix)

This should work better with Lark's URL requirements since some platforms don't accept `/api` in OAuth callback URLs.

## Testing

After configuring the URLs in Lark:

1. **Local test:**
   - Visit: http://localhost:3010/trainers/authorize
   - Click "Authorize with Lark"
   - Should redirect to Lark, then back to localhost

2. **Production test:**
   - Visit: https://onboarding-portal-b0ay.onrender.com/trainers/authorize
   - Click "Authorize with Lark"
   - Should redirect to Lark, then back to production