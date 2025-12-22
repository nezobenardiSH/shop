import { NextResponse } from 'next/server'
import { loadTrainersConfig } from '@/lib/config-loader'

/**
 * GET /api/trainers/list
 * Returns the list of all trainers for internal user manual selection
 */
export async function GET() {
  try {
    // Load trainers from database
    const trainersConfig = await loadTrainersConfig()

    const trainers = trainersConfig.trainers.map(trainer => ({
      name: trainer.name,
      email: trainer.email,
      languages: trainer.languages,
      location: trainer.location
    }))

    return NextResponse.json({
      success: true,
      trainers
    })
  } catch (error) {
    console.error('Error fetching trainers list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trainers list' },
      { status: 500 }
    )
  }
}
