-- Manual migration script to create PageView table
-- Run this in Render's database console if automatic migration fails

-- Check if table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'PageView') THEN
        -- Create PageView table
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

        -- Create indexes
        CREATE INDEX "PageView_merchantId_idx" ON "PageView"("merchantId");
        CREATE INDEX "PageView_page_idx" ON "PageView"("page");
        CREATE INDEX "PageView_timestamp_idx" ON "PageView"("timestamp");
        CREATE INDEX "PageView_sessionId_idx" ON "PageView"("sessionId");
        CREATE INDEX "PageView_isInternalUser_idx" ON "PageView"("isInternalUser");
        CREATE INDEX "PageView_userType_idx" ON "PageView"("userType");

        -- Record migration in _prisma_migrations table
        INSERT INTO "_prisma_migrations" (
            "id",
            "checksum",
            "finished_at",
            "migration_name",
            "logs",
            "rolled_back_at",
            "started_at",
            "applied_steps_count"
        ) VALUES (
            gen_random_uuid()::text,
            'manual_migration',
            NOW(),
            '20251105151612_add_analytics_tracking',
            NULL,
            NULL,
            NOW(),
            1
        );

        RAISE NOTICE 'PageView table created successfully';
    ELSE
        RAISE NOTICE 'PageView table already exists';
    END IF;
END $$;

