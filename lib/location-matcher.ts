/**
 * Location Matcher Utility
 * Extracts state/location from merchant address and matches with trainer locations
 */

// Malaysian states and common variations
const MALAYSIAN_STATES = {
  'Kuala Lumpur': ['kuala lumpur', 'kl', 'k.l', 'wilayah persekutuan kuala lumpur', 'wp kuala lumpur'],
  'Selangor': ['selangor', 'sel', 'selangor darul ehsan'],
  'Penang': ['penang', 'pulau pinang', 'p. pinang', 'pg', 'pn'],
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
    return true
  }
  
  if (!merchantAddress) {
    // If merchant has no address, we can't determine location
    // Default to true to not block bookings
    return true
  }
  
  const merchantLocations = extractLocationFromAddress(merchantAddress)
  
  if (merchantLocations.length === 0) {
    // Couldn't extract location from address, default to true
    return true
  }
  
  // Check if any merchant location matches any trainer location
  return merchantLocations.some(merchantLoc =>
    trainerLocations.some(trainerLoc =>
      merchantLoc.toLowerCase() === trainerLoc.toLowerCase()
    )
  )
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

