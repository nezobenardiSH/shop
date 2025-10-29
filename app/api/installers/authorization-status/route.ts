import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'
import installersConfig from '@/config/installers.json'

export async function GET(request: NextRequest) {
  try {
    // Get all configured internal installers
    const configuredInstallers = installersConfig.internal.installers.filter(i =>
      i.email && i.isActive
    )

    // Get authorized installers from database
    const authorizedInstallers = await larkOAuthService.getAuthorizedInstallers()
    const authorizedEmails = new Set(authorizedInstallers.map(i => i.email))

    // Combine information
    const installers = configuredInstallers.map(installer => {
      const authorized = authorizedEmails.has(installer.email)
      const authInfo = authorizedInstallers.find(i => i.email === installer.email)

      return {
        email: installer.email,
        name: installer.name,
        calendarId: authInfo?.calendarId || installer.larkCalendarId || 'primary',
        authorized
      }
    })

    // Also include any authorized installers not in config
    authorizedInstallers.forEach(authInstaller => {
      if (!configuredInstallers.find(i => i.email === authInstaller.email)) {
        installers.push(authInstaller)
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