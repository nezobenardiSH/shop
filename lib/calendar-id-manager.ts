/**
 * Centralized Calendar ID Management Service
 * Ensures consistent calendar ID resolution across all operations
 */

import { larkOAuthService } from './lark-oauth-service'

export class CalendarIdManager {
  private static cache = new Map<string, string>()
  private static cacheExpiry = new Map<string, number>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get the resolved calendar ID for a user with caching and fallback logic
   */
  static async getResolvedCalendarId(userEmail: string): Promise<string> {
    console.log(`🔍 CalendarIdManager: Resolving calendar ID for ${userEmail}`)
    
    // Check cache first
    const cached = this.getCachedCalendarId(userEmail)
    if (cached) {
      console.log(`📋 Using cached calendar ID: ${cached}`)
      return cached
    }

    // Try OAuth database first
    console.log(`🔎 Checking OAuth database for calendar ID...`)
    const oauthCalendarId = await this.getOAuthCalendarId(userEmail)
    if (oauthCalendarId && oauthCalendarId !== 'primary') {
      console.log(`✅ Found OAuth calendar ID: ${oauthCalendarId}`)
      
      // Validate the calendar ID works
      const isValid = await this.validateCalendarId(userEmail, oauthCalendarId)
      if (isValid) {
        this.setCachedCalendarId(userEmail, oauthCalendarId)
        return oauthCalendarId
      } else {
        console.log(`⚠️ OAuth calendar ID is invalid, trying API resolution...`)
      }
    }

    // Fallback to API resolution
    console.log(`🔄 Resolving calendar ID via API...`)
    const apiCalendarId = await this.getApiCalendarId(userEmail)
    if (apiCalendarId && apiCalendarId !== 'primary') {
      console.log(`✅ Resolved calendar ID via API: ${apiCalendarId}`)
      
      // Update OAuth database with resolved ID
      await this.updateOAuthCalendarId(userEmail, apiCalendarId)
      this.setCachedCalendarId(userEmail, apiCalendarId)
      return apiCalendarId
    }

    // Final fallback
    console.log(`⚠️ Could not resolve calendar ID, using 'primary' as fallback`)
    this.setCachedCalendarId(userEmail, 'primary')
    return 'primary'
  }

  /**
   * Get calendar ID from OAuth database
   */
  private static async getOAuthCalendarId(userEmail: string): Promise<string | null> {
    try {
      const authorizedTrainers = await larkOAuthService.getAuthorizedTrainers()
      const trainer = authorizedTrainers.find(t => t.email === userEmail)
      return trainer?.calendarId || null
    } catch (error) {
      console.error(`Failed to get OAuth calendar ID for ${userEmail}:`, error)
      return null
    }
  }

  /**
   * Get calendar ID via API resolution
   */
  private static async getApiCalendarId(userEmail: string): Promise<string | null> {
    try {
      // Import larkService dynamically to avoid circular dependencies
      const { larkService } = await import('./lark')
      return await larkService.getPrimaryCalendarId(userEmail)
    } catch (error) {
      console.error(`Failed to get API calendar ID for ${userEmail}:`, error)
      return null
    }
  }

  /**
   * Update OAuth database with resolved calendar ID
   */
  private static async updateOAuthCalendarId(userEmail: string, calendarId: string): Promise<void> {
    try {
      console.log(`📝 Updating OAuth database with calendar ID: ${calendarId}`)
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      
      await prisma.larkAuthToken.update({
        where: { userEmail },
        data: { calendarId }
      })
      
      await prisma.$disconnect()
      console.log(`✅ Updated OAuth database for ${userEmail}`)
    } catch (error) {
      console.error(`Failed to update OAuth calendar ID for ${userEmail}:`, error)
    }
  }

  /**
   * Validate that a calendar ID works for the user
   */
  private static async validateCalendarId(userEmail: string, calendarId: string): Promise<boolean> {
    try {
      // Import larkService dynamically to avoid circular dependencies
      const { larkService } = await import('./lark')
      const calendars = await larkService.getCalendarList(userEmail)
      const isValid = calendars.some(cal => cal.calendar_id === calendarId)
      console.log(`🔍 Calendar ID ${calendarId} validation: ${isValid ? 'VALID' : 'INVALID'}`)
      return isValid
    } catch (error) {
      console.error(`Failed to validate calendar ID ${calendarId} for ${userEmail}:`, error)
      return false
    }
  }

  /**
   * Get cached calendar ID if still valid
   */
  private static getCachedCalendarId(userEmail: string): string | null {
    const cached = this.cache.get(userEmail)
    const expiry = this.cacheExpiry.get(userEmail)
    
    if (cached && expiry && Date.now() < expiry) {
      return cached
    }
    
    // Clean up expired cache
    this.cache.delete(userEmail)
    this.cacheExpiry.delete(userEmail)
    return null
  }

  /**
   * Set cached calendar ID with expiry
   */
  private static setCachedCalendarId(userEmail: string, calendarId: string): void {
    this.cache.set(userEmail, calendarId)
    this.cacheExpiry.set(userEmail, Date.now() + this.CACHE_TTL)
  }

  /**
   * Clear cache for a specific user (useful for testing or when re-authorization occurs)
   */
  static clearCache(userEmail?: string): void {
    if (userEmail) {
      this.cache.delete(userEmail)
      this.cacheExpiry.delete(userEmail)
      console.log(`🗑️ Cleared calendar ID cache for ${userEmail}`)
    } else {
      this.cache.clear()
      this.cacheExpiry.clear()
      console.log(`🗑️ Cleared all calendar ID cache`)
    }
  }

  /**
   * Force refresh calendar ID for a user (bypasses cache)
   */
  static async forceRefreshCalendarId(userEmail: string): Promise<string> {
    console.log(`🔄 Force refreshing calendar ID for ${userEmail}`)
    this.clearCache(userEmail)
    return await this.getResolvedCalendarId(userEmail)
  }

  /**
   * Get cache status for debugging
   */
  static getCacheStatus(): { size: number; entries: Array<{ email: string; calendarId: string; expiresIn: number }> } {
    const entries = Array.from(this.cache.entries()).map(([email, calendarId]) => ({
      email,
      calendarId,
      expiresIn: Math.max(0, (this.cacheExpiry.get(email) || 0) - Date.now())
    }))
    
    return {
      size: this.cache.size,
      entries
    }
  }
}
