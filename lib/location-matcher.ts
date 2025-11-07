/**
 * Location Matcher Utility
 * Extracts state/location from merchant address and matches with trainer locations
 */

// Malaysian states and common variations
const MALAYSIAN_STATES = {
  'Kuala Lumpur': ['kuala lumpur', 'kl', 'k.l', 'wilayah persekutuan kuala lumpur', 'wp kuala lumpur'],
  'Selangor': ['selangor', 'sel', 'selangor darul ehsan', 'petaling jaya', 'pj', 'subang', 'shah alam', 'klang', 'puchong', 'ampang', 'cheras'],
  'Penang': ['penang', 'pulau pinang', 'p. pinang', 'pg', 'pn', 'georgetown', 'butterworth', 'balik pulau'],
  'Johor': ['johor', 'johor bahru', 'jb', 'j.b', 'johor darul takzim'],
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
  for (const [state, variations] of Object.entries(MALAYSIAN_STATES)) {
    for (const variation of variations) {
      if (normalizedAddress.includes(variation)) {
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
  
  if (matchedStates.includes('Johor')) {
    return 'Johor Bahru'
  }
  
  // All other states are considered "Outside of Klang Valley"
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

