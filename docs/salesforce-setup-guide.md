# Salesforce Sandbox Integration Setup Guide

## Important: Salesforce Sandbox Environment

This integration is designed for **Salesforce Sandbox** environments, which are perfect for development and testing without affecting production data.

## Step 1: Create a Salesforce Connected App in Sandbox

1. **Log into Salesforce Sandbox Setup**
   - Go to your Salesforce Sandbox org (usually ends with `.sandbox.my.salesforce.com`)
   - Click the gear icon → Setup
   - In Quick Find, search for "App Manager"

2. **Create New Connected App**
   - Click "New Connected App"
   - Fill in basic information:
     - Connected App Name: `Merchant Onboarding Portal - Sandbox`
     - API Name: `Merchant_Onboarding_Portal_Sandbox`
     - Contact Email: Your email
     - Description: `Integration for merchant onboarding portal (Sandbox environment)`

3. **Enable OAuth Settings**
   - Check "Enable OAuth Settings"
   - Callback URL: `https://your-domain.com/oauth/callback` (or `http://localhost:3010/oauth/callback` for testing)
   - Selected OAuth Scopes (select these from the Available OAuth Scopes):
     - **Manage user data via APIs (api)** ✅
     - **Perform requests at any time (refresh_token, offline_access)** ✅
     - **Access the identity URL service (id, profile, email, address, phone)** ✅

4. **Save and Get Credentials**
   - Save the Connected App
   - Copy the Consumer Key (Client ID)
   - Copy the Consumer Secret (Client Secret)

## Step 2: Get Sandbox Security Token

1. **Reset Security Token in Sandbox**
   - In your Salesforce Sandbox, go to Personal Settings → Reset My Security Token
   - Check your email for the new security token
   - **Note:** Sandbox security tokens are different from production tokens

## Step 3: Create Custom Fields (if needed)

In Salesforce Setup, go to Object Manager → Account → Fields & Relationships:

1. **External_Id__c** (Text, External ID)
   - Field Label: External ID
   - Length: 255
   - External ID: Checked
   - Unique: Checked

2. **Onboarding_Stage__c** (Picklist)
   - Field Label: Onboarding Stage
   - Values: new, in_progress, completed, cancelled

3. **Installation_Date__c** (Date)
   - Field Label: Installation Date

4. **Training_Date__c** (Date)
   - Field Label: Training Date

## Step 4: Environment Variables for Sandbox

Add these to your `.env.local` file:

```env
# Salesforce Sandbox Credentials
SF_USERNAME=your.salesforce@email.com.sandbox_name
SF_PASSWORD=your_sandbox_password
SF_TOKEN=your_sandbox_security_token
SF_CLIENT_ID=your_consumer_key_from_sandbox
SF_CLIENT_SECRET=your_consumer_secret_from_sandbox
SF_LOGIN_URL=https://test.salesforce.com
```

**Important Notes:**
- **Username Format:** For sandbox, your username is typically `your.email@company.com.sandboxname`
- **Login URL:** Use `https://test.salesforce.com` for sandbox (not `https://login.salesforce.com`)
- **Password:** Use your sandbox password (may be different from production)
- **Security Token:** Use the security token from your sandbox environment

## Step 5: Test Connection

Use the test endpoint: `GET /api/salesforce/test`

## Step 6: Set Up Webhooks (Optional)

For real-time Salesforce → Portal sync:

1. **Create Platform Event or Use Process Builder**
2. **Set Webhook URL:** `https://your-domain.com/api/salesforce/webhook`
3. **Configure to trigger on Account changes**

## Sandbox-Specific Troubleshooting

- **Invalid Login:**
  - Verify username format: `user@company.com.sandboxname`
  - Use sandbox password (not production password)
  - Use sandbox security token
  - Ensure login URL is `https://test.salesforce.com`
- **API Limits:** Sandbox environments have lower API limits than production
- **Field Permissions:** Ensure your sandbox user has access to custom fields
- **IP Restrictions:** Sandbox may have different IP restrictions than production
- **Data Refresh:** Remember that sandbox data may be refreshed periodically
- **Sandbox Status:** Ensure your sandbox is active and not in maintenance mode

## Sandbox Benefits for Development

- ✅ **Safe Testing:** No risk to production data
- ✅ **Isolated Environment:** Changes don't affect live systems
- ✅ **Full Feature Access:** Most Salesforce features available
- ✅ **Realistic Testing:** Similar to production environment
- ✅ **Easy Reset:** Can refresh sandbox if needed
