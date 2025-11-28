import { NextResponse } from 'next/server'
import installersConfig from '@/config/installers.json'

/**
 * GET /api/installers/list
 * Returns the list of all internal installers for internal user manual selection
 */
export async function GET() {
  try {
    // Collect all internal installers from all regions
    const installers: Array<{ name: string; email: string; region: string }> = []

    // Klang Valley installers
    if (installersConfig.klangValley?.installers) {
      installersConfig.klangValley.installers
        .filter(installer => installer.isActive)
        .forEach(installer => {
          installers.push({
            name: installer.name,
            email: installer.email,
            region: 'Klang Valley'
          })
        })
    }

    // Penang installers
    if (installersConfig.penang?.installers) {
      installersConfig.penang.installers
        .filter(installer => installer.isActive)
        .forEach(installer => {
          installers.push({
            name: installer.name,
            email: installer.email,
            region: 'Penang'
          })
        })
    }

    // Johor Bahru installers
    if (installersConfig.johorBahru?.installers) {
      installersConfig.johorBahru.installers
        .filter(installer => installer.isActive)
        .forEach(installer => {
          installers.push({
            name: installer.name,
            email: installer.email,
            region: 'Johor Bahru'
          })
        })
    }

    return NextResponse.json({
      success: true,
      installers
    })
  } catch (error) {
    console.error('Error fetching installers list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch installers list' },
      { status: 500 }
    )
  }
}
