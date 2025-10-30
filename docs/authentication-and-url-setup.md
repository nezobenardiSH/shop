# Authentication and URL Setup Documentation

## Table of Contents
- [Overview](#overview)
- [Authentication Flow](#authentication-flow)
- [URL Structure](#url-structure)
- [Salesforce ID Handling](#salesforce-id-handling)
- [PIN Generation](#pin-generation)
- [Cookie Management](#cookie-management)
- [Environment Setup](#environment-setup)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Onboarding Portal uses a PIN-based authentication system where merchants log in using the last 4 digits of their registered phone numbers. The system integrates with Salesforce for data storage and uses JWT tokens for session management.

## Authentication Flow

### 1. Login Process
```
User → Login Page → Enter PIN → API Validation → JWT Token → Cookie → Redirect
```

1. **User accesses merchant URL**: `/merchant/{salesforceId}`
2. **Middleware check**: If no valid auth token, redirect to `/login/{salesforceId}`
3. **PIN entry**: User enters 4-digit PIN
4. **Validation**: System queries Salesforce for merchant phone numbers
5. **Token generation**: JWT token created with merchant data
6. **Cookie storage**: Token stored as httpOnly cookie
7. **Redirect**: User redirected to originally requested page

### 2. Key Components

#### Login Page (`/login/[merchantId]/page.tsx`)
- Dynamic route that accepts Salesforce merchant ID
- Displays merchant name fetched from Salesforce
- 4-digit PIN input field

#### Login API (`/api/auth/merchant-login/route.ts`)
- Validates merchant ID exists in Salesforce
- Checks PIN against phone numbers
- Generates JWT token
- Sets httpOnly cookie
- Rate limiting (5 attempts, 15-minute lockout)

#### Middleware (`middleware.ts`)
- Protects `/merchant/*` routes
- Validates JWT tokens
- Handles Salesforce ID format differences
- Auto-redirects to login when switching merchants

---

## URL Structure

### Public URLs
- **Login**: `/login/{salesforceId}`
- **Merchant Dashboard**: `/merchant/{salesforceId}`
- **Merchant Details**: `/merchant/{salesforceId}/details`

### API Endpoints
- **Login**: `POST /api/auth/merchant-login`
- **Logout**: `POST /api/auth/merchant-logout`
- **Salesforce Data**: `GET /api/salesforce/merchant/{salesforceId}`

### URL Parameters
- `{salesforceId}`: Can be either 15 or 18 character Salesforce ID
- Query params: `?redirect=/path` for post-login redirect

---

## Salesforce ID Handling

### The 15 vs 18 Character Problem

Salesforce uses two ID formats:

1. **15-character ID** (Case-sensitive)
   - Example: `a0yQ900000BUgcz`
   - Used in URLs for brevity
   - Original format

2. **18-character ID** (Case-safe)
   - Example: `a0yQ900000BUgczIAD`
   - Adds 3-character checksum suffix
   - Returned by Salesforce queries
   - Case-insensitive

### How the System Handles Both

```javascript
// In middleware.ts
const urlId15 = urlMerchantId.substring(0, 15)
const tokenId15 = tokenTrainerId.substring(0, 15)

if (urlId15 !== tokenId15) {
  // IDs don't match - redirect to login
}
```

**Key Points:**
- URLs can use either 15 or 18 character IDs
- System compares only first 15 characters
- Token stores the full ID returned by Salesforce (usually 18 chars)
- Comparison is case-sensitive for the first 15 characters

---

## PIN Generation

### PIN Source
PINs are the **last 4 digits** of phone numbers stored in Salesforce:

1. **Business Owner Contact Phone** (`Business_Owner_Contact__r.Phone`)
2. **Merchant PIC Contact Number** (`Merchant_PIC_Contact_Number__c`)
3. **Operation Manager Contact Phone** (`Operation_Manager_Contact__r.Phone`)

### Phone Number Processing
```javascript
// Example phone: +639764696882
// PIN would be: 6882

function extractPIN(phoneNumber) {
  const cleaned = phoneNumber.replace(/\D/g, ''); // Remove non-digits
  return cleaned.slice(-4); // Last 4 digits
}
```

### Multiple Valid PINs
A merchant can have multiple valid PINs if they have multiple phone numbers registered. Any of them will work for authentication.

---

## Cookie Management

### Cookie Configuration
```javascript
cookieStore.set('auth-token', token, {
  httpOnly: true,                    // Not accessible via JavaScript
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'lax',                  // CSRF protection
  maxAge: 24 * 60 * 60,              // 24 hours
  path: '/'                          // Available site-wide
})
```

### Token Payload
```javascript
{
  merchantId: "a0yQ900000BUgcz",      // 15-char ID from URL
  trainerId: "a0yQ900000BUgczIAD",    // 18-char ID from Salesforce
  trainerName: "Merchant Name",
  userName: "Contact Name",
  pin: "6882",
  iat: 1234567890,                    // Issued at
  exp: 1234654290                     // Expires at (24 hours)
}
```

### Switching Between Merchants
When accessing a different merchant:
1. Middleware detects ID mismatch
2. Clears existing auth-token cookie
3. Redirects to login page for new merchant
4. After successful login, new token is set

---

## Environment Setup

### Required Environment Variables

```env
# JWT Secret for token signing
JWT_SECRET=your-secret-key-here

# Salesforce Credentials
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_USERNAME=your-username
SALESFORCE_PASSWORD=your-password
SALESFORCE_SECURITY_TOKEN=your-security-token

# Node Environment
NODE_ENV=production  # or development

# Lark Integration (if using)
LARK_APP_ID=cli_xxxxx
LARK_APP_SECRET=xxxxx
```

### Deployment URLs

For Render deployment, update redirect URIs:
- Production: `https://your-app.onrender.com/api/lark/auth/callback`
- Development: `http://localhost:3010/api/lark/auth/callback`

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "Invalid PIN" Error
**Causes:**
- Incorrect PIN (not matching last 4 digits of registered phone)
- Phone number not in Salesforce
- Phone number format issues

**Solution:**
- Verify phone numbers in Salesforce
- Check format: Should include country code (e.g., +639764696882)
- Try PINs from all registered phone numbers

#### 2. Can't Access Different Merchant
**Cause:** Old auth token for previous merchant

**Solution:**
- Click "Log out" button
- Clear browser cookies for the domain
- System auto-clears on merchant switch (after fix)

#### 3. "Too many attempts" Error
**Cause:** Rate limiting after 5 failed attempts

**Solution:**
- Wait 15 minutes for lockout to expire
- Verify correct PIN before attempting

#### 4. Login Succeeds but Redirects to Login Again
**Cause:** Usually Salesforce ID mismatch (15 vs 18 character)

**Solution:**
- Ensure middleware handles both ID formats
- Check token payload matches URL format

#### 5. "No phone numbers configured" Error
**Cause:** Merchant has no phone numbers in Salesforce

**Solution:**
- Add at least one phone number to Salesforce:
  - Business Owner Contact
  - Operation Manager Contact
  - Merchant PIC Contact Number

### Debug Checklist

1. **Check Browser Console**
   - Look for login success messages
   - Check for redirect logs

2. **Verify Cookie**
   - DevTools → Application → Cookies
   - Look for `auth-token` cookie
   - Check domain and path settings

3. **Test API Directly**
   ```bash
   curl -X POST https://your-domain/api/auth/merchant-login \
     -H "Content-Type: application/json" \
     -d '{"merchantId":"a0yQ900000BUgcz","pin":"6882"}'
   ```

4. **Check Salesforce Data**
   ```bash
   curl https://your-domain/api/salesforce/merchant/{merchantId}
   ```
   Verify phone numbers are present

5. **Verify Environment Variables**
   - Ensure JWT_SECRET is set
   - Check Salesforce credentials
   - Verify NODE_ENV setting

---

## Security Considerations

1. **PIN Security**
   - PINs are derived from phone numbers (not randomly generated)
   - Consider this is less secure than passwords
   - Suitable for low-risk merchant portals

2. **Rate Limiting**
   - 5 attempts per merchant ID
   - 15-minute lockout after exceeded attempts
   - Prevents brute force attacks

3. **Token Security**
   - HttpOnly cookies prevent XSS attacks
   - Secure flag ensures HTTPS in production
   - SameSite=lax prevents CSRF
   - 24-hour expiration limits exposure

4. **Merchant Isolation**
   - Each merchant can only access their own data
   - Token validates merchant ID matches URL
   - Automatic logout when switching merchants

---

## API Reference

### POST /api/auth/merchant-login

**Request:**
```json
{
  "merchantId": "a0yQ900000BUgcz",
  "pin": "6882"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "merchantName": "Merchant Name"
}
```

**Error Responses:**
- 400: Missing merchantId or PIN
- 401: Invalid PIN
- 429: Too many attempts (rate limited)
- 503: Salesforce connection failed

### POST /api/auth/merchant-logout

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Related Documentation

- [Salesforce Field Mapping](./salesforce-field-mapping.md)
- [Lark App Redirect URI Setup](./lark-app-redirect-uri-setup.md)
- [Progress Bar Completion Guide](./progress-bar-completion-guide.md)

---

## Update History

- **2025-10-30**: Initial documentation created
- **2025-10-30**: Added Salesforce ID handling section
- **2025-10-30**: Added troubleshooting for 15 vs 18 character ID issue