# Salesforce Sandbox Integration Checklist

## ✅ Pre-Setup Checklist

- [ ] Access to Salesforce Sandbox environment
- [ ] Admin or API access permissions in the sandbox
- [ ] Ability to create Connected Apps in sandbox

## ✅ Salesforce Sandbox Setup

### Step 1: Connected App Creation
- [ ] Logged into Salesforce Sandbox (URL ends with `.sandbox.my.salesforce.com`)
- [ ] Created Connected App with name: "Merchant Onboarding Portal - Sandbox"
- [ ] Enabled OAuth Settings
- [ ] Added OAuth Scopes:
  - [ ] **Manage user data via APIs (api)**
  - [ ] **Perform requests at any time (refresh_token, offline_access)**
  - [ ] **Access the identity URL service (id, profile, email, address, phone)**
- [ ] Copied Consumer Key (Client ID)
- [ ] Copied Consumer Secret (Client Secret)

### Step 2: Security Token
- [ ] Reset Security Token in sandbox (Personal Settings → Reset My Security Token)
- [ ] Received security token via email
- [ ] Confirmed it's the sandbox token (not production)

### Step 3: Custom Fields (Optional but Recommended)
Create these custom fields on the Account object:

- [ ] **External_Id__c** (Text, 255 chars, External ID, Unique)
- [ ] **Onboarding_Stage__c** (Picklist: new, in_progress, completed, cancelled)
- [ ] **Installation_Date__c** (Date)
- [ ] **Training_Date__c** (Date)

## ✅ Environment Configuration

### Step 4: Update .env.local
- [ ] Added SF_USERNAME (format: `your.email@company.com.sandboxname`)
- [ ] Added SF_PASSWORD (sandbox password)
- [ ] Added SF_TOKEN (sandbox security token)
- [ ] Added SF_CLIENT_ID (Consumer Key from Connected App)
- [ ] Added SF_CLIENT_SECRET (Consumer Secret from Connected App)
- [ ] Set SF_LOGIN_URL to `https://test.salesforce.com`

Example `.env.local`:
```env
# Salesforce Sandbox Credentials
SF_USERNAME=john.doe@company.com.dev
SF_PASSWORD=MyS@ndboxP@ssw0rd
SF_TOKEN=ABC123DEF456GHI789
SF_CLIENT_ID=3MVG9...
SF_CLIENT_SECRET=1234567890...
SF_LOGIN_URL=https://test.salesforce.com
```

## ✅ Testing & Verification

### Step 5: Test Connection
- [ ] Run connection test: `cd merchant-portal && node scripts/test-salesforce-connection.js`
- [ ] Verify successful connection to sandbox
- [ ] Confirm environment shows as "Sandbox"
- [ ] Check Account access permissions
- [ ] Verify custom fields are accessible

### Step 6: Test Portal Integration
- [ ] Start development server: `npm run dev`
- [ ] Test Salesforce connection: `curl http://localhost:3010/api/salesforce/test`
- [ ] Update merchant data and verify sync
- [ ] Check Salesforce sandbox for updated records

## ✅ Common Issues & Solutions

### Username Format Issues
- ❌ `john.doe@company.com` (missing sandbox suffix)
- ✅ `john.doe@company.com.dev` (correct sandbox format)

### Login URL Issues
- ❌ `https://login.salesforce.com` (production URL)
- ✅ `https://test.salesforce.com` (sandbox URL)

### Security Token Issues
- Make sure you're using the sandbox security token
- Token should be appended to password: `password + token`
- Reset token if connection fails

### Permission Issues
- Ensure user has API access enabled
- Check profile permissions for Account object
- Verify custom field access permissions

## ✅ Success Indicators

When everything is working correctly, you should see:

1. **Connection Test Success:**
   ```
   ✅ Successfully connected to Salesforce!
   Environment: Sandbox ✅
   Account Access: Found X accounts
   ```

2. **Portal API Test Success:**
   ```json
   {
     "success": true,
     "message": "✅ Connected to Salesforce Sandbox",
     "environment": "Sandbox",
     "accountCount": 5
   }
   ```

3. **Real-time Sync Working:**
   - Update merchant data in portal
   - See changes reflected in Salesforce sandbox
   - Webhook updates work (if configured)

## 🎯 Next Steps After Setup

Once your sandbox integration is working:

1. **Test Data Creation:** Create test merchant accounts in sandbox
2. **Workflow Testing:** Test complete onboarding workflows
3. **Error Handling:** Test various error scenarios
4. **Performance Testing:** Monitor API usage and response times
5. **Documentation:** Document any custom configurations

## 🚀 Moving to Production

When ready for production:

1. Repeat setup process in production Salesforce org
2. Update environment variables to production values
3. Change SF_LOGIN_URL to `https://login.salesforce.com`
4. Test thoroughly in production environment
5. Monitor API usage limits in production
