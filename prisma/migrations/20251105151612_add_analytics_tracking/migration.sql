-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "merchantName" TEXT,
    "page" TEXT NOT NULL,
    "action" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "sessionId" TEXT NOT NULL,
    "isInternalUser" BOOLEAN NOT NULL DEFAULT false,
    "userType" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_merchantId_idx" ON "PageView"("merchantId");

-- CreateIndex
CREATE INDEX "PageView_page_idx" ON "PageView"("page");

-- CreateIndex
CREATE INDEX "PageView_timestamp_idx" ON "PageView"("timestamp");

-- CreateIndex
CREATE INDEX "PageView_sessionId_idx" ON "PageView"("sessionId");

-- CreateIndex
CREATE INDEX "PageView_isInternalUser_idx" ON "PageView"("isInternalUser");

-- CreateIndex
CREATE INDEX "PageView_userType_idx" ON "PageView"("userType");

