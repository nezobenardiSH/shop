import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NEW_SCOPES = 'calendar:calendar calendar:calendar.event:create calendar:calendar.event:read calendar:calendar.event:update calendar:calendar.event:delete calendar:calendar.free_busy:read bitable:app vc:reserve vc:reserve:readonly'

export async function POST() {
  try {
    console.log('Starting scope update for all trainers...')

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
    const results = []

    for (const trainer of trainers) {
      // Check if already has VC scopes
      if (trainer.scopes?.includes('vc:reserve')) {
        console.log(`✓ ${trainer.userEmail} already has VC scopes - skipping`)
        results.push({
          email: trainer.userEmail,
          status: 'skipped',
          reason: 'Already has VC scopes'
        })
        continue
      }

      // Update scopes
      await prisma.larkAuthToken.update({
        where: { userEmail: trainer.userEmail },
        data: { scopes: NEW_SCOPES }
      })

      console.log(`✓ Updated scopes for ${trainer.userEmail}`)
      updatedCount++
      results.push({
        email: trainer.userEmail,
        status: 'updated',
        newScopes: NEW_SCOPES
      })
    }

    return NextResponse.json({
      success: true,
      totalFound: trainers.length,
      updated: updatedCount,
      results
    })
  } catch (error: any) {
    console.error('❌ Error updating scopes:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
