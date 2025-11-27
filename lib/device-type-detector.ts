/**
 * Device Type Detector
 *
 * Determines whether a merchant needs Android or iOS installation
 * based on their order items and onboarding summary.
 *
 * Logic:
 * 1. Check order items - if POS device found → Android
 * 2. Check onboarding summary with keywords → Android/iOS
 * 3. Use Claude API for ambiguous cases
 * 4. Default to iOS (merchant has own iPad)
 */

// Non-POS items to exclude when detecting POS devices
// If a product name contains any of these keywords, it's NOT a POS device
const NON_POS_KEYWORDS = [
  // Printers
  'printer',
  'receipt',
  'kitchen printer',
  'thermal',

  // Cash handling
  'cash drawer',
  'drawer',
  'cash box',

  // Scanners
  'scanner',
  'barcode',
  'qr reader',

  // Displays (non-POS)
  'kitchen display',
  'kds',
  'customer display',

  // Marketing/Collateral
  'collateral',
  'marketing',
  'signage',
  'banner',
  'sticker',
  'poster',

  // Discounts/Promos
  'discount',
  'voucher',
  'promo',
  'coupon',
  'rebate',

  // Accessories
  'stand',
  'mount',
  'bracket',
  'cable',
  'charger',
  'adapter',
  'case',
  'cover',
  'screen protector',

  // Software/Services
  'subscription',
  'license',
  'service',
  'support',
  'training',
  'setup fee',
  'installation fee'
]

// Android device indicators in product names
const ANDROID_PRODUCT_KEYWORDS = [
  'sunmi',
  'android',
  'a920',
  'v2',
  't2',
  'd3',
  'p2',
  'imin'
]

// Keywords indicating Android in onboarding summary
const ANDROID_SUMMARY_KEYWORDS = [
  'android',
  'sunmi',
  'v2 pro',
  't2 mini',
  'd3 pro',
  'imin'
]

// Keywords indicating iOS in onboarding summary
const IOS_SUMMARY_KEYWORDS = [
  'ipad',
  'ios',
  'own device',
  'bring own',
  'merchant device',
  'merchant\'s device',
  'their own',
  'existing device',
  'byod'
]

export interface OrderItem {
  productName: string
  quantity?: number
}

export type DeviceType = 'android' | 'ios'

/**
 * Check if a product name is a POS device (not a peripheral/accessory)
 */
export function isPosDevice(productName: string): boolean {
  const lowerName = productName.toLowerCase()

  // First check if it's explicitly an Android device
  const isAndroidDevice = ANDROID_PRODUCT_KEYWORDS.some(keyword =>
    lowerName.includes(keyword.toLowerCase())
  )

  if (isAndroidDevice) {
    return true
  }

  // Check if it's a non-POS item (peripheral/accessory)
  const isNonPosItem = NON_POS_KEYWORDS.some(keyword =>
    lowerName.includes(keyword.toLowerCase())
  )

  // If it's not a known non-POS item, it might be a POS device
  // This catches unknown POS devices that aren't in our keyword list
  return !isNonPosItem
}

/**
 * Detect device type from order items
 * Returns 'android' if POS device found, null otherwise
 */
export function detectDeviceTypeFromOrder(orderItems: OrderItem[]): DeviceType | null {
  if (!orderItems || orderItems.length === 0) {
    return null
  }

  // Check each order item
  for (const item of orderItems) {
    if (!item.productName) continue

    const lowerName = item.productName.toLowerCase()

    // Check for explicit Android device keywords first
    const isExplicitAndroid = ANDROID_PRODUCT_KEYWORDS.some(keyword =>
      lowerName.includes(keyword.toLowerCase())
    )

    if (isExplicitAndroid) {
      console.log(`📱 Found Android device in order: ${item.productName}`)
      return 'android'
    }
  }

  // Check if there are any POS devices (items not matching non-POS keywords)
  const posDevices = orderItems.filter(item =>
    item.productName && isPosDevice(item.productName)
  )

  if (posDevices.length > 0) {
    // Found potential POS devices, but they're not explicitly Android
    // Log them for debugging
    console.log(`📱 Found potential POS devices (not explicitly Android):`,
      posDevices.map(d => d.productName)
    )
    // Since we only sell Android POS, assume these are Android
    return 'android'
  }

  // No POS devices found - only peripherals/accessories
  console.log(`📱 No POS devices in order - only peripherals/accessories`)
  return null
}

/**
 * Detect device type from onboarding summary using keywords
 * Returns device type if keywords found, null if unclear
 */
export function detectDeviceTypeFromSummaryKeywords(summary: string): DeviceType | null {
  if (!summary || summary.trim() === '') {
    return null
  }

  const lowerSummary = summary.toLowerCase()

  // Check for Android indicators
  const hasAndroidKeyword = ANDROID_SUMMARY_KEYWORDS.some(keyword =>
    lowerSummary.includes(keyword.toLowerCase())
  )

  if (hasAndroidKeyword) {
    console.log(`📱 Found Android keyword in summary`)
    return 'android'
  }

  // Check for iOS indicators
  const hasIosKeyword = IOS_SUMMARY_KEYWORDS.some(keyword =>
    lowerSummary.includes(keyword.toLowerCase())
  )

  if (hasIosKeyword) {
    console.log(`📱 Found iOS keyword in summary`)
    return 'ios'
  }

  return null
}

/**
 * Detect device type from onboarding summary using Claude API
 * This is the fallback when keywords don't provide a clear answer
 */
export async function detectDeviceTypeFromSummaryAI(summary: string): Promise<DeviceType | null> {
  if (!summary || summary.trim() === '') {
    return null
  }

  // For now, skip AI detection and return null
  // Can be implemented later with Anthropic API if needed
  console.log(`📱 AI detection not yet implemented, skipping`)
  return null
}

/**
 * Main function to get device type
 * Combines all detection methods with priority order
 */
export async function getDeviceType(
  orderItems: OrderItem[],
  onboardingSummary: string
): Promise<DeviceType> {
  console.log(`📱 Detecting device type...`)
  console.log(`   Order items: ${orderItems.length}`)
  console.log(`   Summary length: ${onboardingSummary?.length || 0} chars`)

  // Step 1: Check order items for POS devices
  const orderDeviceType = detectDeviceTypeFromOrder(orderItems)
  if (orderDeviceType) {
    console.log(`📱 Device type from order: ${orderDeviceType}`)
    return orderDeviceType
  }

  // Step 2: Check summary with keywords
  const keywordDeviceType = detectDeviceTypeFromSummaryKeywords(onboardingSummary)
  if (keywordDeviceType) {
    console.log(`📱 Device type from summary keywords: ${keywordDeviceType}`)
    return keywordDeviceType
  }

  // Step 3: Try AI detection (if implemented)
  const aiDeviceType = await detectDeviceTypeFromSummaryAI(onboardingSummary)
  if (aiDeviceType) {
    console.log(`📱 Device type from AI: ${aiDeviceType}`)
    return aiDeviceType
  }

  // Step 4: Default to iOS
  // If no POS device in order and no clear indicators in summary,
  // assume merchant has their own iOS device
  console.log(`📱 No clear device type detected, defaulting to iOS`)
  return 'ios'
}

/**
 * Get Surftek ServiceId based on device type
 */
export function getServiceId(deviceType: DeviceType): number {
  switch (deviceType) {
    case 'android':
      return 39 // Android Hardware Installation (On-site Deployment)
    case 'ios':
      return 1  // iOS Hardware Installation (On-site Deployment)
    default:
      return 1  // Default to iOS
  }
}
