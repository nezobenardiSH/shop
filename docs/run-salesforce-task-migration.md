# Running the Salesforce Task Tracking Migration

## Overview
This guide explains how to apply the database migration for the `SalesforceTaskTracking` table to your production database on Render.

## Migration File
Location: `prisma/migrations/add_salesforce_task_tracking.sql`

## Method 1: Using Prisma Migrate (Recommended)

### Step 1: Connect to Production Database
Ensure your production DATABASE_URL is set in Render environment variables.

### Step 2: Run Migration via Render Dashboard
1. Go to your Render Dashboard
2. Navigate to your web service
3. Click on "Shell" tab
4. Run the following command:
```bash
npx prisma migrate deploy
```

This will automatically apply all pending migrations, including the Salesforce task tracking migration.

### Step 3: Verify Migration
Run this command to check the database:
```bash
npx prisma db pull
```

---

## Method 2: Manual SQL Execution (If Method 1 Fails)

### Step 1: Get Database Connection String
1. Go to Render Dashboard
2. Navigate to your PostgreSQL database
3. Copy the "External Database URL" or "Internal Database URL"

### Step 2: Connect via psql
Using a database client (like TablePlus, DBeaver, or psql CLI):

**Using psql:**
```bash
psql "your_database_url_here"
```

**Example:**
```bash
psql "postgres://user:password@host:5432/database_name"
```

### Step 3: Run the Migration SQL
Copy and paste the contents of `prisma/migrations/add_salesforce_task_tracking.sql`:

```sql
-- CreateEnum for TaskType
CREATE TYPE "TaskType" AS ENUM ('MENU_SUBMISSION', 'VIDEO_UPLOAD', 'EXTERNAL_VENDOR_BOOKING');

-- CreateTable for SalesforceTaskTracking
CREATE TABLE "salesforce_task_tracking" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "taskType" "TaskType" NOT NULL,
    "merchantName" TEXT,
    "msmEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "salesforce_task_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salesforce_task_tracking_taskId_key" ON "salesforce_task_tracking"("taskId");
CREATE INDEX "salesforce_task_tracking_trainerId_idx" ON "salesforce_task_tracking"("trainerId");
CREATE INDEX "salesforce_task_tracking_taskType_idx" ON "salesforce_task_tracking"("taskType");
CREATE INDEX "salesforce_task_tracking_createdAt_idx" ON "salesforce_task_tracking"("createdAt");
CREATE INDEX "salesforce_task_tracking_completedAt_idx" ON "salesforce_task_tracking"("completedAt");
CREATE UNIQUE INDEX "salesforce_task_tracking_trainerId_taskType_key" ON "salesforce_task_tracking"("trainerId", "taskType");
```

### Step 4: Verify Tables Created
Run this query to verify:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'salesforce_task_tracking';
```

Expected output:
```
        tablename
--------------------------
 salesforce_task_tracking
(1 row)
```

### Step 5: Verify Enum Created
```sql
SELECT typname FROM pg_type WHERE typname = 'TaskType';
```

Expected output:
```
 typname
----------
 TaskType
(1 row)
```

---

## Method 3: Via Render Build Command (Automatic on Deploy)

### Add to package.json
If not already present, ensure your `package.json` has:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

This will automatically run migrations during deployment.

---

## Verification Checklist

After running the migration, verify:

- [ ] Table `salesforce_task_tracking` exists
- [ ] Enum `TaskType` exists with values: MENU_SUBMISSION, VIDEO_UPLOAD, EXTERNAL_VENDOR_BOOKING
- [ ] All 5 indexes are created
- [ ] Unique constraints are in place (taskId, trainerId+taskType)

### Verification Query
```sql
-- Check table structure
\d salesforce_task_tracking

-- Check enum values
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'TaskType'::regtype;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'salesforce_task_tracking';
```

---

## Troubleshooting

### Error: "type TaskType already exists"
The enum already exists. You can skip the CREATE TYPE command and only run the CREATE TABLE portion.

### Error: "relation salesforce_task_tracking already exists"
The table already exists. Check if it was already created:
```sql
SELECT * FROM salesforce_task_tracking LIMIT 1;
```

### Error: "permission denied"
Ensure you're connected with a user that has CREATE privileges on the database.

### Rollback (if needed)
If you need to rollback the migration:
```sql
DROP TABLE IF EXISTS salesforce_task_tracking;
DROP TYPE IF EXISTS "TaskType";
```

---

## Post-Migration Steps

After successful migration:

1. **Update Environment Variables**
   - Ensure `SALESFORCE_INSTANCE_URL` is set in Render
   - Verify all Salesforce credentials are configured

2. **Deploy Code Changes**
   - Push your code changes to trigger a Render deployment
   - The new task creation logic will be active

3. **Test Task Creation**
   - Trigger the cron job manually: `/api/cron/check-menu-submissions`
   - Upload a video through the portal
   - Book an external vendor installation
   - Verify tasks appear in Salesforce

4. **Monitor Logs**
   - Check Render logs for any Salesforce API errors
   - Look for task creation success messages (✅)
   - Monitor database for new records in `salesforce_task_tracking`

---

## Database Schema Reference

### Table: salesforce_task_tracking

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | TEXT | NO | Primary key (cuid) |
| taskId | TEXT | NO | Salesforce Task.Id (unique) |
| trainerId | TEXT | NO | Onboarding_Trainer__c.Id |
| taskType | TaskType | NO | Type of task (enum) |
| merchantName | TEXT | YES | Merchant name (for reference) |
| msmEmail | TEXT | YES | MSM email who was assigned |
| createdAt | TIMESTAMP | NO | When task was created |
| completedAt | TIMESTAMP | YES | When task was completed (future use) |

### Constraints:
- **Primary Key**: `id`
- **Unique**: `taskId`
- **Unique**: `(trainerId, taskType)` - Prevents duplicate tasks per merchant per type
- **Indexes**: trainerId, taskType, createdAt, completedAt

---

## Support

If you encounter issues:
1. Check Render logs for error messages
2. Verify database connection string is correct
3. Ensure Prisma Client is up to date: `npm install @prisma/client@latest`
4. Contact database administrator if permission issues persist
