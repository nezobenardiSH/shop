import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'
import fs from 'fs/promises'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    // Read trainers config dynamically to pick up changes without restart
    const configPath = path.join(process.cwd(), 'config', 'trainers.json')
    const configContent = await fs.readFile(configPath, 'utf-8')
    const trainersConfig = JSON.parse(configContent)

    // Get all configured trainers
    const configuredTrainers = trainersConfig.trainers.filter((t: any) =>
      t.email && t.name !== 'Nasi Lemak' // Filter out test entries
    )
    
    // Get authorized trainers from database
    const authorizedTrainers = await larkOAuthService.getAuthorizedTrainers()
    const authorizedEmails = new Set(authorizedTrainers.map(t => t.email))
    
    // Combine information - ONLY show trainers that are in config file
    const trainers = configuredTrainers.map(trainer => {
      const authorized = authorizedEmails.has(trainer.email)
      const authInfo = authorizedTrainers.find(t => t.email === trainer.email)

      return {
        email: trainer.email,
        name: trainer.name,
        calendarId: authInfo?.calendarId || trainer.calendarId || 'primary',
        authorized
      }
    })

    return NextResponse.json({
      trainers,
      totalConfigured: configuredTrainers.length,
      totalAuthorized: authorizedTrainers.length
    })
    
  } catch (error: any) {
    console.error('Failed to get authorization status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get trainer status',
        details: error.message 
      },
      { status: 500 }
    )
  }
}