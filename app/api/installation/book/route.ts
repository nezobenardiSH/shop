import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth-utils'
import { trackEvent } from '@/lib/analytics'
import {
  getInstallerType,
  bookInternalInstallation,
  submitExternalInstallationRequest
} from '@/lib/installer-availability'
import { logServerError } from '@/lib/server-logger'

export async function POST(request: NextRequest) {
  // Parse body outside try block so it's accessible in catch for error logging
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const {
      merchantId,
      merchantName,
      onboardingTrainerName,  // The Salesforce Onboarding_Trainer__c.Name field
      date,
      timeSlot,
      availableInstallers,
      contactPhone,
      existingEventId,  // Event ID of existing booking to be cancelled (for rescheduling)
      selectedInstallerEmail,  // Internal user manually selected installer (optional)
      useExternalVendor  // Internal user explicitly chose external vendor (optional)
    } = body

    console.log('📥 Installation booking request:', {
      merchantId,
      merchantName,
      onboardingTrainerName,
      date,
      timeSlot,
      isRescheduling: !!existingEventId,
      existingEventId: existingEventId || 'NONE (new booking)',
      selectedInstallerEmail: selectedInstallerEmail || 'AUTO-ASSIGN',
      useExternalVendor: useExternalVendor || false
    })

    if (!merchantId || !merchantName || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get user info from auth token to track who booked the installation
    let isInternalUser = false
    let userType = 'merchant'
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    if (authToken) {
      const decoded = verifyToken(authToken)
      if (decoded) {
        isInternalUser = decoded.isInternalUser || false
        userType = decoded.userType || 'merchant'
      }
    }

    // Helper function to track analytics
    const trackInstallationAnalytics = async (installerType: 'internal' | 'external', extraMetadata: Record<string, any> = {}) => {
      try {
        const sessionId = request.headers.get('x-session-id') || `session_${Date.now()}`
        const userAgent = request.headers.get('user-agent') || ''
        const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
        const deviceType = userAgent.includes('Mobile') ? 'mobile' : 'desktop'

        await trackEvent({
          merchantId: merchantId,
          merchantName: onboardingTrainerName || merchantName,
          page: 'booking-installation',
          action: 'installation_scheduled',
          sessionId,
          userAgent,
          deviceType,
          ipAddress,
          isInternalUser,
          userType,
          metadata: {
            bookedBy: isInternalUser ? 'internal' : 'merchant',
            bookingType: 'installation',
            date: date,
            isRescheduling: !!existingEventId,
            installerType,
            ...extraMetadata
          }
        })
        console.log(`📊 Analytics: ${installerType} installation tracked`)
      } catch (analyticsError) {
        console.error('Failed to track installation analytics:', analyticsError)
      }
    }

    // Internal user explicitly chose external vendor - skip location validation
    if (useExternalVendor) {
      console.log('🔧 Internal user selected external vendor - skipping location validation')
      const preferredTime = timeSlot?.start || '09:00'

      const result = await submitExternalInstallationRequest(
        merchantId,
        onboardingTrainerName || merchantName,
        date,
        preferredTime,
        contactPhone || ''
      )

      await trackInstallationAnalytics('external', { preferredTime, internalOverride: true })

      return NextResponse.json({
        type: 'external',
        ...result
      })
    }

    // Internal user explicitly chose internal installer - skip location validation
    if (selectedInstallerEmail) {
      console.log('🔧 Internal user selected internal installer - skipping location validation')

      if (!timeSlot) {
        return NextResponse.json(
          { error: 'No time slot selected' },
          { status: 400 }
        )
      }

      const result = await bookInternalInstallation(
        merchantId,
        onboardingTrainerName || merchantName,
        date,
        timeSlot,
        availableInstallers || [],
        existingEventId,
        selectedInstallerEmail
      )

      await trackInstallationAnalytics('internal', {
        startTime: timeSlot.start,
        endTime: timeSlot.end,
        assignedInstaller: selectedInstallerEmail,
        internalOverride: true
      })

      return NextResponse.json({
        type: 'internal',
        ...result
      })
    }

    // Regular merchant flow - use location-based routing
    const installerType = await getInstallerType(merchantId)

    if (installerType === 'internal') {
      // Book with internal installer
      if (!timeSlot || !availableInstallers || availableInstallers.length === 0) {
        return NextResponse.json(
          { error: 'No installers available for selected slot' },
          { status: 400 }
        )
      }

      const result = await bookInternalInstallation(
        merchantId,
        onboardingTrainerName || merchantName,
        date,
        timeSlot,
        availableInstallers,
        existingEventId,
        undefined  // No manually selected installer for regular merchants
      )

      await trackInstallationAnalytics('internal', {
        startTime: timeSlot.start,
        endTime: timeSlot.end,
        assignedInstaller: availableInstallers[0]
      })

      return NextResponse.json({
        type: 'internal',
        ...result
      })
    } else {
      // Submit request for external vendor
      const preferredTime = timeSlot?.start || '09:00'

      const result = await submitExternalInstallationRequest(
        merchantId,
        onboardingTrainerName || merchantName,
        date,
        preferredTime,
        contactPhone || ''
      )

      await trackInstallationAnalytics('external', { preferredTime })

      return NextResponse.json({
        type: 'external',
        ...result
      })
    }
  } catch (error) {
    await logServerError(error, {
      route: '/api/installation/book',
      method: 'POST',
      merchantId: body?.merchantId,
      additionalInfo: {
        merchantName: body?.merchantName,
        date: body?.date,
        useExternalVendor: body?.useExternalVendor,
        errorType: 'Installation booking failed'
      }
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to book installation' },
      { status: 500 }
    )
  }
}