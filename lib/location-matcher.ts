/**
 * Location Matcher Utility
 * Extracts state/location from merchant address and matches with trainer locations
 */

// Malaysian states and common variations
const MALAYSIAN_STATES = {
  'Kuala Lumpur': ['kuala lumpur', 'kl', 'k.l', 'wilayah persekutuan kuala lumpur', 'wp kuala lumpur'],
  'Selangor': ['selangor', 'sel', 'selangor darul ehsan', 'petaling jaya', 'pj', 'subang', 'shah alam', 'klang', 'puchong', 'ampang', 'cheras'],
  // Penang state and its districts/suburbs (covers entire Penang island and mainland)
  'Penang': [
    'penang', 'pulau pinang', 'p. pinang', 'pg', 'pn',
    // Penang Island (North East District)
    'georgetown', 'george town', 'jelutong', 'air itam', 'tanjung tokong',
    'tanjung bungah', 'batu ferringhi', 'teluk bahang', 'pulau tikus',
    'gurney drive', 'komtar', 'weld quay',
    // Penang Island (South West District)
    'bayan lepas', 'bayan baru', 'balik pulau', 'relau', 'sungai ara',
    'teluk kumbar', 'batu maung', 'permatang damar laut', 'gertak sanggul',
    // Seberang Perai (Mainland)
    'butterworth', 'perai', 'seberang jaya', 'seberang perai', 'bukit mertajam',
    'nibong tebal', 'kepala batas', 'tasek gelugor', 'alma', 'bagan ajam',
    'bukit tengah', 'juru', 'simpang ampat', 'permatang pauh', 'seberang prai',
    'penaga', 'bertam', 'valdor', 'bagan lalang', 'mak mandin'
  ],
  // Johor Bahru city and its suburbs/districts (covers Greater JB area)
  'Johor Bahru': [
    'johor bahru', 'jb', 'j.b',
    // JB districts and suburbs
    'skudai', 'iskandar puteri', 'nusajaya', 'gelang patah', 'kulai',
    'pasir gudang', 'masai', 'senai', 'ulu tiram', 'permas jaya',
    'tampoi', 'larkin', 'bukit indah', 'tebrau', 'desa tebrau',
    'mount austin', 'taman molek', 'taman johor jaya', 'kempas',
    'plentong', 'taman universiti', 'kangkar pulai', 'taman daya',
    'taman pelangi', 'taman sutera', 'medini', 'puteri harbour',
    'bandar dato onn', 'setia tropika', 'kota masai', 'taman perling',
    'taman bukit dahlia', 'taman sentosa', 'stulang', 'pontian'
  ],
  // Johor state (other cities not covered by JB installer)
  'Johor': ['johor', 'johor darul takzim', 'muar', 'batu pahat', 'kluang', 'segamat', 'mersing', 'kota tinggi', 'tangkak'],
  'Perak': ['perak', 'perak darul ridzuan', 'ipoh'],
  'Kedah': ['kedah', 'kedah darul aman', 'alor setar'],
  'Kelantan': ['kelantan', 'kelantan darul naim', 'kota bharu'],
  'Terengganu': ['terengganu', 'terengganu darul iman', 'kuala terengganu'],
  'Pahang': ['pahang', 'pahang darul makmur', 'kuantan'],
  'Negeri Sembilan': ['negeri sembilan', 'n. sembilan', 'ns', 'negeri sembilan darul khusus', 'seremban'],
  'Melaka': ['melaka', 'malacca', 'melaka bandaraya bersejarah'],
  'Sabah': ['sabah', 'sabah negeri di bawah bayu', 'kota kinabalu'],
  'Sarawak': ['sarawak', 'sarawak bumi kenyalang', 'kuching'],
  'Perlis': ['perlis', 'perlis indera kayangan', 'kangar'],
  'Putrajaya': ['putrajaya', 'wilayah persekutuan putrajaya', 'wp putrajaya'],
  'Labuan': ['labuan', 'wilayah persekutuan labuan', 'wp labuan']
}

// States that are considered within Klang Valley
const KLANG_VALLEY_STATES = ['Kuala Lumpur', 'Selangor', 'Putrajaya']

// States that are considered East Malaysia
const EAST_MALAYSIA_STATES = ['Sabah', 'Sarawak', 'Labuan']

// Malaysian states for dropdown selection (matching Salesforce picklist values)
export const MALAYSIAN_STATE_OPTIONS = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Labuan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Penang',
  'Perak',
  'Perlis',
  'Putrajaya',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu'
]

/**
 * Get location category from state name (for display/warning purposes)
 * Used to show warnings when merchant state changes to a different region
 * @param state - State name from dropdown (e.g., "Selangor", "Penang")
 * @returns Location category string
 */
export function getLocationCategoryFromStateName(state: string | null | undefined): string {
  if (!state) return 'Unknown'

  const klangValleyStates = ['Kuala Lumpur', 'Selangor', 'Putrajaya']
  const penangStates = ['Penang']
  const johorStates = ['Johor']

  if (klangValleyStates.includes(state)) return 'Within Klang Valley'
  if (penangStates.includes(state)) return 'Penang'
  if (johorStates.includes(state)) return 'Johor'
  return 'Outside Klang Valley'
}

/**
 * Extract state/location from address string
 * @param address - Full address string
 * @returns Array of matched states (can be multiple if address mentions multiple states)
 */
export function extractLocationFromAddress(address: string | null | undefined): string[] {
  if (!address) return []

  const normalizedAddress = address.toLowerCase().trim()
  const matchedStates: string[] = []

  // Check each state and its variations
  // Sort by variation length (longest first) to prioritize more specific matches
  for (const [state, variations] of Object.entries(MALAYSIAN_STATES)) {
    const sortedVariations = [...variations].sort((a, b) => b.length - a.length)

    for (const variation of sortedVariations) {
      // Use word boundary matching to avoid false positives
      // e.g., "klang" should not match "kluang"
      const regex = new RegExp(`\\b${variation}\\b`, 'i')

      if (regex.test(normalizedAddress)) {
        matchedStates.push(state)
        break // Found this state, move to next state
      }
    }
  }

  return matchedStates
}

/**
 * Determine if an address is within Klang Valley
 * @param address - Full address string
 * @returns true if the address is within Klang Valley, false otherwise
 */
export function isWithinKlangValley(address: string | null | undefined): boolean {
  if (!address) return false
  
  const matchedStates = extractLocationFromAddress(address)
  
  // Check if any of the matched states are within Klang Valley
  return matchedStates.some(state => KLANG_VALLEY_STATES.includes(state))
}

/**
 * Determine the location category for trainer assignment
 * @param address - Full address string
 * @returns "Within Klang Valley", "Penang", "Johor Bahru", or "Outside of Klang Valley"
 */
export function getLocationCategory(address: string | null | undefined): string {
  if (!address) return 'Within Klang Valley' // Default to Klang Valley if no address

  const matchedStates = extractLocationFromAddress(address)

  if (matchedStates.length === 0) {
    return 'Within Klang Valley' // Default if no state detected
  }

  // Check if within Klang Valley
  if (matchedStates.some(state => KLANG_VALLEY_STATES.includes(state))) {
    return 'Within Klang Valley'
  }

  // Check specific states outside Klang Valley
  if (matchedStates.includes('Penang')) {
    return 'Penang'
  }

  // Check for Johor Bahru specifically (must check before general Johor)
  if (matchedStates.includes('Johor Bahru')) {
    return 'Johor Bahru'
  }

  // All other states (including Johor state but not JB) are considered "Outside of Klang Valley"
  return 'Outside of Klang Valley'
}

/**
 * Check if trainer location matches merchant location
 * @param trainerLocations - Array of locations trainer covers (from trainers.json)
 * @param merchantAddress - Merchant's full address
 * @returns true if there's a match, false otherwise
 */
export function isLocationMatch(
  trainerLocations: string[] | undefined,
  merchantAddress: string | null | undefined
): boolean {
  if (!trainerLocations || trainerLocations.length === 0) {
    // If trainer has no location restrictions, they can serve anywhere
    console.log('✅ Trainer has no location restrictions - can serve anywhere')
    return true
  }
  
  if (!merchantAddress) {
    // If merchant has no address, check if trainer serves "Within Klang Valley" (default)
    const canServe = trainerLocations.includes('Within Klang Valley')
    console.log(`📍 No merchant address provided. Trainer serves [${trainerLocations.join(', ')}]. Can serve: ${canServe}`)
    return canServe
  }
  
  // Get the location category for the merchant
  const merchantLocationCategory = getLocationCategory(merchantAddress)
  
  // Check if trainer serves this location category
  const canServe = trainerLocations.includes(merchantLocationCategory)
  
  console.log(`📍 Location match check:
    - Merchant address: "${merchantAddress}"
    - Detected location: "${merchantLocationCategory}"
    - Trainer locations: [${trainerLocations.join(', ')}]
    - Match: ${canServe ? '✅ YES' : '❌ NO'}`)
  
  return canServe
}

/**
 * Get display name for location
 * @param location - Location string
 * @returns Formatted display name
 */
export function getLocationDisplayName(location: string): string {
  return location
}

/**
 * Convert merchant state to location category for trainer assignment
 * @param merchantState - State name (e.g., "Selangor", "Penang", "Johor")
 * @returns Location category ("Within Klang Valley", "Penang", "Johor Bahru", or "Outside of Klang Valley")
 */
export function getLocationCategoryFromState(merchantState: string | null | undefined): string {
  if (!merchantState) return 'Within Klang Valley' // Default to Klang Valley if no state

  const normalizedState = merchantState.toLowerCase().trim()

  // Check if state is within Klang Valley
  const klangValleyStates = ['kuala lumpur', 'kl', 'selangor', 'sel', 'putrajaya']
  if (klangValleyStates.some(state => normalizedState.includes(state))) {
    return 'Within Klang Valley'
  }

  // Check for Penang
  const penangStates = ['penang', 'pulau pinang', 'pg', 'pn']
  if (penangStates.some(state => normalizedState.includes(state))) {
    return 'Penang'
  }

  // Check for Johor Bahru specifically (including suburbs)
  const johorBahruAreas = [
    'johor bahru', 'jb', 'j.b',
    'skudai', 'iskandar puteri', 'nusajaya', 'gelang patah', 'kulai',
    'pasir gudang', 'masai', 'senai', 'ulu tiram', 'permas jaya',
    'tampoi', 'larkin', 'bukit indah', 'tebrau', 'mount austin'
  ]
  if (johorBahruAreas.some(area => normalizedState.includes(area))) {
    return 'Johor Bahru'
  }

  // All other states (including Johor state but not JB areas) are considered "Outside of Klang Valley"
  return 'Outside of Klang Valley'
}

/**
 * Filter trainers by location match
 * @param trainers - Array of trainer objects
 * @param merchantAddress - Merchant's address
 * @returns Filtered array of trainers that match the location
 */
export function filterTrainersByLocation<T extends { location?: string[] }>(
  trainers: T[],
  merchantAddress: string | null | undefined
): T[] {
  if (!merchantAddress) {
    // No address provided, return all trainers
    return trainers
  }
  
  return trainers.filter(trainer =>
    isLocationMatch(trainer.location, merchantAddress)
  )
}

/**
 * Get all unique locations from trainers
 * @param trainers - Array of trainer objects
 * @returns Array of unique locations
 */
export function getAllTrainerLocations<T extends { location?: string[] }>(
  trainers: T[]
): string[] {
  const locations = new Set<string>()

  trainers.forEach(trainer => {
    if (trainer.location) {
      trainer.location.forEach(loc => locations.add(loc))
    }
  })

  return Array.from(locations).sort()
}

/**
 * Region type for installation scheduling
 */
export type RegionType = 'Klang Valley' | 'West Malaysia' | 'East Malaysia'

/**
 * Determine the region type for installation scheduling
 * @param address - Full address string from hardware delivery step
 * @returns Region type: "Klang Valley", "West Malaysia", or "East Malaysia"
 */
export function getRegionType(address: string | null | undefined): RegionType {
  if (!address) {
    return 'Klang Valley' // Default to Klang Valley if no address
  }

  const matchedStates = extractLocationFromAddress(address)

  if (matchedStates.length === 0) {
    return 'Klang Valley' // Default if no state detected
  }

  // Check if within East Malaysia
  if (matchedStates.some(state => EAST_MALAYSIA_STATES.includes(state))) {
    return 'East Malaysia'
  }

  // Check if within Klang Valley
  if (matchedStates.some(state => KLANG_VALLEY_STATES.includes(state))) {
    return 'Klang Valley'
  }

  // All other states are West Malaysia (outside Klang Valley)
  return 'West Malaysia'
}

/**
 * Get the number of days to add based on region type
 * @param regionType - The region type
 * @returns Number of days to add to hardware fulfillment date
 */
export function getDaysToAddForRegion(regionType: RegionType): number {
  switch (regionType) {
    case 'Klang Valley':
      return 1 // D+1
    case 'West Malaysia':
      return 3 // D+3
    case 'East Malaysia':
      return 7 // D+7
  }
}

/**
 * Calculate the installation date lower bound based on hardware fulfillment date and merchant address
 * @param hardwareFulfillmentDate - The hardware fulfillment date (Date object or ISO string)
 * @param merchantAddress - Merchant's address from hardware delivery step
 * @returns The earliest date that installation can be scheduled
 */
export function calculateInstallationDateLowerBound(
  hardwareFulfillmentDate: Date | string | null | undefined,
  merchantAddress: string | null | undefined
): Date | null {
  if (!hardwareFulfillmentDate) {
    return null
  }

  // Convert to Date object if it's a string
  const fulfillmentDate = typeof hardwareFulfillmentDate === 'string'
    ? new Date(hardwareFulfillmentDate)
    : hardwareFulfillmentDate

  // Check if date is valid
  if (isNaN(fulfillmentDate.getTime())) {
    return null
  }

  // Determine region type based on address
  const regionType = getRegionType(merchantAddress)

  // Get the number of days to add
  const daysToAdd = getDaysToAddForRegion(regionType)

  // Calculate the lower bound date
  const lowerBoundDate = new Date(fulfillmentDate)
  lowerBoundDate.setDate(lowerBoundDate.getDate() + daysToAdd)

  return lowerBoundDate
}

