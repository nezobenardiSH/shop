import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth-utils'
import { trackEvent } from '@/lib/analytics'
import {
  getInstallerType,
  bookInternalInstallation,
  submitExternalInstallationRequest
} from '@/lib/installer-availability'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      merchantId,
      merchantName,
      onboardingTrainerName,  // The Salesforce Onboarding_Trainer__c.Name field
      date,
      timeSlot,
      availableInstallers,
      contactPhone,
      existingEventId,  // Event ID of existing booking to be cancelled (for rescheduling)
      selectedInstallerEmail  // Internal user manually selected installer (optional)
    } = body

    console.log('📥 Installation booking request:', {
      merchantId,
      merchantName,
      onboardingTrainerName,
      date,
      timeSlot,
      isRescheduling: !!existingEventId,
      existingEventId: existingEventId || 'NONE (new booking)',
      selectedInstallerEmail: selectedInstallerEmail || 'AUTO-ASSIGN'
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

    // Check installer type
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
        onboardingTrainerName || merchantName,  // Use Onboarding Trainer Name (e.g., "activate175")
        date,
        timeSlot,
        availableInstallers,
        existingEventId,
        selectedInstallerEmail  // Pass manually selected installer if provided by internal user
      )

      // Track analytics event for installation scheduling
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
            startTime: timeSlot.start,
            endTime: timeSlot.end,
            assignedInstaller: availableInstallers[0],
            isRescheduling: !!existingEventId,
            installerType: 'internal'
          }
        })
        console.log(`📊 Analytics: installation scheduling tracked`)
      } catch (analyticsError) {
        console.error('Failed to track installation analytics:', analyticsError)
        // Don't fail the request if analytics tracking fails
      }

      return NextResponse.json({
        type: 'internal',
        ...result
      })
    } else {
      // Submit request for external vendor
      // Use the actual time (e.g., "14:00") not the label for Salesforce update
      // timeSlot has 'start' property, not 'time' property
      const preferredTime = timeSlot?.start || '09:00' // Default to 9 AM if no time provided

      const result = await submitExternalInstallationRequest(
        merchantId,
        onboardingTrainerName || merchantName,  // Use Onboarding Trainer Name if available
        date,
        preferredTime,
        contactPhone || ''
      )

      // Track analytics event for external installation request
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
            preferredTime: preferredTime,
            isRescheduling: false,
            installerType: 'external'
          }
        })
        console.log(`📊 Analytics: external installation request tracked`)
      } catch (analyticsError) {
        console.error('Failed to track installation analytics:', analyticsError)
        // Don't fail the request if analytics tracking fails
      }

      return NextResponse.json({
        type: 'external',
        ...result
      })
    }
  } catch (error) {
    console.error('Error booking installation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to book installation' },
      { status: 500 }
    )
  }
}