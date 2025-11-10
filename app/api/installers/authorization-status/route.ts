import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'
import { loadInstallersConfig } from '@/lib/config-loader'

export async function GET(request: NextRequest) {
  try {
    // Read installers config dynamically to pick up changes without restart
    const installersConfig = await loadInstallersConfig()

    // Get all configured internal installers from all locations
    const configuredInstallers: any[] = []
    for (const location of ['klangValley', 'penang', 'johorBahru']) {
      const locationConfig = (installersConfig as any)[location]
      if (locationConfig && locationConfig.installers) {
        configuredInstallers.push(...locationConfig.installers.filter((i: any) =>
          i.email && i.isActive
        ))
      }
    }

    // Get authorized installers from database
    const authorizedInstallers = await larkOAuthService.getAuthorizedInstallers()
    const authorizedEmails = new Set(authorizedInstallers.map(i => i.email))

    // Deduplicate installers by email (same installer may appear in multiple locations)
    const uniqueInstallersByEmail = new Map<string, any>()
    for (const installer of configuredInstallers) {
      if (!uniqueInstallersByEmail.has(installer.email)) {
        uniqueInstallersByEmail.set(installer.email, installer)
      }
    }

    // Combine information - ONLY show installers that are in config file
    const installers = Array.from(uniqueInstallersByEmail.values()).map(installer => {
      const authorized = authorizedEmails.has(installer.email)
      const authInfo = authorizedInstallers.find(i => i.email === installer.email)

      return {
        email: installer.email,
        name: installer.name,
        calendarId: authInfo?.calendarId || installer.larkCalendarId || 'primary',
        authorized
      }
    })

    return NextResponse.json({
      installers,
      totalConfigured: configuredInstallers.length,
      totalAuthorized: authorizedInstallers.length
    })

  } catch (error: any) {
    console.error('Failed to get installer authorization status:', error)
    return NextResponse.json(
      {
        error: 'Failed to get installer status',
        details: error.message
      },
      { status: 500 }
    )
  }
}