import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'
import { loadTrainersConfig } from '@/lib/config-loader'

export async function GET(request: NextRequest) {
  try {
    // Read trainers config dynamically to pick up changes without restart
    const trainersConfig = await loadTrainersConfig()

    // Get all configured trainers
    const configuredTrainers = trainersConfig.trainers.filter((t: any) =>
      t.email && t.name !== 'Nasi Lemak' // Filter out test entries
    )
    
    // Get authorized trainers from database
    const authorizedTrainers = await larkOAuthService.getAuthorizedTrainers()
    const authorizedEmails = new Set(authorizedTrainers.map(t => t.email))
    
    // Combine information - ONLY show trainers that are in config file
    const trainers = configuredTrainers.map((trainer: any) => {
      const authorized = authorizedEmails.has(trainer.email)
      const authInfo = authorizedTrainers.find((t: any) => t.email === trainer.email)

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