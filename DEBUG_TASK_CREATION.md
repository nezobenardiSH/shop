# Debugging Salesforce Task Creation

## Check Render Logs

After uploading a video, look for these log messages:

### Expected Success Flow:
```
✅ Successfully uploaded video for trainer: [trainer-id]
📧 Store video notification sent to MSM: [Name] ([email])
✅ Found Salesforce User: [Name] ([User ID])
📝 Creating Salesforce Task: [details]
✅ Salesforce Task created: [Task ID]
```

### Common Issues:

#### 1. No MSM Email Found
```
⚠️ No MSM email or merchant name found - skipping store video notification
```
**Cause**: The Onboarding_Trainer__c record doesn't have MSM_Name__r.Email set
**Fix**: Set MSM_Name__r field in Salesforce for this trainer record

#### 2. No Salesforce User Found
```
⚠️ No Salesforce User found for [email], skipping task creation
```
**Cause**: MSM email doesn't match any active Salesforce User
**Fix**: Create/activate Salesforce User with this email OR update MSM_Name__r to point to existing user

#### 3. Task Already Exists
```
⏭️ Salesforce Task already exists (created [timestamp])
```
**Cause**: Task was already created in last 24 hours (prevents duplicates)
**Fix**: This is normal - wait 24 hours or check Salesforce for existing task

#### 4. Salesforce Connection Failed
```
❌ Failed to create Salesforce Task: [error]
```
**Cause**: Salesforce API error
**Fix**: Check SF_USERNAME, SF_PASSWORD, SF_TOKEN environment variables

#### 5. Database Error
```
❌ Failed to create Salesforce Task: [Prisma error]
```
**Cause**: Database connection or migration issue
**Fix**: Verify migration ran successfully

---

## Manual Checks in Render Shell

### 1. Check if table exists:
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM salesforce_task_tracking;"
```

### 2. Check environment variables:
```bash
echo $SALESFORCE_INSTANCE_URL
echo $SF_USERNAME
echo $SF_LOGIN_URL
```

### 3. Test Salesforce connection:
```bash
curl https://your-domain.onrender.com/api/salesforce/test
```

### 4. Check existing tasks in database:
```bash
psql $DATABASE_URL -c "SELECT taskType, merchantName, createdAt FROM salesforce_task_tracking ORDER BY createdAt DESC LIMIT 5;"
```

---

## Manual Test in Render Shell

You can test the Salesforce Task API directly:

```bash
node << 'EOF'
const { getSalesforceConnection } = require('./lib/salesforce.js');
const { createSalesforceTask, getMsmSalesforceUserId } = require('./lib/salesforce-tasks.js');

async function test() {
  console.log('Testing Salesforce Task creation...');

  // Replace with actual MSM email
  const msmEmail = 'msm@example.com';

  const userId = await getMsmSalesforceUserId(msmEmail);
  console.log('MSM User ID:', userId);

  if (userId) {
    const result = await createSalesforceTask({
      subject: 'Test Task',
      description: 'This is a test task',
      status: 'Not Started',
      priority: 'Normal',
      ownerId: userId,
      whatId: 'a0yXXXXXXXXXXXXXXX', // Replace with real Onboarding_Trainer__c ID
      activityDate: new Date().toISOString().split('T')[0]
    });
    console.log('Task creation result:', result);
  }
}

test().catch(console.error);
EOF
```

---

## Check Salesforce Directly

### 1. Verify MSM has Salesforce User account
- Go to Salesforce → Setup → Users
- Search for MSM email
- Verify user is Active

### 2. Check for Tasks
- Go to Salesforce
- Navigate to Tasks tab
- Filter by "Assigned to Me" (as MSM)
- Look for tasks created today

### 3. Check Onboarding_Trainer__c record
- Find the merchant's Onboarding_Trainer__c record
- Verify MSM_Name__r field is populated
- Check MSM_Name__r.Email value

---

## Quick Fix Commands

### Reset Task Tracking (if stuck)
```bash
psql $DATABASE_URL -c "DELETE FROM salesforce_task_tracking WHERE taskType = 'VIDEO_UPLOAD';"
```

### Check Prisma connection
```bash
npx prisma db pull
```

### Regenerate Prisma Client
```bash
npx prisma generate
```

---

## Getting Help

If still not working:
1. Copy full error message from Render logs
2. Check which step is failing (notification vs task creation)
3. Verify environment variables are set
4. Test Salesforce connection endpoint
