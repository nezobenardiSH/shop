import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

const prisma = new PrismaClient()

/**
 * Generate or retrieve session ID from cookies
 * Session lasts 24 hours
 */
export function generateSessionId(request: NextRequest): string {
  const existingSessionId = request.cookies.get('analytics-session-id')?.value
  
  if (existingSessionId) {
    return existingSessionId
  }
  
  // Generate new session ID
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Hash IP address for privacy
 */
export function hashIpAddress(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16)
}

/**
 * Detect device type from user agent string
 */
export function detectDeviceType(userAgent: string | null): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgent) return 'desktop'
  
  const ua = userAgent.toLowerCase()
  
  // Check for mobile devices
  const mobileKeywords = [
    'android',
    'webos',
    'iphone',
    'ipod',
    'blackberry',
    'windows phone',
    'mobile',
    'opera mini',
    'opera mobi'
  ]
  
  // Check for tablets
  const tabletKeywords = [
    'ipad',
    'tablet',
    'kindle',
    'silk',
    'android(?!.*mobile)'
  ]
  
  // Check if it's a tablet first (as tablets might contain 'mobile' keyword)
  for (const keyword of tabletKeywords) {
    if (keyword.includes('(?!') ? new RegExp(keyword).test(ua) : ua.includes(keyword)) {
      return 'tablet'
    }
  }
  
  // Then check for mobile
  for (const keyword of mobileKeywords) {
    if (ua.includes(keyword)) {
      return 'mobile'
    }
  }
  
  // Default to desktop
  return 'desktop'
}

/**
 * Extract client information from request
 */
export function getClientInfo(request: NextRequest): {
  userAgent: string | null
  ipAddress: string | null
  deviceType: 'mobile' | 'tablet' | 'desktop'
} {
  const userAgent = request.headers.get('user-agent')
  
  // Try to get IP from various headers (Render, Vercel, Cloudflare, etc.)
  const ipAddress = 
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    null
  
  return {
    userAgent,
    ipAddress: ipAddress ? hashIpAddress(ipAddress) : null,
    deviceType: detectDeviceType(userAgent)
  }
}

/**
 * Track a page view
 * Non-blocking - errors are logged but don't throw
 */
export async function trackPageView(data: {
  merchantId?: string
  merchantName?: string
  page: string
  action?: string
  sessionId: string
  userAgent?: string | null
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  ipAddress?: string | null
  isInternalUser?: boolean
  userType?: string
  metadata?: any
}): Promise<void> {
  try {
    // Prepare data with deviceType
    const pageViewData: any = {
      merchantId: data.merchantId || null,
      merchantName: data.merchantName || null,
      page: data.page,
      action: data.action || 'view',
      sessionId: data.sessionId,
      userAgent: data.userAgent || null,
      deviceType: data.deviceType || detectDeviceType(data.userAgent || null),
      ipAddress: data.ipAddress || null,
      isInternalUser: data.isInternalUser || false,
      userType: data.userType || 'merchant',
      metadata: data.metadata || null,
      timestamp: new Date()
    }
    
    try {
      await prisma.pageView.create({ data: pageViewData })
    } catch (error: any) {
      // If deviceType column doesn't exist, try without it
      if (error.message?.includes('deviceType') || error.message?.includes('column')) {
        console.warn('[Analytics] deviceType column not found, tracking without it')
        delete pageViewData.deviceType
        await prisma.pageView.create({ data: pageViewData })
      } else {
        throw error
      }
    }
  } catch (error) {
    // Log error but don't throw - tracking failures shouldn't break the app
    console.error('[Analytics] Failed to track page view:', error)
  }
}

/**
 * Track a specific event/action
 * Wrapper around trackPageView with action specified
 */
export async function trackEvent(data: {
  merchantId?: string
  merchantName?: string
  page: string
  action: string
  sessionId: string
  userAgent?: string | null
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  ipAddress?: string | null
  isInternalUser?: boolean
  userType?: string
  metadata?: any
}): Promise<void> {
  return trackPageView(data)
}

/**
 * Track login attempt
 */
export async function trackLogin(data: {
  merchantId: string
  merchantName?: string
  success: boolean
  sessionId: string
  userAgent?: string | null
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  ipAddress?: string | null
  isInternalUser?: boolean
  userType?: string
  errorMessage?: string
}): Promise<void> {
  return trackEvent({
    merchantId: data.merchantId,
    merchantName: data.merchantName,
    page: 'login',
    action: data.success ? 'login_success' : 'login_failed',
    sessionId: data.sessionId,
    userAgent: data.userAgent,
    deviceType: data.deviceType,
    ipAddress: data.ipAddress,
    isInternalUser: data.isInternalUser,
    userType: data.userType,
    metadata: data.errorMessage ? { error: data.errorMessage } : null
  })
}

/**
 * Track booking creation
 */
export async function trackBooking(data: {
  merchantId: string
  merchantName?: string
  bookingType: 'training' | 'installation'
  sessionId: string
  userAgent?: string | null
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  ipAddress?: string | null
  isInternalUser?: boolean
  userType?: string
  metadata?: any
}): Promise<void> {
  return trackEvent({
    merchantId: data.merchantId,
    merchantName: data.merchantName,
    page: 'booking',
    action: 'booking_created',
    sessionId: data.sessionId,
    userAgent: data.userAgent,
    deviceType: data.deviceType,
    ipAddress: data.ipAddress,
    isInternalUser: data.isInternalUser,
    userType: data.userType,
    metadata: {
      bookingType: data.bookingType,
      ...data.metadata
    }
  })
}

/**
 * Track file upload
 */
export async function trackUpload(data: {
  merchantId: string
  merchantName?: string
  fileType: string
  sessionId: string
  userAgent?: string | null
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  ipAddress?: string | null
  isInternalUser?: boolean
  userType?: string
  metadata?: any
}): Promise<void> {
  return trackEvent({
    merchantId: data.merchantId,
    merchantName: data.merchantName,
    page: 'upload',
    action: 'file_uploaded',
    sessionId: data.sessionId,
    userAgent: data.userAgent,
    deviceType: data.deviceType,
    ipAddress: data.ipAddress,
    isInternalUser: data.isInternalUser,
    userType: data.userType,
    metadata: {
      fileType: data.fileType,
      ...data.metadata
    }
  })
}

/**
 * Get user info from JWT token for tracking
 */
export function getUserInfoFromToken(decoded: any): {
  isInternalUser: boolean
  userType: string
} {
  return {
    isInternalUser: decoded?.isInternalUser || false,
    userType: decoded?.userType || 'merchant'
  }
}

