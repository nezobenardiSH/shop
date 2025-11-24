# How to Run Migration on Render (Existing Database)

Your database already has tables, so you need to baseline it first.

## Step 1: Baseline Existing Migrations

In Render Shell, run:

```bash
npx prisma migrate resolve --applied "20241112000000_init"
npx prisma migrate resolve --applied "20241121000000_add_menu_submission_notifications"
```

This tells Prisma that these migrations are already applied.

## Step 2: Create Migration Directory

We need to create a proper migration folder for the new migration:

```bash
mkdir -p prisma/migrations/20241124000000_add_salesforce_task_tracking
```

## Step 3: Move SQL File to Migration Folder

```bash
mv prisma/migrations/add_salesforce_task_tracking.sql prisma/migrations/20241124000000_add_salesforce_task_tracking/migration.sql
```

## Step 4: Run Migration

```bash
npx prisma migrate deploy
```

---

## Alternative: Manual SQL Execution (Faster)

If the above doesn't work, just run the SQL directly:

```bash
psql $DATABASE_URL << 'SQL'
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
SQL
```

Then tell Prisma this migration is done:

```bash
npx prisma migrate resolve --applied "20241124000000_add_salesforce_task_tracking"
```

---

## Verification

After running the migration, verify:

```bash
psql $DATABASE_URL -c "\d salesforce_task_tracking"
```

You should see the table structure.
Database migration completed with camelCase columns.
