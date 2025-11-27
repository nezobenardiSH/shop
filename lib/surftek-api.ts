/**
 * Surftek Create Ticket API Client
 *
 * Integrates with storehub.trackking.biz to automate external vendor
 * installation ticket creation.
 *
 * API Documentation: docs/Surftek_CreateTicketAPIDocument.md
 */

import { geocodeAddress, extractStateName } from './geocoding'
import { getServiceId, DeviceType } from './device-type-detector'

// API Configuration
const SURFTEK_API_URL = process.env.SURFTEK_API_URL || 'https://storehub.trackking.biz/api/ticket/create'
const SURFTEK_API_TOKEN = process.env.SURFTEK_API_TOKEN

// Request interfaces matching the Surftek API spec
export interface SurftekTicket {
  Name: string           // Contact name (max 100)
  Phone: string          // Contact phone (max 16)
  Issue: string          // Issue type (max 500) - use "*Onsite Support"
  Priority: number       // -1=Low, 0=Normal, 1=High
  IsReceiveSms: boolean  // Whether to receive SMS updates
  Email?: string         // Contact email (max 100)
  Remark?: string        // Additional notes (max 1000)
  StoreName?: string     // Merchant store name (max 100)
  DealerReseller?: string // Dealer/reseller name (max 50)
}

export interface SurftekAppointment {
  Address: string        // Full address (max 500)
  State: string          // Malaysian state (max 50)
  ServiceId: number      // Service type ID
  Longitude: number      // GPS longitude
  Latitude: number       // GPS latitude
}

export interface SurftekTicketRequest {
  Ticket: SurftekTicket
  Appointment: SurftekAppointment
}

export interface SurftekSuccessResponse {
  ErrorCode: '0'
  Ticket: {
    TicketId: number
    CaseNum: string
    [key: string]: any
  }
}

export interface SurftekErrorResponse {
  ErrorCode: string
  ErrorMessage: string
}

export type SurftekResponse = SurftekSuccessResponse | SurftekErrorResponse

// Error code descriptions
const ERROR_CODES: Record<string, string> = {
  '0': 'Success',
  '-10000': 'Invalid parameter',
  '-10001': 'Invalid passcode',
  '-10002': 'Invalid IP',
  '-10003': 'Invalid auth code',
  '-10004': 'Too many requests',
  '-10005': 'User banned',
  '-10006': 'Network failure',
  '-10007': 'Invalid authorization',
  '-10008': 'Unexpected error',
  '-10009': 'HTTP request fail',
  '-10010': 'Invalid session',
  '-10011': 'User not found',
  '-10012': 'Invalid license',
  '-10013': 'File not found',
  '-10014': 'Invalid onsites API key',
  '-10015': 'Session expired',
  '-10016': 'Account expired'
}

/**
 * Check if response is successful
 */
export function isSuccessResponse(response: SurftekResponse): response is SurftekSuccessResponse {
  return response.ErrorCode === '0'
}

/**
 * Get human-readable error description
 */
export function getErrorDescription(errorCode: string): string {
  return ERROR_CODES[errorCode] || `Unknown error (${errorCode})`
}

/**
 * Create a ticket on Surftek
 */
export async function createSurftekTicket(request: SurftekTicketRequest): Promise<SurftekResponse> {
  if (!SURFTEK_API_TOKEN) {
    throw new Error('SURFTEK_API_TOKEN is not configured')
  }

  console.log('📋 Creating Surftek ticket...')
  console.log('   Store:', request.Ticket.StoreName)
  console.log('   Contact:', request.Ticket.Name)
  console.log('   Phone:', request.Ticket.Phone)
  console.log('   ServiceId:', request.Appointment.ServiceId)
  console.log('   Address:', request.Appointment.Address)
  console.log('   State:', request.Appointment.State)
  console.log('   Coordinates:', `${request.Appointment.Latitude}, ${request.Appointment.Longitude}`)
  console.log('📤 Full Surftek request:', JSON.stringify(request, null, 2))

  // Debug: Log each field separately to identify the problematic one
  console.log('🔍 DEBUG - Ticket fields:')
  console.log('   Name length:', request.Ticket.Name?.length, '- value:', request.Ticket.Name)
  console.log('   Phone length:', request.Ticket.Phone?.length, '- value:', request.Ticket.Phone)
  console.log('   Issue length:', request.Ticket.Issue?.length)
  console.log('   Priority:', request.Ticket.Priority, '- type:', typeof request.Ticket.Priority)
  console.log('   IsReceiveSms:', request.Ticket.IsReceiveSms, '- type:', typeof request.Ticket.IsReceiveSms)
  console.log('   Email:', request.Ticket.Email)
  console.log('   Remark length:', request.Ticket.Remark?.length)
  console.log('   StoreName length:', request.Ticket.StoreName?.length, '- value:', request.Ticket.StoreName)
  console.log('   DealerReseller:', request.Ticket.DealerReseller)
  console.log('🔍 DEBUG - Appointment fields:')
  console.log('   Address length:', request.Appointment.Address?.length, '- value:', request.Appointment.Address)
  console.log('   State length:', request.Appointment.State?.length, '- value:', request.Appointment.State)
  console.log('   ServiceId:', request.Appointment.ServiceId, '- type:', typeof request.Appointment.ServiceId)
  console.log('   Longitude:', request.Appointment.Longitude, '- type:', typeof request.Appointment.Longitude)
  console.log('   Latitude:', request.Appointment.Latitude, '- type:', typeof request.Appointment.Latitude)

  try {
    const response = await fetch(SURFTEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SURFTEK_API_TOKEN}`
      },
      body: JSON.stringify(request)
    })

    const data: SurftekResponse = await response.json()

    if (isSuccessResponse(data)) {
      console.log('✅ Surftek ticket created successfully')
      console.log('   TicketId:', data.Ticket.TicketId)
      console.log('   CaseNum:', data.Ticket.CaseNum)
    } else {
      console.error('❌ Surftek API error:', getErrorDescription(data.ErrorCode))
      console.error('   ErrorMessage:', data.ErrorMessage)
    }

    return data
  } catch (error) {
    console.error('❌ Surftek API request failed:', error)
    throw error
  }
}

/**
 * Merchant details interface for mapping
 */
export interface MerchantDetails {
  merchantName: string
  merchantId: string
  address: string
  contactName: string
  contactPhone: string
  contactEmail?: string
  msmName?: string
  hardwareItems?: string[]
  onboardingSummary?: string
  preferredDate?: string
  preferredTime?: string
}

/**
 * Map merchant details to Surftek ticket request
 */
export async function mapMerchantToSurftekTicket(
  merchant: MerchantDetails,
  deviceType: DeviceType
): Promise<SurftekTicketRequest> {
  // Validate mandatory fields
  if (!merchant.contactPhone || merchant.contactPhone.trim() === '') {
    throw new Error('Contact phone is required for Surftek ticket')
  }
  if (!merchant.address || merchant.address.trim() === '') {
    throw new Error('Address is required for Surftek ticket')
  }

  // Geocode the address
  const coordinates = await geocodeAddress(merchant.address)
  const stateName = extractStateName(merchant.address)
  const serviceId = getServiceId(deviceType)

  // Build remarks - API doc says 1000 but actual limit is ~900, using 850 for safety
  const MAX_REMARK_LENGTH = 850
  let remarkParts: string[] = []

  if (merchant.hardwareItems && merchant.hardwareItems.length > 0) {
    remarkParts.push(`Hardware:\n${merchant.hardwareItems.map(item => `- ${item}`).join('\n')}`)
  }

  if (merchant.preferredDate) {
    remarkParts.push(`Preferred Date: ${merchant.preferredDate}`)
  }

  if (merchant.preferredTime) {
    remarkParts.push(`Preferred Time: ${merchant.preferredTime}`)
  }

  if (merchant.msmName) {
    remarkParts.push(`Onboarding Manager: ${merchant.msmName}`)
  }

  // Salesforce link
  const salesforceLink = `Salesforce: https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchant.merchantId}/view`
  remarkParts.push(salesforceLink)

  // Calculate remaining space for onboarding summary
  let remarks = remarkParts.join('\n\n')

  if (merchant.onboardingSummary) {
    const remainingSpace = MAX_REMARK_LENGTH - remarks.length - 25 // 25 for "\n\nOnboarding Summary:\n"
    if (remainingSpace > 50) { // Only add if we have meaningful space
      const summary = merchant.onboardingSummary.length > remainingSpace
        ? merchant.onboardingSummary.substring(0, remainingSpace - 3) + '...'
        : merchant.onboardingSummary
      remarks += `\n\nOnboarding Summary:\n${summary}`
    }
  }

  // Final truncation safety
  if (remarks.length > MAX_REMARK_LENGTH) {
    remarks = remarks.substring(0, MAX_REMARK_LENGTH - 3) + '...'
  }

  // Ensure phone number is in correct format (remove spaces, ensure country code)
  let phone = merchant.contactPhone.replace(/\s+/g, '')
  if (phone.startsWith('0')) {
    phone = '60' + phone.substring(1) // Convert 0123456789 to 60123456789
  }
  if (!phone.startsWith('60')) {
    phone = '60' + phone
  }

  return {
    Ticket: {
      Name: merchant.contactName || merchant.merchantName,
      Phone: phone,
      Issue: '*Onsite Support',
      Priority: 0, // Normal priority
      IsReceiveSms: true,
      Email: merchant.contactEmail || undefined,
      Remark: remarks.trim(),
      StoreName: merchant.merchantName,
      DealerReseller: 'StoreHub'
    },
    Appointment: {
      Address: merchant.address,
      State: stateName,
      ServiceId: serviceId,
      Longitude: coordinates.lng,
      Latitude: coordinates.lat
    }
  }
}

/**
 * High-level function to create a Surftek ticket for a merchant
 * Returns ticket info on success, or null on failure
 */
export async function createTicketForMerchant(
  merchant: MerchantDetails,
  deviceType: DeviceType
): Promise<{ ticketId: number; caseNum: string } | null> {
  try {
    const request = await mapMerchantToSurftekTicket(merchant, deviceType)
    const response = await createSurftekTicket(request)

    if (isSuccessResponse(response)) {
      return {
        ticketId: response.Ticket.TicketId,
        caseNum: response.Ticket.CaseNum
      }
    }

    return null
  } catch (error) {
    console.error('Failed to create Surftek ticket:', error)
    return null
  }
}
