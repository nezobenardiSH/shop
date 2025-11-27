/**
 * Geocoding Service
 *
 * Converts addresses to latitude/longitude coordinates using Google Maps Geocoding API.
 * Includes fallback coordinates for Malaysian states if API fails.
 */

const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export interface GeoCoordinates {
  lat: number
  lng: number
}

// Fallback coordinates for Malaysian states (city centers)
const FALLBACK_COORDS: Record<string, GeoCoordinates> = {
  // Federal Territories
  'kuala lumpur': { lat: 3.1390, lng: 101.6869 },
  'kl': { lat: 3.1390, lng: 101.6869 },
  'putrajaya': { lat: 2.9264, lng: 101.6964 },
  'labuan': { lat: 5.2767, lng: 115.2417 },

  // States - Peninsular Malaysia
  'selangor': { lat: 3.0738, lng: 101.5183 },
  'penang': { lat: 5.4164, lng: 100.3327 },
  'pulau pinang': { lat: 5.4164, lng: 100.3327 },
  'johor': { lat: 1.4927, lng: 103.7414 },
  'johor bahru': { lat: 1.4927, lng: 103.7414 },
  'jb': { lat: 1.4927, lng: 103.7414 },
  'perak': { lat: 4.5921, lng: 101.0901 },
  'ipoh': { lat: 4.5975, lng: 101.0901 },
  'kedah': { lat: 6.1184, lng: 100.3685 },
  'alor setar': { lat: 6.1248, lng: 100.3677 },
  'kelantan': { lat: 6.1254, lng: 102.2381 },
  'kota bharu': { lat: 6.1254, lng: 102.2381 },
  'terengganu': { lat: 5.3117, lng: 103.1324 },
  'kuala terengganu': { lat: 5.3117, lng: 103.1324 },
  'pahang': { lat: 3.8126, lng: 103.3256 },
  'kuantan': { lat: 3.8077, lng: 103.3260 },
  'negeri sembilan': { lat: 2.7258, lng: 101.9424 },
  'seremban': { lat: 2.7258, lng: 101.9424 },
  'melaka': { lat: 2.1896, lng: 102.2501 },
  'malacca': { lat: 2.1896, lng: 102.2501 },
  'perlis': { lat: 6.4449, lng: 100.1986 },
  'kangar': { lat: 6.4414, lng: 100.1986 },

  // States - East Malaysia
  'sabah': { lat: 5.9788, lng: 116.0753 },
  'kota kinabalu': { lat: 5.9788, lng: 116.0753 },
  'kk': { lat: 5.9788, lng: 116.0753 },
  'sarawak': { lat: 1.5533, lng: 110.3592 },
  'kuching': { lat: 1.5533, lng: 110.3592 },

  // Default (KL center)
  'default': { lat: 3.1390, lng: 101.6869 }
}

/**
 * Get fallback coordinates based on state/city name in address
 */
function getFallbackCoordinates(address: string): GeoCoordinates {
  const lowerAddress = address.toLowerCase()

  // Check each fallback location
  for (const [location, coords] of Object.entries(FALLBACK_COORDS)) {
    if (location === 'default') continue
    if (lowerAddress.includes(location)) {
      console.log(`📍 Using fallback coordinates for: ${location}`)
      return coords
    }
  }

  // Default to KL if no match found
  console.log(`📍 No matching state found, using KL as default`)
  return FALLBACK_COORDS['default']
}

/**
 * Geocode an address using Google Maps API
 * Falls back to state center coordinates if API fails
 */
export async function geocodeAddress(address: string): Promise<GeoCoordinates> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn('⚠️ GOOGLE_MAPS_API_KEY not set, using fallback coordinates')
    return getFallbackCoordinates(address)
  }

  try {
    // Add Malaysia to the address for better results
    const fullAddress = address.includes('Malaysia')
      ? address
      : `${address}, Malaysia`

    const encodedAddress = encodeURIComponent(fullAddress)
    const url = `${GOOGLE_GEOCODING_URL}?address=${encodedAddress}&key=${apiKey}`

    console.log(`📍 Geocoding address: ${fullAddress}`)

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      console.log(`📍 Geocoded successfully: lat=${location.lat}, lng=${location.lng}`)
      return {
        lat: location.lat,
        lng: location.lng
      }
    }

    // API returned but no results
    console.warn(`⚠️ Geocoding returned ${data.status}: ${data.error_message || 'No results'}`)
    return getFallbackCoordinates(address)

  } catch (error) {
    console.error('❌ Geocoding failed:', error)
    return getFallbackCoordinates(address)
  }
}

/**
 * Extract state name from address for Surftek API
 */
export function extractStateName(address: string): string {
  const lowerAddress = address.toLowerCase()

  // Malaysian states mapping
  const stateMapping: Record<string, string> = {
    'kuala lumpur': 'Kuala Lumpur',
    'kl': 'Kuala Lumpur',
    'selangor': 'Selangor',
    'penang': 'Penang',
    'pulau pinang': 'Penang',
    'johor': 'Johor',
    'johor bahru': 'Johor',
    'perak': 'Perak',
    'kedah': 'Kedah',
    'kelantan': 'Kelantan',
    'terengganu': 'Terengganu',
    'pahang': 'Pahang',
    'negeri sembilan': 'Negeri Sembilan',
    'melaka': 'Melaka',
    'malacca': 'Melaka',
    'perlis': 'Perlis',
    'sabah': 'Sabah',
    'sarawak': 'Sarawak',
    'putrajaya': 'Putrajaya',
    'labuan': 'Labuan'
  }

  for (const [key, value] of Object.entries(stateMapping)) {
    if (lowerAddress.includes(key)) {
      return value
    }
  }

  // Default to Kuala Lumpur if state not found
  return 'Kuala Lumpur'
}
