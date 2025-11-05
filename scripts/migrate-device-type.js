const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function runMigration() {
  console.log('🚀 Starting deviceType migration...')
  
  try {
    // Add deviceType column
    console.log('📝 Adding deviceType column to PageView table...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "PageView" 
      ADD COLUMN IF NOT EXISTS "deviceType" TEXT
    `)
    console.log('✅ Column added successfully')

    // Create index
    console.log('📝 Creating index on deviceType...')
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "PageView_deviceType_idx" 
      ON "PageView"("deviceType")
    `)
    console.log('✅ Index created successfully')

    // Update existing records
    console.log('📝 Updating existing records with device types...')
    const result = await prisma.$executeRawUnsafe(`
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
      WHERE "deviceType" IS NULL AND "userAgent" IS NOT NULL
    `)
    console.log(`✅ Updated ${result} existing records`)

    console.log('🎉 Migration completed successfully!')
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Column already exists, skipping migration')
    } else {
      console.error('❌ Migration failed:', error.message)
      process.exit(1)
    }
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()