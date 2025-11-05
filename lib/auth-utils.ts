import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key-change-in-production'
const INTERNAL_TEAM_PIN = process.env.INTERNAL_TEAM_PIN || '0000'

export function extractPINFromPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')
  
  // Must have at least 4 digits
  if (cleaned.length < 4) return null
  
  // Return last 4 digits
  return cleaned.slice(-4)
}

export function validatePIN(
  submittedPIN: string,
  phoneNumbers: (string | null | undefined)[]
): boolean {
  // Clean submitted PIN
  const cleanPIN = submittedPIN.replace(/\D/g, '')
  
  if (cleanPIN.length !== 4) return false
  
  // Check against all available phone numbers
  for (const phone of phoneNumbers) {
    const validPIN = extractPINFromPhone(phone)
    if (validPIN && validPIN === cleanPIN) {
      return true
    }
  }
  
  return false
}

/**
 * Check if the submitted PIN is the universal internal team PIN
 */
export function isInternalTeamPIN(submittedPIN: string): boolean {
  const cleanPIN = submittedPIN.replace(/\D/g, '')
  return cleanPIN === INTERNAL_TEAM_PIN
}

export function validatePINWithUser(
  submittedPIN: string,
  phoneData: Array<{ phone: string | null | undefined; name: string | null | undefined }>
): { isValid: boolean; userName: string; isInternalUser: boolean } {
  // Clean submitted PIN
  const cleanPIN = submittedPIN.replace(/\D/g, '')

  if (cleanPIN.length !== 4) {
    return { isValid: false, userName: 'User', isInternalUser: false }
  }

  // Check if it's the internal team PIN first
  if (isInternalTeamPIN(submittedPIN)) {
    return { isValid: true, userName: 'StoreHub Team', isInternalUser: true }
  }

  // Check against all available phone numbers and their associated names
  for (const { phone, name } of phoneData) {
    const validPIN = extractPINFromPhone(phone)
    if (validPIN && validPIN === cleanPIN) {
      // Return the actual name from the database, or a default name
      const userName = name || 'User'
      return { isValid: true, userName, isInternalUser: false }
    }
  }

  return { isValid: false, userName: 'User', isInternalUser: false }
}

export function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '24h'
  })
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error: any) {
    return null
  }
}

// Rate limiting logic (simple in-memory implementation)
const loginAttempts: Map<string, { count: number; firstAttempt: number }> = new Map()
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

export function checkRateLimit(merchantId: string): { allowed: boolean; remainingAttempts?: number; lockoutTime?: number } {
  const now = Date.now()
  const attempts = loginAttempts.get(merchantId)
  
  if (!attempts) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }
  
  // Check if lockout period has passed
  if (now - attempts.firstAttempt > LOCKOUT_DURATION) {
    loginAttempts.delete(merchantId)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }
  
  if (attempts.count >= MAX_ATTEMPTS) {
    const lockoutRemaining = LOCKOUT_DURATION - (now - attempts.firstAttempt)
    return { 
      allowed: false, 
      lockoutTime: Math.ceil(lockoutRemaining / 1000 / 60) // minutes remaining
    }
  }
  
  return { 
    allowed: true, 
    remainingAttempts: MAX_ATTEMPTS - attempts.count 
  }
}

export function recordLoginAttempt(merchantId: string, success: boolean) {
  if (success) {
    loginAttempts.delete(merchantId)
    return
  }
  
  const now = Date.now()
  const attempts = loginAttempts.get(merchantId)
  
  if (!attempts) {
    loginAttempts.set(merchantId, { count: 1, firstAttempt: now })
  } else {
    attempts.count++
  }
}