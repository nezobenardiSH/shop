-- Add deviceType column to PageView table
ALTER TABLE "PageView" 
ADD COLUMN IF NOT EXISTS "deviceType" TEXT;

-- Create index on deviceType for better query performance
CREATE INDEX IF NOT EXISTS "PageView_deviceType_idx" ON "PageView"("deviceType");

-- Update existing rows to have a default deviceType based on userAgent
-- This is optional but helps categorize existing data
UPDATE "PageView" 
SET "deviceType" = 
  CASE 
    WHEN "userAgent" ILIKE '%mobile%' OR 
         "userAgent" ILIKE '%android%' OR 
         "userAgent" ILIKE '%iphone%' OR 
         "userAgent" ILIKE '%ipod%' OR
         "userAgent" ILIKE '%blackberry%' OR
         "userAgent" ILIKE '%windows phone%' OR
         "userAgent" ILIKE '%opera mini%' OR
         "userAgent" ILIKE '%opera mobi%'
    THEN 'mobile'
    
    WHEN "userAgent" ILIKE '%ipad%' OR 
         "userAgent" ILIKE '%tablet%' OR 
         "userAgent" ILIKE '%kindle%' OR
         "userAgent" ILIKE '%silk%'
    THEN 'tablet'
    
    ELSE 'desktop'
  END
WHERE "deviceType" IS NULL AND "userAgent" IS NOT NULL;