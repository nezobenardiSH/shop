/**
 * One-time migration script to update scopes for existing trainers
 * Run with: npx ts-node scripts/update-trainer-scopes.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NEW_SCOPES = 'calendar:calendar calendar:calendar.event:create calendar:calendar.event:read calendar:calendar.event:update calendar:calendar.event:delete calendar:calendar.free_busy:read bitable:app vc:reserve vc:reserve:readonly'

async function updateScopes() {
  console.log('Starting scope update for all trainers...')

  try {
    // Get all trainer tokens
    const trainers = await prisma.larkAuthToken.findMany({
      where: {
        OR: [
          { userType: 'trainer' },
          { userType: null }  // Include legacy records
        ]
      }
    })

    console.log(`Found ${trainers.length} trainer(s) to update`)

    let updatedCount = 0
    for (const trainer of trainers) {
      // Check if already has VC scopes
      if (trainer.scopes?.includes('vc:reserve')) {
        console.log(`✓ ${trainer.userEmail} already has VC scopes - skipping`)
        continue
      }

      // Update scopes
      await prisma.larkAuthToken.update({
        where: { userEmail: trainer.userEmail },
        data: { scopes: NEW_SCOPES }
      })

      console.log(`✓ Updated scopes for ${trainer.userEmail}`)
      updatedCount++
    }

    console.log(`\n✅ Successfully updated ${updatedCount} trainer(s)`)
  } catch (error) {
    console.error('❌ Error updating scopes:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateScopes()
