# Where to Add Redirect URI in Lark Developer Console

## Step-by-Step Guide with Screenshots

### 1. Go to Lark Developer Console
**URL:** https://open.larksuite.com/app

### 2. Find Your App
- Look for your app: **App ID: cli_a8549d99f97c502f**
- Click on the app name to enter app management

### 3. Navigate to the Correct Section

Look for one of these sections in the left sidebar:
- **"Security Settings"** (安全设置)
- **"Redirect URLs"** 
- **"OAuth Configuration"**
- **"App Configuration"** → then find **"Redirect URLs"**

### 4. Find the Redirect URL Field

The field might be labeled as:
- **"Redirect URL"** (重定向 URL)
- **"OAuth redirect URL"**
- **"Callback URL"**
- **"Authorized redirect URIs"**

### 5. Add Your Production URL

In the redirect URL field, add:
```
https://onboarding-portal-b0ay.onrender.com/api/lark/auth/callback
```

**Important Notes:**
- Some apps allow multiple URLs (one per line)
- If there's already a URL there, ADD this one, don't replace
- Make sure there's no trailing slash
- Must be HTTPS for production

### 6. Also Add Local Development URL (Optional)
If the field accepts multiple URLs, also add:
```
http://localhost:3010/api/lark/auth/callback
```

### 7. Save Changes
- Look for a **"Save"** or **"Confirm"** button
- Some consoles auto-save
- You might see a success message

### 8. Wait for Propagation
- Changes usually take effect immediately
- Sometimes it can take 1-2 minutes
- If it doesn't work immediately, wait a bit and try again

## What the Page Might Look Like

The redirect URL configuration is usually found in one of these places:

### Option A: In Security Settings
```
App Management
├── Basic Information
├── Security Settings  ← Click here
│   ├── Redirect URLs  ← Add URL here
│   └── Encryption Key
└── Permissions
```

### Option B: In OAuth/Login Settings
```
App Management
├── Basic Information
├── OAuth & SSO  ← Click here
│   ├── OAuth 2.0 Settings
│   ├── Redirect URLs  ← Add URL here
│   └── Scopes
└── Permissions
```

### Option C: In App Features
```
App Management
├── Basic Information
├── App Features  ← Click here
│   ├── Login
│   │   └── Redirect URL  ← Add URL here
│   └── Other Features
└── Permissions
```

## Can't Find It?

If you can't find where to add the redirect URL:

1. **Look for any mention of:**
   - OAuth
   - Login
   - Authentication
   - Redirect
   - Callback
   - Security

2. **Check all tabs/sections** - it might be hidden in a sub-menu

3. **Search function** - Some consoles have a search box, try searching for "redirect"

4. **Language toggle** - Try switching between English/Chinese if available

## Verification

After adding the URL, you can verify it's working by:

1. Going to: https://onboarding-portal-b0ay.onrender.com/trainers/authorize
2. Clicking "Authorize with Lark"
3. You should be redirected to Lark login without the error

## Still Can't Find It?

Share a screenshot of your Lark app console's main page, and I can help you locate the exact section!