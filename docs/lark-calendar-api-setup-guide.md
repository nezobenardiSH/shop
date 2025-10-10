# Lark Calendar API Setup Guide

## Overview
This guide provides step-by-step instructions for setting up and configuring the Lark Calendar API for your application.

## Prerequisites
- Lark Developer Account
- Admin access to your Lark organization
- Basic understanding of OAuth 2.0 flow

## Step 1: Create a Lark Application

1. **Navigate to Lark Open Platform**
   - Go to [https://open.larksuite.com/](https://open.larksuite.com/)
   - Sign in with your Lark account

2. **Create New App**
   - Click "Create App" button
   - Select "Custom App" for internal use or "App Store App" for public distribution
   - Fill in basic information:
     - App Name
     - App Description
     - App Icon (optional)

3. **Note Your App Credentials**
   - App ID: `cli_xxxxxxxxxxxx`
   - App Secret: Keep this secure and never expose in client-side code

## Step 2: Configure Required Permissions

### Authentication Levels in Lark

Lark uses two types of access tokens for different authorization levels:

#### 1. User Access Token (user_access_token)
- Obtained through OAuth 2.0 flow
- Represents authorization from an individual user
- Accesses resources on behalf of that specific user
- Requires user consent through OAuth authorization

#### 2. Tenant Access Token (tenant_access_token) 
- Obtained through app credentials
- Represents app-level authorization
- Can access resources based on app's permissions
- Does not require individual user authorization

### Calendar API Permission Scopes

Navigate to **Permissions & Scopes** in your app settings and add the required scopes:

#### Calendar Permissions (User Token)
| Scope | Description | Token Type | Access Level |
|-------|-------------|------------|--------------|
| `calendar:calendar` | Update calendar and event information | User token | User-specific access |
| `calendar:calendar:readonly` | Obtain calendar, event, and availability information | User token | User-specific access |
| `calendar:calendar.event:create` | Create event | User token | User-specific access |
| `calendar:calendar.event:read` | Read event | User token | User-specific access |
| `calendar:calendar.event:update` | Update event | User token | User-specific access |
| `calendar:calendar.event:delete` | Delete event | User token | User-specific access |
| `calendar:calendar.free_busy:read` | View availability in calendar | User token | User-specific access |

#### Contact Permissions (User Token)
| Scope | Description | Token Type | Access Level |
|-------|-------------|------------|--------------|
| `contact:user.base:readonly` | Obtain user's basic information | User token | User-specific access |
| `contact:user.email:readonly` | Obtain user's email information | User token | User-specific access |
| `contact:user.id:readonly` | Obtain user ID via email or mobile number | User token | User-specific access |

### How Permissions Work

#### With User Access Token:
- The app accesses **only** the authorized user's calendars
- User must grant permission through OAuth flow
- Each user authorizes individually
- Best for: Personal calendar apps, user-specific integrations

#### With Tenant Access Token:
- The app can access calendars based on admin-configured permissions
- No individual user authorization needed
- Admin approval required for sensitive scopes
- Best for: Admin tools, automation, organization-wide operations

### Setting Up Permissions

1. **Navigate to Permissions & Scopes**
   - Go to your app's configuration page
   - Select "Permissions & Scopes" tab

2. **Add Required Scopes**
   - Search for each calendar scope
   - Click "Add" next to required permissions
   - Note which token types support each scope

3. **Configure Approval**
   - Some scopes require admin approval
   - Submit for approval if needed
   - Wait for admin review (typically 1-2 business days)

### Important Notes

- **Scope Availability**: Not all scopes work with both token types
- **Admin Approval**: Tenant-level access always requires admin approval
- **User Consent**: User access tokens require explicit user authorization
- **Least Privilege**: Only request the minimum scopes needed
- **Token Context**: The same scope behaves differently with user vs tenant tokens

## Step 3: Configure OAuth 2.0 Settings

1. **Navigate to Security Settings**
   - Go to **Security Settings** tab
   - Enable OAuth 2.0

2. **Configure Redirect URLs**
   ```
   https://your-domain.com/auth/lark/callback
   http://localhost:3000/auth/lark/callback (for development)
   ```

3. **Set Token Validity**
   - Access Token: 2 hours (default)
   - Refresh Token: 30 days (recommended)

## Step 4: Enable Calendar API Features

1. **Navigate to Features**
   - Go to **Features** section
   - Enable "Calendar API"

2. **Configure Calendar Settings**
   - Enable event creation
   - Enable event updates
   - Enable recurring events
   - Enable meeting room booking (if needed)

## Step 5: App Verification and Approval

### For Internal Apps
1. Submit for internal approval
2. Admin reviews and approves permissions
3. App becomes available to organization

### For Public Apps
1. Complete app information
2. Submit for Lark review
3. Wait for approval (typically 3-5 business days)

## Step 6: Implementation Setup

### Environment Variables
Create a `.env` file with the following:

```env
LARK_APP_ID=cli_xxxxxxxxxxxx
LARK_APP_SECRET=your_app_secret_here
LARK_VERIFICATION_TOKEN=your_verification_token
LARK_ENCRYPT_KEY=your_encrypt_key (for event subscriptions)
```

### API Endpoints

Base URLs:
- International: `https://open.larksuite.com`
- China: `https://open.feishu.cn`

Key Calendar API Endpoints:
- List Calendars: `GET /open-apis/calendar/v4/calendars`
- Create Event: `POST /open-apis/calendar/v4/calendars/{calendar_id}/events`
- Update Event: `PATCH /open-apis/calendar/v4/calendars/{calendar_id}/events/{event_id}`
- Delete Event: `DELETE /open-apis/calendar/v4/calendars/{calendar_id}/events/{event_id}`

## Step 7: Event Subscriptions (Optional)

If you need real-time calendar updates:

1. **Navigate to Event Subscriptions**
2. **Add Subscription URL**
   ```
   https://your-domain.com/webhooks/lark/calendar
   ```

3. **Subscribe to Calendar Events**
   - `calendar.calendar.created` - Calendar created
   - `calendar.calendar.deleted` - Calendar deleted
   - `calendar.event.created` - Event created
   - `calendar.event.updated` - Event updated
   - `calendar.event.deleted` - Event deleted

4. **Verify Webhook Endpoint**
   - Lark will send a verification request
   - Your endpoint must respond with the challenge parameter

## Step 8: Testing Your Setup

### Test User-Level Authentication (OAuth 2.0 Flow)

1. **Redirect user to authorization URL:**
```
https://open.larksuite.com/open-apis/authen/v1/authorize?
  app_id=your_app_id&
  redirect_uri=https://your-domain.com/auth/callback&
  response_type=code&
  scope=calendar:calendar%20calendar:calendar.event:create%20calendar:calendar.event:read
```

2. **Exchange authorization code for user access token:**
```bash
curl -X POST https://open.larksuite.com/open-apis/authen/v1/access_token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "client_id": "your_app_id",
    "client_secret": "your_app_secret",
    "code": "authorization_code_from_callback",
    "redirect_uri": "https://your-domain.com/auth/callback"
  }'
```

3. **Test User Calendar Access:**
```bash
curl -X GET https://open.larksuite.com/open-apis/calendar/v4/calendars \
  -H "Authorization: Bearer user_access_token"
```

### Test Tenant-Level Authentication (App Access Token)
```bash
# Get app access token (tenant-level)
curl -X POST https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "your_app_id",
    "app_secret": "your_app_secret"
  }'

# Access calendars with tenant token (requires tenant permissions)
curl -X GET https://open.larksuite.com/open-apis/calendar/v4/calendars \
  -H "Authorization: Bearer app_access_token"
```

## Best Practices

1. **Security**
   - Never expose App Secret in client-side code
   - Use server-side proxy for API calls
   - Implement rate limiting
   - Store tokens securely

2. **Error Handling**
   - Implement exponential backoff for rate limits
   - Handle token expiration gracefully
   - Log API errors for debugging

3. **Performance**
   - Cache calendar data when appropriate
   - Use batch APIs where available
   - Implement pagination for large datasets

## Common Issues and Solutions

### Issue: Permission Denied Errors
**Solution:** Ensure all required scopes are added and app is approved by admin

### Issue: Token Expiration
**Solution:** Implement token refresh logic using refresh tokens

### Issue: Rate Limiting
**Solution:** Implement retry logic with exponential backoff

### Issue: Webhook Verification Fails
**Solution:** Ensure your endpoint returns the challenge parameter correctly

## Support Resources

- [Lark Open Platform Documentation](https://open.larksuite.com/document)
- [Calendar API Reference](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMy8jM5ITM/reference/calendar-v4/calendar/overview)
- [Lark Developer Forum](https://open.larksuite.com/community)
- Technical Support Email: open-platform@larksuite.com

## Appendix: Sample Implementation

### Node.js Authentication Examples

#### User-Level Authentication (OAuth 2.0)
```javascript
const axios = require('axios');
const express = require('express');
const app = express();

// Step 1: Redirect user to Lark authorization
app.get('/auth/lark', (req, res) => {
  const authUrl = `https://open.larksuite.com/open-apis/authen/v1/authorize?` +
    `app_id=${process.env.LARK_APP_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=calendar:calendar%20calendar:calendar.event:create%20calendar:calendar.event:read%20calendar:calendar.event:update%20calendar:calendar.event:delete`;
  
  res.redirect(authUrl);
});

// Step 2: Handle callback and exchange code for token
app.get('/auth/lark/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const response = await axios.post(
      'https://open.larksuite.com/open-apis/authen/v1/access_token',
      {
        grant_type: 'authorization_code',
        client_id: process.env.LARK_APP_ID,
        client_secret: process.env.LARK_APP_SECRET,
        code: code,
        redirect_uri: process.env.REDIRECT_URI
      }
    );
    
    const { access_token, refresh_token, expires_in } = response.data.data;
    
    // Store tokens securely (e.g., in session or database)
    req.session.userAccessToken = access_token;
    req.session.refreshToken = refresh_token;
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Token exchange failed:', error);
    res.status(500).send('Authentication failed');
  }
});

// Step 3: Use user access token for API calls
async function getUserCalendars(userAccessToken) {
  const response = await axios.get(
    'https://open.larksuite.com/open-apis/calendar/v4/calendars',
    {
      headers: {
        'Authorization': `Bearer ${userAccessToken}`
      }
    }
  );
  return response.data;
}

// Refresh token when expired
async function refreshUserToken(refreshToken) {
  const response = await axios.post(
    'https://open.larksuite.com/open-apis/authen/v1/refresh_access_token',
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }
  );
  return response.data.data;
}
```

#### Tenant-Level Authentication (App Access Token)
```javascript
const axios = require('axios');

// Get app access token (tenant-level access)
async function getAppAccessToken() {
  const response = await axios.post(
    'https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal',
    {
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET
    }
  );
  return response.data.app_access_token;
}

// Use app token to access all calendars in tenant
async function getAllTenantCalendars(appAccessToken) {
  const response = await axios.get(
    'https://open.larksuite.com/open-apis/calendar/v4/calendars',
    {
      headers: {
        'Authorization': `Bearer ${appAccessToken}`
      }
    }
  );
  return response.data;
}
```

#### Creating Calendar Events with Different Auth Levels
```javascript
// Create event with user-level access
async function createUserCalendarEvent(userAccessToken, calendarId, eventData) {
  const response = await axios.post(
    `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events`,
    eventData,
    {
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

// Create event with tenant-level access
async function createTenantCalendarEvent(appAccessToken, calendarId, eventData) {
  const response = await axios.post(
    `https://open.larksuite.com/open-apis/calendar/v4/calendars/${calendarId}/events`,
    eventData,
    {
      headers: {
        'Authorization': `Bearer ${appAccessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}
```

## Version History
- v1.0 - Initial setup guide
- Last Updated: 2025-01-10