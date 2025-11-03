import { NextRequest, NextResponse } from 'next/server'
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
      existingEventId  // Event ID of existing booking to be cancelled (for rescheduling)
    } = body

    console.log('📥 Installation booking request:', {
      merchantId,
      merchantName,
      onboardingTrainerName,
      date,
      timeSlot,
      isRescheduling: !!existingEventId,
      existingEventId: existingEventId || 'NONE (new booking)'
    })
    
    if (!merchantId || !merchantName || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
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
        merchantName,
        date,
        timeSlot,
        availableInstallers,
        existingEventId
      )
      
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