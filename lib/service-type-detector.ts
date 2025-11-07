/**
 * Service Type Detector
 * Determines training service type (onsite/remote) from Salesforce onboarding services field
 */

export type ServiceType = 'onsite' | 'remote' | 'none'

/**
 * Detect service type from Onboarding Services Bought field
 * @param onboardingServicesBought - Value from Salesforce Onboarding_Services_Bought__c field
 * @returns 'onsite' | 'remote' | 'none'
 */
export function detectServiceType(onboardingServicesBought: string | null | undefined): ServiceType {
  if (!onboardingServicesBought) {
    return 'none'
  }
  
  const service = onboardingServicesBought.toLowerCase().trim()
  
  // Check for onsite training
  if (service.includes('onsite')) {
    return 'onsite'
  }
  
  // Check for remote/online training
  if (service.includes('remote') || service.includes('online')) {
    return 'remote'
  }
  
  // Unknown or unrecognized service type
  return 'none'
}

/**
 * Get display message for service type
 * @param serviceType - The detected service type
 * @param state - Optional state/location for onsite training
 * @returns User-friendly message
 */
export function getServiceTypeMessage(serviceType: ServiceType, state?: string): string {
  switch (serviceType) {
    case 'onsite':
      return state ? `Training: Onsite, ${state}` : 'Training: Onsite'
    case 'remote':
      return 'Training: Remote'
    case 'none':
      return 'Service type not set - booking will be treated as remote training'
  }
}

/**
 * Check if location filtering should be applied
 * @param serviceType - The detected service type
 * @param bookingType - The type of booking (training, installation, etc.)
 * @returns true if location filtering should be applied
 */
export function shouldFilterByLocation(
  serviceType: ServiceType,
  bookingType?: string
): boolean {
  // Only apply location filtering for training bookings
  const isTraining = bookingType === 'training'

  if (!isTraining) {
    return false
  }

  // ALWAYS apply location filtering for training bookings
  // This ensures trainers are matched to the correct regions
  // (e.g., Penang trainers only for Penang merchants)
  return true
}

/**
 * Check if service type allows booking
 * @param serviceType - The detected service type
 * @returns true if booking is allowed
 */
export function canBook(serviceType: ServiceType): boolean {
  // Allow booking even if service type is 'none'
  // The merchant can still book training, just show a warning
  return true
}

/**
 * Get button text based on service type
 * @param serviceType - The detected service type
 * @param bookingType - The type of booking
 * @returns Button text
 */
export function getBookingButtonText(
  serviceType: ServiceType,
  bookingType?: string
): string {
  if (serviceType === 'none') {
    return 'Schedule Training (Contact Support)'
  }
  
  return 'Schedule Training'
}

