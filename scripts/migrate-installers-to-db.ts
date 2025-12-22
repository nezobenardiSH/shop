/**
 * Migration Script: Move Installers from JSON to Database
 *
 * This script reads installers from config/installers.json and inserts them
 * into the LarkAuthToken table with userType='installer'.
 *
 * Run with: npx ts-node scripts/migrate-installers-to-db.ts
 * Or: npx tsx scripts/migrate-installers-to-db.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface Installer {
  name: string
  email: string
  larkCalendarId?: string
  isActive: boolean
}

interface InstallersConfig {
  klangValley: {
    locationValue: string
    installers: Installer[]
  }
  penang: {
    locationValue: string
    installers: Installer[]
  }
  johorBahru: {
    locationValue: string
    installers: Installer[]
  }
  external?: any // Skip external vendors
  settings?: any // Skip settings
}

async function migrateInstallers() {
  console.log('🚀 Starting installer migration to database...\n')

  // Read the installers.json file
  const configPath = path.join(process.cwd(), 'config', 'installers.json')
  const configContent = fs.readFileSync(configPath, 'utf-8')
  const config: InstallersConfig = JSON.parse(configContent)

  const regions = ['klangValley', 'penang', 'johorBahru'] as const
  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const region of regions) {
    const regionConfig = config[region]
    if (!regionConfig || !regionConfig.installers) {
      console.log(`⚠️ No installers found for region: ${region}`)
      continue
    }

    const locationValue = regionConfig.locationValue
    console.log(`\n📍 Processing ${region} (${locationValue})...`)

    for (const installer of regionConfig.installers) {
      try {
        // Check if installer already exists in database
        const existing = await prisma.larkAuthToken.findUnique({
          where: { userEmail: installer.email }
        })

        if (existing) {
          console.log(`  ⏭️ Skipping ${installer.name} (${installer.email}) - already exists in DB`)
          skipCount++
          continue
        }

        // Create new installer record
        await prisma.larkAuthToken.create({
          data: {
            userEmail: installer.email,
            userName: installer.name,
            userType: 'installer',
            location: JSON.stringify([locationValue]),
            calendarId: installer.larkCalendarId || null,
            isActive: installer.isActive,
            // OAuth fields are null - installer needs to authorize later
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            scopes: null,
            languages: null
          }
        })

        console.log(`  ✅ Migrated ${installer.name} (${installer.email})`)
        successCount++

      } catch (error) {
        console.error(`  ❌ Failed to migrate ${installer.name}:`, error)
        errorCount++
      }
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Migration Summary:')
  console.log(`  ✅ Successfully migrated: ${successCount}`)
  console.log(`  ⏭️ Skipped (already exists): ${skipCount}`)
  console.log(`  ❌ Errors: ${errorCount}`)
  console.log('='.repeat(50))

  // List all installers in database
  console.log('\n📋 Current installers in database:')
  const allInstallers = await prisma.larkAuthToken.findMany({
    where: { userType: 'installer' },
    select: {
      userName: true,
      userEmail: true,
      location: true,
      isActive: true,
      accessToken: true
    }
  })

  for (const inst of allInstallers) {
    const location = inst.location ? JSON.parse(inst.location)[0] : 'Unknown'
    const authorized = inst.accessToken ? '🔑' : '⚪'
    const active = inst.isActive ? '✅' : '❌'
    console.log(`  ${authorized} ${active} ${inst.userName} (${inst.userEmail}) - ${location}`)
  }

  console.log(`\nTotal installers in DB: ${allInstallers.length}`)
}

async function main() {
  try {
    await migrateInstallers()
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
