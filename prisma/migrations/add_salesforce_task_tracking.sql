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

-- CreateIndex
CREATE INDEX "salesforce_task_tracking_trainerId_idx" ON "salesforce_task_tracking"("trainerId");

-- CreateIndex
CREATE INDEX "salesforce_task_tracking_taskType_idx" ON "salesforce_task_tracking"("taskType");

-- CreateIndex
CREATE INDEX "salesforce_task_tracking_createdAt_idx" ON "salesforce_task_tracking"("createdAt");

-- CreateIndex
CREATE INDEX "salesforce_task_tracking_completedAt_idx" ON "salesforce_task_tracking"("completedAt");

-- CreateIndex (unique constraint for trainerId + taskType)
CREATE UNIQUE INDEX "salesforce_task_tracking_trainerId_taskType_key" ON "salesforce_task_tracking"("trainerId", "taskType");
