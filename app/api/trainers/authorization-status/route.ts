import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'
import trainersConfig from '@/config/trainers.json'

export async function GET(request: NextRequest) {
  try {
    // Get all configured trainers
    const configuredTrainers = trainersConfig.trainers.filter(t => 
      t.email && t.name !== 'Nasi Lemak' // Filter out test entries
    )
    
    // Get authorized trainers from database
    const authorizedTrainers = await larkOAuthService.getAuthorizedTrainers()
    const authorizedEmails = new Set(authorizedTrainers.map(t => t.email))
    
    // Combine information
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
    
    // Also include any authorized trainers not in config
    authorizedTrainers.forEach(authTrainer => {
      if (!configuredTrainers.find(t => t.email === authTrainer.email)) {
        trainers.push(authTrainer)
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