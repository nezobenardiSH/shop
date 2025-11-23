-- CreateTable
CREATE TABLE "menu_submission_notifications" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "submissionLink" TEXT NOT NULL,
    "merchantName" TEXT,
    "msmEmail" TEXT,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_submission_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menu_submission_notifications_trainerId_idx" ON "menu_submission_notifications"("trainerId");

-- CreateIndex
CREATE INDEX "menu_submission_notifications_notifiedAt_idx" ON "menu_submission_notifications"("notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "menu_submission_notifications_trainerId_submissionLink_key" ON "menu_submission_notifications"("trainerId", "submissionLink");
