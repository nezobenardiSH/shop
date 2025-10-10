import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import trainersConfig from '@/config/trainers.json'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting calendar sync...')
    
    const results = []
    let updatedCount = 0
    let failedCount = 0
    
    // Process each trainer
    for (const trainer of trainersConfig.trainers) {
      if (!trainer.email) {
        results.push({
          name: trainer.name,
          status: 'skipped',
          reason: 'No email configured'
        })
        continue
      }
      
      // Skip test/merchant entries
      if (trainer.name === 'Nasi Lemak' || trainer.email.includes('test')) {
        results.push({
          name: trainer.name,
          status: 'skipped',
          reason: 'Test/merchant account'
        })
        continue
      }
      
      try {
        // Fetch primary calendar ID
        const calendarId = await larkService.getPrimaryCalendarId(trainer.email)
        
        if (calendarId && calendarId !== 'primary') {
          trainer.calendarId = calendarId
          updatedCount++
          
          results.push({
            name: trainer.name,
            email: trainer.email,
            calendarId: calendarId,
            status: 'success'
          })
        } else {
          trainer.calendarId = 'primary'
          results.push({
            name: trainer.name,
            email: trainer.email,
            calendarId: 'primary',
            status: 'fallback'
          })
        }
        
        // Also try to get Lark user ID
        try {
          const user = await larkService.getUserByEmail(trainer.email)
          if (user && user.user_id !== trainer.email) {
            trainer.larkUserId = user.user_id
          }
        } catch (userError) {
          console.log(`Could not fetch user ID for ${trainer.name}`)
        }
        
      } catch (error: any) {
        failedCount++
        results.push({
          name: trainer.name,
          email: trainer.email,
          error: error.message,
          status: 'failed'
        })
      }
    }
    
    // Save the updated configuration
    if (updatedCount > 0) {
      const configPath = path.join(process.cwd(), 'config', 'trainers.json')
      await fs.writeFile(
        configPath,
        JSON.stringify(trainersConfig, null, 2)
      )
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        updated: updatedCount,
        failed: failedCount,
        total: trainersConfig.trainers.length
      },
      results
    })
    
  } catch (error: any) {
    console.error('Error syncing calendars:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync calendars',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return current configuration
  return NextResponse.json({
    trainers: trainersConfig.trainers.map(t => ({
      name: t.name,
      email: t.email,
      calendarId: t.calendarId,
      larkUserId: t.larkUserId
    }))
  })
}