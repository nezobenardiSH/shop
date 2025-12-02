/**
 * Migration Script: Recompute Session IDs Based on 30-Minute Inactivity
 *
 * This script analyzes existing PageView records and splits sessions
 * when there's a gap of more than 30 minutes between page views.
 *
 * Usage:
 *   DATABASE_URL="your-prod-db-url" npx tsx scripts/migrate-sessions.ts --dry-run
 *   DATABASE_URL="your-prod-db-url" npx tsx scripts/migrate-sessions.ts
 *
 * Or set DATABASE_URL in your .env file to point to production database.
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { config } from 'dotenv'

// Load environment variables from .env file
config()

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.')
  console.error('Set it in .env or pass it inline:')
  console.error('  DATABASE_URL="postgresql://..." npx tsx scripts/migrate-sessions.ts --dry-run')
  process.exit(1)
}

const prisma = new PrismaClient()

// 30 minutes in milliseconds
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

interface PageViewRecord {
  id: string
  sessionId: string
  timestamp: Date
  merchantId: string | null
}

interface SessionSplit {
  originalSessionId: string
  pageViewIds: string[]
  newSessionId: string
  firstTimestamp: Date
  lastTimestamp: Date
  pageCount: number
}

function generateNewSessionId(): string {
  return crypto.randomBytes(16).toString('hex')
}

async function analyzeAndSplitSessions(dryRun: boolean): Promise<void> {
  console.log('='.repeat(60))
  console.log('Session Migration Script')
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`)
  console.log('='.repeat(60))
  console.log('')

  // Get all unique session IDs
  const uniqueSessions = await prisma.pageView.findMany({
    select: { sessionId: true },
    distinct: ['sessionId']
  })

  console.log(`Found ${uniqueSessions.length} unique sessions to analyze\n`)

  let totalOriginalSessions = 0
  let totalNewSessions = 0
  let totalPageViewsUpdated = 0
  const allSplits: SessionSplit[] = []

  for (const { sessionId } of uniqueSessions) {
    // Get all page views for this session, ordered by timestamp
    const pageViews = await prisma.pageView.findMany({
      where: { sessionId },
      select: {
        id: true,
        sessionId: true,
        timestamp: true,
        merchantId: true
      },
      orderBy: { timestamp: 'asc' }
    })

    if (pageViews.length === 0) continue

    totalOriginalSessions++

    // Split into new sessions based on 30-minute gaps
    const splits: SessionSplit[] = []
    let currentSplit: SessionSplit = {
      originalSessionId: sessionId,
      pageViewIds: [pageViews[0].id],
      newSessionId: generateNewSessionId(),
      firstTimestamp: pageViews[0].timestamp,
      lastTimestamp: pageViews[0].timestamp,
      pageCount: 1
    }

    for (let i = 1; i < pageViews.length; i++) {
      const currentView = pageViews[i]
      const previousView = pageViews[i - 1]
      const gap = currentView.timestamp.getTime() - previousView.timestamp.getTime()

      if (gap > SESSION_TIMEOUT_MS) {
        // Gap exceeds 30 minutes - start a new session
        splits.push(currentSplit)
        currentSplit = {
          originalSessionId: sessionId,
          pageViewIds: [currentView.id],
          newSessionId: generateNewSessionId(),
          firstTimestamp: currentView.timestamp,
          lastTimestamp: currentView.timestamp,
          pageCount: 1
        }
      } else {
        // Continue current session
        currentSplit.pageViewIds.push(currentView.id)
        currentSplit.lastTimestamp = currentView.timestamp
        currentSplit.pageCount++
      }
    }

    // Don't forget the last split
    splits.push(currentSplit)

    // Only track if the session was actually split
    if (splits.length > 1) {
      allSplits.push(...splits)
      totalNewSessions += splits.length
      totalPageViewsUpdated += pageViews.length

      console.log(`Session ${sessionId.substring(0, 8)}... split into ${splits.length} sessions:`)
      for (const split of splits) {
        const duration = split.lastTimestamp.getTime() - split.firstTimestamp.getTime()
        const durationMin = Math.round(duration / 60000)
        console.log(`  → ${split.newSessionId.substring(0, 8)}... (${split.pageCount} pages, ${durationMin} min)`)
      }
    } else {
      totalNewSessions++
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`Original sessions: ${totalOriginalSessions}`)
  console.log(`Sessions after split: ${totalNewSessions}`)
  console.log(`Sessions that were split: ${allSplits.length > 0 ? allSplits.filter((s, i, arr) =>
    i === 0 || arr[i - 1].originalSessionId !== s.originalSessionId
  ).length : 0}`)
  console.log(`Page views to update: ${totalPageViewsUpdated}`)
  console.log('')

  if (dryRun) {
    console.log('DRY RUN complete. No changes were made.')
    console.log('Run without --dry-run to apply changes.')
  } else if (allSplits.length > 0) {
    console.log('Applying changes...')

    let updatedCount = 0
    for (const split of allSplits) {
      await prisma.pageView.updateMany({
        where: {
          id: { in: split.pageViewIds }
        },
        data: {
          sessionId: split.newSessionId
        }
      })
      updatedCount += split.pageViewIds.length

      // Progress indicator
      if (updatedCount % 100 === 0) {
        console.log(`  Updated ${updatedCount}/${totalPageViewsUpdated} page views...`)
      }
    }

    console.log('')
    console.log(`Migration complete! Updated ${updatedCount} page views.`)
  } else {
    console.log('No sessions needed splitting. All sessions are already correct.')
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  try {
    await analyzeAndSplitSessions(dryRun)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
