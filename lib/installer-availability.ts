import { getSalesforceConnection } from './salesforce'
import { createSalesforceEvent, updateSalesforceEvent } from './salesforce-events'
import { larkService } from './lark'
import { sendBookingNotification, sendManagerBookingNotification, sendExternalVendorNotificationToManager } from './lark-notifications'
import { loadInstallersConfig } from './config-loader'
import { getLocationCategory as getSmartLocationCategory } from './location-matcher'
import { prisma } from './prisma'
import {
  createSalesforceTask,
  getMsmSalesforceUserId,
  getSalesforceRecordUrl,
  getTodayDateString
} from './salesforce-tasks'
import { getDeviceType, OrderItem } from './device-type-detector'
import { createTicketForMerchant, MerchantDetails } from './surftek-api'
import { getDateStringInSingapore, createSingaporeMidnight, createSingaporeEndOfDay } from './date-utils'

interface TimeSlot {
  start: string
  end: string
  label: string
}

interface InstallerAvailability {
  date: string
  slots: Array<{
    time: TimeSlot
    isAvailable: boolean
    availableInstallers: string[]
  }>
}

// Alias for compatibility
type InstallationAvailability = InstallerAvailability

/**
 * Map external vendor installation data to Lark base fields
 * @param data Portal data from external vendor request
 * @param larkService LarkService instance for getting user IDs
 * @returns Mapped fields for Lark base record
 */
async function mapToExternalVendorLarkBase(
  data: {
    merchantName: string
    merchantId: string
    msmEmail: string
    msmName: string
    preferredDate: string
    preferredTime: string
  },
  larkServiceInstance: any
): Promise<Record<string, any>> {

  // Parse and combine date/time for Requested Date field
  const requestedDateTime = new Date(`${data.preferredDate} ${data.preferredTime}`)
  const requestedTimestamp = requestedDateTime.getTime()

  // Current timestamp for Input Date
  const inputTimestamp = Date.now()

  // Build Salesforce URL
  const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${data.merchantId}/view`

  return {
    'Merchant Name': data.merchantName,
    'Salesforce': {
      type: 'url',
      link: salesforceUrl
    },
    'Status': 'New',
    'Input date': inputTimestamp,
    'Onboarding Manager': data.msmName, // Now a Text field, not Person field
    'Progress notes': '',
    'Requested date': requestedTimestamp
  }
}

// Get the installer type based on shipping address from Salesforce
export async function getInstallerType(merchantId: string): Promise<'internal' | 'external'> {
  try {
    const conn = await getSalesforceConnection()
    if (!conn) {
      console.error('Failed to get Salesforce connection')
      return 'external' // Default to external if can't connect
    }

    const query = `
      SELECT Name, Id,
             Shipping_Street__c, Shipping_City__c, Shipping_State__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `

    console.log('🔍 Querying installer type with:', { merchantId, query })

    const result = await conn.query(query)
    const record = result.records[0]
    const shippingStreet = record?.Shipping_Street__c
    const shippingCity = record?.Shipping_City__c
    const shippingState = record?.Shipping_State__c

    console.log('🔍 Installer type query result:', {
      merchantId,
      foundRecord: !!record,
      recordName: record?.Name,
      recordId: record?.Id,
      shippingStreet,
      shippingCity,
      shippingState
    })

    // Build full address for intelligent location detection
    const fullAddress = [shippingStreet, shippingCity, shippingState]
      .filter(Boolean)
      .join(', ')

    console.log('📍 Full address for location detection:', fullAddress)

    // Use the intelligent location matcher
    const locationCategory = getSmartLocationCategory(fullAddress)

    console.log('📍 Smart location detection result:', locationCategory)

    // Map location category to installer type
    if (locationCategory === 'Within Klang Valley' ||
        locationCategory === 'Penang' ||
        locationCategory === 'Johor Bahru') {
      console.log('✅ Detected covered area - using internal installers')
      return 'internal'
    }

    // Otherwise, it's outside our service areas (external vendor)
    console.log('❌ Location not in covered areas - using external vendor')
    return 'external'
  } catch (error) {
    console.error('Error getting installer type:', error)
    return 'external'
  }
}

// Get location category based on shipping address
export async function getLocationCategory(merchantId: string): Promise<'klangValley' | 'penang' | 'johorBahru' | 'external'> {
  try {
    const conn = await getSalesforceConnection()
    if (!conn) {
      console.error('Failed to get Salesforce connection')
      return 'external'
    }
    const query = `
      SELECT Shipping_Street__c, Shipping_City__c, Shipping_State__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    const result = await conn.query(query)
    const shippingStreet = result.records[0]?.Shipping_Street__c
    const shippingCity = result.records[0]?.Shipping_City__c
    const shippingState = result.records[0]?.Shipping_State__c

    // Build full address for intelligent location detection
    const fullAddress = [shippingStreet, shippingCity, shippingState]
      .filter(Boolean)
      .join(', ')

    console.log('📍 Full address for installer location category:', fullAddress)

    // Use the intelligent location matcher
    const locationCategory = getSmartLocationCategory(fullAddress)

    console.log('📍 Smart location detection result:', locationCategory)

    // Map location category to installer config key
    switch (locationCategory) {
      case 'Within Klang Valley':
        return 'klangValley'
      case 'Penang':
        return 'penang'
      case 'Johor Bahru':
        return 'johorBahru'
      default:
        return 'external'
    }
  } catch (error) {
    console.error('Error getting location category:', error)
    return 'external'
  }
}

// Check availability for internal installers (using same mechanism as trainers)
export async function getInternalInstallersAvailability(
  startDate: string,
  endDate: string,
  merchantId?: string,
  includeWeekends: boolean = false
): Promise<InstallerAvailability[]> {
  console.log('Getting installer availability...')
  console.log('Include weekends:', includeWeekends)

  // Read installers config dynamically to pick up changes without restart
  const installersConfig = await loadInstallersConfig()

  // Determine which location's installers to use
  let locationKey = 'klangValley' // default
  if (merchantId) {
    const location = await getLocationCategory(merchantId)
    if (location !== 'external') {
      locationKey = location
    }
  }

  console.log(`Using installers for location: ${locationKey}`)

  // Get the appropriate installer config
  const locationConfig = (installersConfig as any)[locationKey] || installersConfig.klangValley
  const installers = locationConfig.installers.filter((i: any) => i.isActive)
  console.log(`Checking availability for ${installers.length} installers:`, installers.map((i: any) => i.name))
  
  // Map to store each installer's availability
  const installerAvailabilities: Map<string, Array<{start: string; end: string}>> = new Map()
  
  // Fetch availability for each installer
  for (const installer of installers as any[]) {
    try {
      // Check if installer has OAuth token
      const { larkOAuthService } = await import('./lark-oauth-service')
      const hasToken = await larkOAuthService.isUserAuthorized(installer.email)

      if (!hasToken) {
        console.log(`⚠️ ${installer.name} has no OAuth token - SKIPPING (not available)`)
        // Don't add to installerAvailabilities - installer is not available without OAuth
        continue
      }

      // Get raw busy times from calendar (same as trainers do)
      const startDateTime = new Date(`${startDate}T00:00:00+08:00`)
      const endDateTime = new Date(`${endDate}T23:59:59+08:00`)

      const busySlots = await larkService.getRawBusyTimes(
        installer.email,
        startDateTime,
        endDateTime
      )

      console.log(`${installer.name}: Found ${busySlots.length} busy periods`)

      // Convert to simple format
      const simpleBusySlots = busySlots.map((busy: any) => ({
        start: busy.start_time,
        end: busy.end_time
      }))

      installerAvailabilities.set(installer.name, simpleBusySlots)
    } catch (error) {
      console.error(`Failed to get availability for ${installer.name}:`, error)
      // If we can't get availability due to error, don't include this installer
      // This prevents showing false availability
      console.log(`⚠️ ${installer.name} excluded from availability due to error`)
    }
  }
  
  // Now combine the availabilities into time slots
  const combinedAvailability: InstallationAvailability[] = []
  const TIME_SLOTS = installersConfig.settings.defaultTimeSlots

  // Use Singapore timezone for date calculations
  const start = createSingaporeMidnight(startDate)
  const end = createSingaporeEndOfDay(endDate)
  const current = new Date(start)

  while (current <= end) {
    // Get the date string and day of week in Singapore timezone
    const dateStr = getDateStringInSingapore(current)
    // Create a date object at noon Singapore time to get correct day of week
    const sgDate = new Date(`${dateStr}T12:00:00+08:00`)
    const dayOfWeek = sgDate.getDay()

    // Only weekdays (Monday=1 to Friday=5) unless includeWeekends is true
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    if (!isWeekend || includeWeekends) {
      
      const slots = TIME_SLOTS.map((timeSlot: any) => {
        const slotStart = new Date(`${dateStr}T${timeSlot.start}:00+08:00`)
        const slotEnd = new Date(`${dateStr}T${timeSlot.end}:00+08:00`)

        // Check which installers are available for this slot
        const availableInstallers: string[] = []

        for (const [installerName, busySlots] of installerAvailabilities.entries()) {
          const isAvailable = !busySlots.some(busy => {
            const busyStart = new Date(busy.start)
            const busyEnd = new Date(busy.end)
            // Check if busy period overlaps with this time slot
            return busyStart < slotEnd && busyEnd > slotStart
          })

          if (isAvailable) {
            availableInstallers.push(installerName)
          }
        }

        return {
          time: timeSlot,
          isAvailable: availableInstallers.length > 0,
          availableInstallers
        }
      })
      
      combinedAvailability.push({
        date: dateStr,
        slots
      })
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }
  
  return combinedAvailability
}

// Assign an installer based on availability (random if multiple available)
export function assignInstaller(availableInstallers: string[]): string {
  if (availableInstallers.length === 0) {
    throw new Error('No installers available for selected slot')
  }
  
  if (availableInstallers.length === 1) {
    return availableInstallers[0]
  }
  
  // Random selection when multiple installers available
  const randomIndex = Math.floor(Math.random() * availableInstallers.length)
  return availableInstallers[randomIndex]
}

// Book installation with internal installer
export async function bookInternalInstallation(
  merchantId: string,
  merchantName: string,
  date: string,
  timeSlot: TimeSlot,
  availableInstallers: string[],
  existingEventId?: string,
  selectedInstallerEmail?: string  // Internal user manually selected installer (optional)
) {
  console.log('📦 bookInternalInstallation called with:', {
    merchantId,
    merchantIdLength: merchantId?.length,
    merchantIdType: typeof merchantId,
    merchantName,
    date,
    timeSlot,
    availableInstallers,
    existingEventId,
    selectedInstallerEmail: selectedInstallerEmail || 'AUTO-ASSIGN'
  })

  // Read installers config dynamically to pick up changes without restart
  const installersConfig = await loadInstallersConfig()

  // Get location category for the merchant
  const locationCategory = await getLocationCategory(merchantId)
  const locationKey = locationCategory === 'external' ? 'klangValley' : locationCategory

  const locationConfig = (installersConfig as any)[locationKey] || installersConfig.klangValley

  let installer
  let assignedInstaller: string = ''

  // If internal user manually selected an installer, use that one
  if (selectedInstallerEmail) {
    console.log('🎯 Internal user selected installer email:', selectedInstallerEmail)
    // Search across all regions for the selected installer
    const allRegions = ['klangValley', 'penang', 'johorBahru']
    for (const region of allRegions) {
      const regionConfig = (installersConfig as any)[region]
      if (regionConfig?.installers) {
        installer = regionConfig.installers.find((i: any) => i.email === selectedInstallerEmail)
        if (installer) {
          console.log(`🎯 Found selected installer: ${installer.name} (${installer.email}) in region ${region}`)
          assignedInstaller = installer.name
          break
        }
      }
    }
    if (!installer) {
      console.error(`❌ Selected installer not found. Looking for email: "${selectedInstallerEmail}"`)
      throw new Error(`Selected installer not found: ${selectedInstallerEmail}`)
    }
  } else {
    // Auto-assign installer
    assignedInstaller = assignInstaller(availableInstallers)

    // Find installer by name - handle both short names (from config) and full names (from Lark)
    installer = locationConfig.installers.find((i: any) => i.name === assignedInstaller)

    // If not found by exact match, try finding by partial match (e.g., "Fairul" in "Mohamad Fairul Ismail")
    if (!installer) {
      installer = locationConfig.installers.find((i: any) =>
        assignedInstaller.toLowerCase().includes(i.name.toLowerCase()) ||
        i.name.toLowerCase().includes(assignedInstaller.toLowerCase())
      )
    }

    if (!installer) {
      console.error(`❌ Installer not found. Looking for: "${assignedInstaller}"`)
      console.error(`   Available installers:`, locationConfig.installers.map((i: any) => i.name))
      throw new Error(`Installer configuration not found for: ${assignedInstaller}`)
    }
  }

  console.log(`✅ Found installer: ${installer.name} (${installer.email})`)

  // SERVER-SIDE AVAILABILITY VALIDATION
  // Always validate that the installer is actually available for the requested slot
  // This prevents bookings when installer has blocked their calendar (leave, other appointments, etc.)
  console.log('🔍 Validating installer availability server-side...')
  try {
    const startDateTime = new Date(`${date}T00:00:00+08:00`)
    const endDateTime = new Date(`${date}T23:59:59+08:00`)

    const busyTimes = await larkService.getRawBusyTimes(
      installer.email,
      startDateTime,
      endDateTime
    )

    // Create slot time range for comparison
    const slotStart = new Date(`${date}T${timeSlot.start}:00+08:00`)
    const slotEnd = new Date(`${date}T${timeSlot.end}:00+08:00`)

    // Check if any busy time overlaps with the requested slot
    const conflictingBusy = busyTimes.find((busy: any) => {
      const busyStart = new Date(busy.start_time)
      const busyEnd = new Date(busy.end_time)
      // Overlap exists if: slotStart < busyEnd AND slotEnd > busyStart
      return slotStart < busyEnd && slotEnd > busyStart
    })

    if (conflictingBusy) {
      const busyStartSGT = new Date(conflictingBusy.start_time).toLocaleString('en-US', {
        timeZone: 'Asia/Singapore',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      const busyEndSGT = new Date(conflictingBusy.end_time).toLocaleString('en-US', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit'
      })

      console.error(`❌ SERVER-SIDE VALIDATION FAILED: ${installer.name} is not available`)
      console.error(`   Requested slot: ${timeSlot.start} - ${timeSlot.end}`)
      console.error(`   Conflicting busy period: ${busyStartSGT} - ${busyEndSGT}`)
      console.error(`   Source: calendar event`)

      throw new Error(`${installer.name} is not available for ${timeSlot.label || `${timeSlot.start} - ${timeSlot.end}`}. They have a calendar conflict during this time.`)
    }

    console.log(`✅ Server-side validation passed: ${installer.name} is available for ${timeSlot.start} - ${timeSlot.end}`)
  } catch (validationError: any) {
    // If the error is our availability error, re-throw it
    if (validationError.message.includes('is not available for')) {
      throw validationError
    }
    // For other errors (API failures), log but allow booking to proceed
    // This prevents blocking all bookings if Lark API is temporarily down
    console.error(`⚠️ Server-side availability check failed:`, validationError.message)
    console.log(`⚠️ Proceeding with booking despite validation error (fail-open for API issues)`)
  }

  // Fetch merchant details from Salesforce for calendar event
  console.log('📋 Fetching merchant details from Salesforce for calendar event...')
  const conn = await getSalesforceConnection()
  let merchantDetails: any = {}
  let hardwareList: string[] = []

  if (conn) {
    try {
      // Get merchant/trainer record with all required fields including emails and hardware order
      const trainerQuery = `
        SELECT Id, Name, Account_Name__c, Hardware_Order__c, Opportunity_Name__c,
               Shipping_Street__c, Shipping_City__c, Shipping_State__c, Shipping_Zip_Postal_Code__c, Shipping_Country__c,
               Operation_Manager_Contact__r.Name, Operation_Manager_Contact__r.Phone, Operation_Manager_Contact__r.Email,
               Business_Owner_Contact__r.Name, Business_Owner_Contact__r.Phone, Business_Owner_Contact__r.Email,
               Merchant_PIC_Name__c, Merchant_PIC_Contact_Number__c, Merchant_PIC_Role__c,
               Email__c,
               MSM_Name__r.Name, MSM_Name__r.Email, MSM_Name__r.Phone,
               Onboarding_Summary__c
        FROM Onboarding_Trainer__c
        WHERE Id = '${merchantId}'
        LIMIT 1
      `

      const trainerResult = await conn.query(trainerQuery)

      if (trainerResult.totalSize > 0) {
        const trainer: any = trainerResult.records[0]

        console.log('🔍 Raw Salesforce trainer data:')
        console.log('   Name:', trainer.Name)
        console.log('   Merchant_PIC_Name__c:', trainer.Merchant_PIC_Name__c)
        console.log('   Merchant_PIC_Contact_Number__c:', trainer.Merchant_PIC_Contact_Number__c)
        console.log('   Merchant_PIC_Role__c:', trainer.Merchant_PIC_Role__c)
        console.log('   Email__c:', trainer.Email__c)
        console.log('   Operation_Manager_Contact__r:', JSON.stringify(trainer.Operation_Manager_Contact__r))
        console.log('   Business_Owner_Contact__r:', JSON.stringify(trainer.Business_Owner_Contact__r))
        console.log('   MSM_Name__r:', JSON.stringify(trainer.MSM_Name__r))
        console.log('   Shipping_Street__c:', trainer.Shipping_Street__c)
        console.log('   Shipping_City__c:', trainer.Shipping_City__c)
        console.log('   Shipping_State__c:', trainer.Shipping_State__c)
        console.log('   Shipping_Zip_Postal_Code__c:', trainer.Shipping_Zip_Postal_Code__c)
        console.log('   Shipping_Country__c:', trainer.Shipping_Country__c)
        console.log('   Onboarding_Summary__c:', trainer.Onboarding_Summary__c)

        merchantDetails = {
          // trainer.Name is the Onboarding Trainer Name (e.g., "Nasi Lemak")
          // This is what should be displayed as the merchant name
          name: trainer.Name,
          address: [
            trainer.Shipping_Street__c,
            trainer.Shipping_City__c,
            trainer.Shipping_State__c,
            trainer.Shipping_Zip_Postal_Code__c,
            trainer.Shipping_Country__c
          ]
            .filter(Boolean)
            .map((part: string) => part.trim().replace(/,+$/, '')) // Remove trailing commas and trim
            .filter(Boolean) // Remove empty strings after cleanup
            .join(', '),
          shippingCity: trainer.Shipping_City__c,
          shippingState: trainer.Shipping_State__c,
          shippingCountry: trainer.Shipping_Country__c,
          // Prioritize Merchant PIC contact, then fall back to Operation Manager or Business Owner
          primaryContactRole: trainer.Merchant_PIC_Name__c ? 'Merchant PIC' :
                             trainer.Operation_Manager_Contact__r ? 'Operation Manager' :
                             trainer.Business_Owner_Contact__r ? 'Business Owner' : 'N/A',
          primaryContactName: trainer.Merchant_PIC_Name__c ||
                             trainer.Operation_Manager_Contact__r?.Name ||
                             trainer.Business_Owner_Contact__r?.Name || 'N/A',
          primaryContactPhone: trainer.Merchant_PIC_Contact_Number__c ||
                              trainer.Operation_Manager_Contact__r?.Phone ||
                              trainer.Business_Owner_Contact__r?.Phone || 'N/A',
          primaryContactEmail: trainer.Email__c ||
                              trainer.Operation_Manager_Contact__r?.Email ||
                              trainer.Business_Owner_Contact__r?.Email || null,
          msmName: trainer.MSM_Name__r?.Name || 'N/A',
          msmEmail: trainer.MSM_Name__r?.Email || null,
          msmPhone: trainer.MSM_Name__r?.Phone || 'N/A',
          onboardingSummary: trainer.Onboarding_Summary__c || 'N/A',
          accountId: trainer.Account_Name__c
        }

        console.log('✅ Processed merchantDetails:')
        console.log(JSON.stringify(merchantDetails, null, 2))

        console.log('✅ Processed merchantDetails:')
        console.log('   primaryContactName:', merchantDetails.primaryContactName)
        console.log('   primaryContactPhone:', merchantDetails.primaryContactPhone)
        console.log('   msmName:', merchantDetails.msmName)
        console.log('   address:', merchantDetails.address)

        // Get hardware list and invoice number
        let hardwareOrderId: string | null = null

        // First, try to use Hardware_Order__c if it exists
        if (trainer.Hardware_Order__c) {
          hardwareOrderId = trainer.Hardware_Order__c
          console.log('📦 Using Hardware_Order__c:', hardwareOrderId)
        }
        // Hardcoded fallback for specific merchant (activate175)
        else if (trainer.Id === 'a0yQ9000003aAvBIAU') {
          hardwareOrderId = '00050419'
          console.log('📦 Using hardcoded hardware order for activate175:', hardwareOrderId)
        }
        // If not, try to get from Opportunity
        else if (trainer.Opportunity_Name__c) {
          try {
            const oppQuery = `
              SELECT Id, AccountId
              FROM Opportunity
              WHERE Id = '${trainer.Opportunity_Name__c}'
              LIMIT 1
            `
            const oppResult = await conn.query(oppQuery)
            if (oppResult.totalSize > 0) {
              const opp: any = oppResult.records[0]
              console.log('📦 Found Opportunity AccountId:', opp.AccountId)
              trainer.Account_Name__c = opp.AccountId
            }
          } catch (oppError) {
            console.error('Failed to fetch Opportunity:', oppError)
          }
        }

        // Now fetch hardware order if we have an account
        if (!hardwareOrderId && trainer.Account_Name__c) {
          try {
            // Query for Non-Software Only orders for this account
            const hardwareOrderQuery = `
              SELECT Id, NSOrderNumber__c, Type
              FROM Order
              WHERE AccountId = '${trainer.Account_Name__c}' AND Type = 'Non-Software Only'
              LIMIT 1
            `

            const hardwareOrderResult = await conn.query(hardwareOrderQuery)

            if (hardwareOrderResult.totalSize > 0) {
              const hardwareOrder: any = hardwareOrderResult.records[0]
              hardwareOrderId = hardwareOrder.Id
              merchantDetails.invoiceNumber = hardwareOrder.NSOrderNumber__c || 'N/A'
              console.log('📦 Hardware Order found from Account:', hardwareOrder.NSOrderNumber__c)
            }
          } catch (hardwareError) {
            console.error('Failed to fetch hardware order from Account:', hardwareError)
          }
        }

        // Fetch order items if we have a hardware order ID
        if (hardwareOrderId) {
          try {
            const orderItemsQuery = `
              SELECT Product2.Name, Quantity
              FROM OrderItem
              WHERE OrderId = '${hardwareOrderId}'
            `

            const orderItemsResult = await conn.query(orderItemsQuery)

            if (orderItemsResult.totalSize > 0) {
              hardwareList = orderItemsResult.records.map((item: any) => {
                const qty = item.Quantity > 1 ? ` (x${item.Quantity})` : ''
                return `${item.Product2?.Name || 'Unknown Product'}${qty}`
              })
              console.log('📦 Hardware items found:', hardwareList)
            }
          } catch (itemsError) {
            console.error('Failed to fetch hardware items:', itemsError)
          }
        }
      }

      console.log('✅ Merchant details fetched:', merchantDetails)
      console.log('✅ Hardware list:', hardwareList)
    } catch (error) {
      console.error('Failed to fetch merchant details from Salesforce:', error)
      // Continue with basic details
    }
  }

  // Get the calendar ID for the installer (same as trainers do)
  const { CalendarIdManager } = await import('./calendar-id-manager')
  const calendarId = await CalendarIdManager.getResolvedCalendarId(installer.email)

  console.log(`Creating installation event for ${installer.name} in calendar ${calendarId}`)
  
  // Step 1: Query Salesforce for current installer and event ID (for rescheduling)
  let currentInstallerEmailForDeletion: string | null = null
  let currentEventIdForDeletion: string | null = null
  let currentSalesforceEventId: string | null = null

  if (existingEventId) {
    try {
      const conn = await getSalesforceConnection()
      if (conn) {
        // Query Onboarding_Portal__c for current installer name, event ID, and Salesforce Event ID
        const portalQuery = `
          SELECT Installer_Name__c, Installation_Event_ID__c, Installation_Salesforce_Event_ID__c
          FROM Onboarding_Portal__c
          WHERE Onboarding_Trainer_Record__c = '${merchantId}'
          LIMIT 1
        `

        console.log('🔍 Querying Onboarding_Portal__c for current installer and event ID')
        const portalResult = await conn.query(portalQuery)

        if (portalResult.totalSize > 0) {
          const portalRecord = portalResult.records[0] as any
          const currentInstallerName = portalRecord.Installer_Name__c
          currentEventIdForDeletion = portalRecord.Installation_Event_ID__c
          currentSalesforceEventId = portalRecord.Installation_Salesforce_Event_ID__c

          console.log(`✅ Found current installer: ${currentInstallerName}`)
          console.log(`✅ Found current event ID: ${currentEventIdForDeletion}`)
          console.log(`✅ Found current Salesforce Event ID: ${currentSalesforceEventId}`)

          // Find the installer object to get their email
          if (currentInstallerName && locationConfig.installers) {
            const installerObj = locationConfig.installers.find(
              (inst: any) => inst.name === currentInstallerName
            )
            if (installerObj) {
              currentInstallerEmailForDeletion = installerObj.email
              console.log(`✅ Resolved installer email: ${currentInstallerEmailForDeletion}`)
            }
          }
        }
      }
    } catch (queryError) {
      console.log('⚠️ Failed to query current installer from Salesforce:', queryError)
      // Continue - will fall back to trying all installers
    }
  }

  // Step 2: If this is a rescheduling, cancel the existing event first
  if (existingEventId) {
    try {
      console.log('🗑️ Rescheduling detected - attempting to cancel existing event')
      console.log('   Event ID:', currentEventIdForDeletion || existingEventId)
      console.log('   Installer email:', currentInstallerEmailForDeletion || 'UNKNOWN (will try all)')

      const eventIdForDeletion = currentEventIdForDeletion || existingEventId
      let deleted = false

      // If we know the installer, try to delete from their calendar first
      if (currentInstallerEmailForDeletion) {
        try {
          const instCalendarId = await CalendarIdManager.getResolvedCalendarId(currentInstallerEmailForDeletion)
          console.log(`   Attempting to delete from ${currentInstallerEmailForDeletion}'s calendar (${instCalendarId})`)

          await larkService.deleteCalendarEvent(instCalendarId, eventIdForDeletion, currentInstallerEmailForDeletion)
          console.log(`   ✅ Successfully deleted from current installer's calendar`)
          deleted = true
        } catch (err) {
          console.log(`   ⚠️ Failed to delete from current installer's calendar:`, err)
          // Fall through to try other installers
        }
      }

      // If we couldn't delete from the known installer, try all installers as fallback
      if (!deleted && locationConfig.installers) {
        console.log('   📋 Falling back to trying all installers...')
        for (const inst of locationConfig.installers) {
          if (!inst.isActive) continue

          try {
            const instCalendarId = await CalendarIdManager.getResolvedCalendarId(inst.email)
            console.log(`   Attempting to delete from ${inst.name}'s calendar (${instCalendarId})`)

            await larkService.deleteCalendarEvent(instCalendarId, eventIdForDeletion, inst.email)
            console.log(`   ✅ Successfully deleted from ${inst.name}'s calendar`)
            deleted = true
            break
          } catch (err) {
            console.log(`   ⚠️ Not found in ${inst.name}'s calendar, trying next...`)
          }
        }
      }

      if (deleted) {
        console.log('✅ Successfully cancelled existing installation event')
      } else {
        console.log('⚠️ Could not find/delete existing event in any installer calendar')
        // Continue anyway - the event might have been manually deleted
      }
    } catch (cancelError) {
      console.error('⚠️ Failed to cancel existing installation event:', cancelError)
      // Continue with new booking even if cancellation fails
    }
  } else {
    console.log('📝 New installation booking (no existing event to cancel)')
  }
  
  // Create calendar event using the existing larkService
  let eventResponse: any
  let eventId: string

  // Use Onboarding Trainer Name (e.g., "Nasi Lemak") for the merchant field in description
  // merchantDetails.name is always the correct Onboarding_Trainer__c.Name field
  const merchantDisplayName = merchantDetails.name || merchantName

  console.error(`🏷️ [EVENT-TITLE] merchantDetails.name: ${merchantDetails.name}`)
  console.error(`🏷️ [EVENT-TITLE] merchantName (parameter): ${merchantName}`)
  console.error(`🏷️ [EVENT-TITLE] merchantDisplayName (final): ${merchantDisplayName}`)

  const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchantId}/view`

  // Build description with visual separators for Lark calendar popup readability
  // Lark calendar popup doesn't render \n newlines, so we use | separators
  let eventDescription = ''

  // Add pilot merchant note
  eventDescription += `⚠️ Pilot merchant. Intercom ticket creation required`

  // Merchant and address
  eventDescription += ` | 🏪 Merchant: ${merchantDetails.name || merchantName}`
  if (merchantDetails.address) {
    eventDescription += ` | 📍 Store: ${merchantDetails.address}`
  }

  // Primary contact - compact format
  const contactName = merchantDetails.primaryContactName || 'N/A'
  const contactRole = merchantDetails.primaryContactRole || ''
  const contactPhone = merchantDetails.primaryContactPhone || 'N/A'
  const contactEmail = merchantDetails.primaryContactEmail || ''

  let contactInfo = `👤 Contact: ${contactName}`
  if (contactRole) contactInfo += ` (${contactRole})`
  contactInfo += ` - ${contactPhone}`
  if (contactEmail) contactInfo += ` - ${contactEmail}`
  eventDescription += ` | ${contactInfo}`

  // Hardware list - compact format
  const hardwareText = hardwareList.length > 0
    ? hardwareList.join(', ')
    : 'No hardware items'
  eventDescription += ` | 📦 Hardware: ${hardwareText}`

  // Onboarding summary if available
  if (merchantDetails.onboardingSummary && merchantDetails.onboardingSummary !== 'N/A') {
    eventDescription += ` | 📝 Summary: ${merchantDetails.onboardingSummary}`
  }

  // Onboarding Manager - compact format
  let msmInfo = `👔 Manager: ${merchantDetails.msmName || 'N/A'}`
  if (merchantDetails.msmEmail) msmInfo += ` - ${merchantDetails.msmEmail}`
  eventDescription += ` | ${msmInfo}`

  // Salesforce link
  eventDescription += ` | 🔗 Salesforce: ${salesforceUrl}`

  // Event title should be simple - just the installation type and merchant name
  // All details go in the description
  const eventSummaryWithDetails = `Installation: ${merchantDisplayName}`

  console.log('📋 Event Summary:')
  console.log('   eventSummaryWithDetails:', eventSummaryWithDetails)

  // Build attendees list
  const attendees = []
  
  // Add installer as attendee
  if (installer.email) {
    attendees.push({ email: installer.email })
  }
  
  // Add merchant contact if available
  if (merchantDetails.primaryContactEmail) {
    attendees.push({ email: merchantDetails.primaryContactEmail })
  }
  
  // Add MSM if email is available
  if (merchantDetails.msmEmail) {
    attendees.push({ email: merchantDetails.msmEmail })
  }

  // Log the event description for debugging
  console.log('📝 Event Description being sent to Lark:')
  console.log('=====================================')
  console.log(eventDescription)
  console.log('=====================================')
  console.log('Description length:', eventDescription.length, 'characters')
  console.log('Attendees:', attendees)

  // Prepare the event object with proper structure
  const eventObject: any = {
    summary: eventSummaryWithDetails,  // Include key details in summary for better visibility
    description: eventDescription,
    start_time: {
      timestamp: Math.floor(new Date(`${date}T${timeSlot.start}:00+08:00`).getTime() / 1000).toString(),
      timezone: 'Asia/Singapore'
    },
    end_time: {
      timestamp: Math.floor(new Date(`${date}T${timeSlot.end}:00+08:00`).getTime() / 1000).toString(),
      timezone: 'Asia/Singapore'
    },
    visibility: 'default',
    need_notification: false
  }

  // Only add attendees if we have any
  if (attendees.length > 0) {
    eventObject.attendees = attendees
  }

  // Don't add location field - Lark API has strict validation
  // Address is already included in the event description

  console.log('📤 Full event object:', JSON.stringify(eventObject, null, 2))

  try {
    eventResponse = await larkService.createCalendarEvent(
      calendarId,
      eventObject,
      installer.email // Pass email as third parameter for user context
    )
    
    // The Lark API might return the event ID in different places
    eventId = (eventResponse as any)?.event?.event_id || eventResponse?.event_id
    console.log('✅ Calendar event created successfully:', eventId)
  } catch (calendarError: any) {
    console.error('❌ Calendar creation failed:', calendarError.message)
    
    // Throw error to fail the booking instead of using mock
    throw new Error(`Failed to create calendar event: ${calendarError.message || 'Please check Lark calendar permissions.'}`)
  }
  
  console.log('📅 Created new installation event:', {
    eventId: eventId,
    eventIdLength: eventId?.length,
    fullResponse: JSON.stringify(eventResponse, null, 2)
  })

  // Note: Notification will be sent later using sendBookingNotification() after Salesforce update

  // Update Salesforce - using the same pattern as training bookings (reuse conn from above)
  let newSalesforceEventId: string | null = null
  if (conn) {
    try {
      // merchantId is already the Salesforce record ID (just like in training bookings)
      console.log(`🔍 Updating Salesforce record with ID: ${merchantId}`)
      
      // Prepare date in correct format (Date field, not DateTime)
      const dateOnly = date.split('T')[0]
      console.log(`📅 Converting date for Salesforce: ${date} -> ${dateOnly}`)

      // Prepare DateTime format with timezone for Installation_Date_Time__c
      const installationDateTime = `${date}T${timeSlot.start}:00+08:00`  // Singapore timezone (GMT+8)
      console.log(`📅 Installation DateTime for Salesforce: ${installationDateTime}`)

      // Update Onboarding_Trainer__c with both installation date and datetime fields
      // NOTE: We do NOT update Assigned_Installer__c here - that field is for external vendors only
      // Internal installer assignment is tracked in Onboarding_Portal__c.Installer_Name__c
      const updateData: any = {
        Id: merchantId,  // Use merchantId directly as it's already the record ID
        Installation_Date__c: dateOnly,  // Date only field
        Installation_Date_Time__c: installationDateTime  // DateTime field with timezone
      }

      console.log('📦 Update data for Onboarding_Trainer__c:', JSON.stringify(updateData, null, 2))

      // Update Onboarding_Trainer__c with installation date and datetime
      let updateResult: any
      try {
        updateResult = await conn.sobject('Onboarding_Trainer__c').update(updateData)
        console.log('✅ Salesforce Onboarding_Trainer__c update result:', JSON.stringify(updateResult, null, 2))
      } catch (updateError: any) {
        console.log('❌ Failed to update Onboarding_Trainer__c:', updateError.message)
        // Don't throw - allow booking to succeed even if Salesforce update fails
      }

      if (!updateResult || !updateResult.success) {
        console.error(`❌ Onboarding_Trainer__c update failed:`, updateResult)
        // Don't throw - allow booking to succeed even if Salesforce update fails
      }

      // Create or Update Salesforce Event for installer KPI tracking (BEFORE Portal update so we have the Event ID)
      try {
        // Look up installer's Salesforce User ID
        let installerUserId: string | null = null

        try {
          console.log('🔍 Looking up Salesforce User for installer:', {
            name: assignedInstaller,
            email: installer.email
          })

          // Strategy 1: Search by email (most reliable)
          let searchQuery = `SELECT Id, Name, Email, IsActive FROM User WHERE Email = '${installer.email}' AND IsActive = true LIMIT 1`
          console.log('🔍 Searching by email:', searchQuery)
          let searchResult = await conn.query(searchQuery)
          console.log('   Result:', searchResult.totalSize, 'record(s) found')

          // Strategy 2: If email search fails, try by name
          if (searchResult.totalSize === 0) {
            searchQuery = `SELECT Id, Name, Email, IsActive FROM User WHERE Name = '${assignedInstaller}' AND IsActive = true LIMIT 1`
            console.log('🔍 Searching by name:', searchQuery)
            searchResult = await conn.query(searchQuery)
            console.log('   Result:', searchResult.totalSize, 'record(s) found')
          }

          if (searchResult.records && searchResult.records.length > 0) {
            installerUserId = searchResult.records[0].Id
            const foundUser = searchResult.records[0] as any
            console.log('✅ Found User:', {
              id: installerUserId,
              name: foundUser.Name,
              email: foundUser.Email
            })
          } else {
            console.log('❌ No User found for installer')
          }
        } catch (userSearchError) {
          console.error('Error searching for installer User:', userSearchError)
        }

        // Only create/update Event if we found the installer User ID
        if (installerUserId) {
          const dateTimeStart = `${date}T${timeSlot.start}:00+08:00`
          const dateTimeEnd = `${date}T${timeSlot.end}:00+08:00`

          // Build event description
          let eventDescription = `Merchant: ${merchantName}\n`
          eventDescription += `Address: ${merchantDetails.address}\n`
          eventDescription += `Contact: ${merchantDetails.contactName}\n`
          eventDescription += `Phone: ${merchantDetails.contactNumber}\n`

          if (merchantDetails.hardwareItems) {
            eventDescription += `Hardware Items: ${merchantDetails.hardwareItems}\n`
          }

          eventDescription += `\nSalesforce: https://test.salesforce.com/${merchantId}`

          const eventParams = {
            subject: `Installation - ${merchantName}`,
            startDateTime: dateTimeStart,
            endDateTime: dateTimeEnd,
            ownerId: installerUserId,
            whatId: merchantId,
            type: 'Face to face',
            description: eventDescription,
            location: merchantDetails.address
          }

          // Check if this is a reschedule with existing Salesforce Event
          if (existingEventId && currentSalesforceEventId) {
            // RESCHEDULING: Update existing Event
            console.log('🔄 Rescheduling: Updating existing Salesforce Event:', currentSalesforceEventId)
            const updated = await updateSalesforceEvent(currentSalesforceEventId, eventParams)
            if (updated) {
              console.log('✅ Salesforce Event updated for reschedule:', currentSalesforceEventId)
              newSalesforceEventId = currentSalesforceEventId // Keep same Event ID
            } else {
              console.log('⚠️ Salesforce Event update failed, but booking succeeded')
            }
          } else {
            // NEW BOOKING: Create new Event
            console.log('📝 New booking: Creating new Salesforce Event')
            const createdEventId = await createSalesforceEvent(eventParams)
            if (createdEventId) {
              console.log('✅ Salesforce Event created for installer KPI tracking:', createdEventId)
              newSalesforceEventId = createdEventId
            } else {
              console.log('⚠️ Salesforce Event creation failed, but booking succeeded')
            }
          }
        } else {
          console.log('⚠️ Skipping Salesforce Event creation/update - installer User ID not found')
        }
      } catch (eventError) {
        console.error('Salesforce Event creation/update failed but booking succeeded:', eventError)
        // Don't fail the booking if Event creation/update fails
      }

      // Store the Lark event ID and installer name in Onboarding_Portal__c object
      console.error(`📝 [PORTAL-SAVE] Storing event ID in Onboarding_Portal__c.Installation_Event_ID__c: ${eventId}`)
      console.error(`📏 [PORTAL-SAVE] Event ID length: ${eventId?.length} characters`)
      console.error(`🔍 [PORTAL-SAVE] Merchant ID: ${merchantId}`)
      console.error(`👤 [PORTAL-SAVE] Installer: ${assignedInstaller}`)

      try {
        
        // Now find the Portal record
        const portalQuery = `
          SELECT Id
          FROM Onboarding_Portal__c
          WHERE Onboarding_Trainer_Record__c = '${merchantId}'
          LIMIT 1
        `
        console.error(`🔎 [PORTAL-SAVE] Running query: ${portalQuery}`)
        const portalResult = await conn.query(portalQuery)
        console.error(`📊 [PORTAL-SAVE] Query returned ${portalResult.totalSize} records`)

        if (portalResult.totalSize > 0) {
          const portalId = portalResult.records[0].Id
          console.error(`📝 [PORTAL-SAVE] Found Onboarding_Portal__c ID: ${portalId}`)

          // Update the Onboarding_Portal__c record with event ID, installer User ID, and datetime
          // Combine date and time slot start time for full datetime
          // Following timezone-handling-rules.md: Always use Singapore timezone explicitly
          const installationDateTime = `${date}T${timeSlot.start}:00+08:00`  // Singapore timezone (GMT+8)
          console.error(`📅 [PORTAL-SAVE] Date: ${date}, Time: ${timeSlot.start}`)
          console.error(`📅 [PORTAL-SAVE] Saving DateTime: ${installationDateTime}`)
          const updateData: any = {
            Id: portalId,
            Installation_Event_ID__c: eventId,
            Installation_Date__c: installationDateTime,  // Send with timezone offset, not UTC
            Installer_Name__c: assignedInstaller  // Save installer name as text
          }

          // Store Salesforce Event ID for future rescheduling
          if (newSalesforceEventId) {
            updateData.Installation_Salesforce_Event_ID__c = newSalesforceEventId
            console.error(`📝 [PORTAL-SAVE] Adding Installation_Salesforce_Event_ID__c: ${newSalesforceEventId}`)
          }

          console.error(`📦 [PORTAL-SAVE] Final update data:`, JSON.stringify(updateData, null, 2))
          const updateResult = await conn.sobject('Onboarding_Portal__c').update(updateData)
          console.error(`✅ [PORTAL-SAVE] Update result:`, JSON.stringify(updateResult))

          // Verify what was actually saved
          if (updateResult.success) {
            const verifyQuery = `
              SELECT Id, Installation_Event_ID__c, Installation_Date__c, Installer_Name__c
              FROM Onboarding_Portal__c
              WHERE Id = '${portalId}'
              LIMIT 1
            `
            const verifyResult = await conn.query(verifyQuery)
            if (verifyResult.totalSize > 0) {
              const savedRecord = verifyResult.records[0] as any
              console.error(`🔍 [PORTAL-SAVE] VERIFICATION - What was actually saved:`)
              console.error(`   - Installation_Event_ID__c: ${savedRecord.Installation_Event_ID__c}`)
              console.error(`   - Installation_Date__c: ${savedRecord.Installation_Date__c}`)
              console.error(`   - Installer_Name__c: ${savedRecord.Installer_Name__c}`)
            }
          }

          console.error(`✅ [PORTAL-SAVE] Successfully updated Onboarding_Portal__c`)
        } else {
          console.error(`⚠️ [PORTAL-SAVE] No Onboarding_Portal__c record found for Onboarding_Trainer_Record__c = ${merchantId}`)
          console.error(`🔧 [PORTAL-SAVE] Auto-creating Portal record for merchant...`)
          
          // Get merchant name for the Portal record
          const merchantQuery = `
            SELECT Name
            FROM Onboarding_Trainer__c
            WHERE Id = '${merchantId}'
            LIMIT 1
          `
          const merchantResult = await conn.query(merchantQuery)
          const merchantName = merchantResult.totalSize > 0 ? merchantResult.records[0].Name : 'Unknown Merchant'
          
          // Create the Portal record with all installation fields
          // Combine date and time slot start time for full datetime
          // Following timezone-handling-rules.md: Always use Singapore timezone explicitly
          const installationDateTime = `${date}T${timeSlot.start}:00+08:00`  // Singapore timezone (GMT+8)
          const createData: any = {
            Name: `Portal - ${merchantName}`,
            Onboarding_Trainer_Record__c: merchantId,
            Installation_Event_ID__c: eventId,
            Installation_Date__c: installationDateTime,  // Send with timezone offset, not UTC
            Installer_Name__c: assignedInstaller  // Save installer name as text
          }

          // Store Salesforce Event ID for future rescheduling
          if (newSalesforceEventId) {
            createData.Installation_Salesforce_Event_ID__c = newSalesforceEventId
            console.error(`📝 [PORTAL-SAVE] Adding Installation_Salesforce_Event_ID__c: ${newSalesforceEventId}`)
          }

          console.error(`📦 [PORTAL-SAVE] Final create data:`, JSON.stringify(createData, null, 2))
          const createResult = await conn.sobject('Onboarding_Portal__c').create(createData)
          console.error(`✅ [PORTAL-SAVE] Created new Portal record: ${createResult.id}`)
          console.error(`✅ [PORTAL-SAVE] Successfully created Onboarding_Portal__c with installer name: ${assignedInstaller}`)
        }
      } catch (portalError: any) {
        console.error(`❌ [PORTAL-SAVE] Error storing event ID in Onboarding_Portal__c:`, portalError.message)
        console.error(`   [PORTAL-SAVE] Full error:`, portalError)
        console.error(`   [PORTAL-SAVE] Event ID will not be saved, but booking will continue`)
      }

      // Verify the update
      const verifyQuery = `SELECT Id, Installation_Date__c, Installation_Date_Time__c, Assigned_Installer__c FROM Onboarding_Trainer__c WHERE Id = '${merchantId}'`
      const verifyResult = await conn.query(verifyQuery)
      if (verifyResult.records && verifyResult.records.length > 0) {
        const updated: any = verifyResult.records[0]
        console.log(`✔️ Verification - Installation_Date__c: ${updated.Installation_Date__c}`)
        console.log(`✔️ Verification - Installation_Date_Time__c: ${updated.Installation_Date_Time__c}`)
        console.log(`✔️ Verification - Assigned_Installer__c: ${updated.Assigned_Installer__c}`)
      }
    } catch (error) {
      console.error('Error updating Salesforce:', error)
      // Don't throw - allow the booking to succeed even if SF update fails
    }
  } else {
    console.log('⚠️ No Salesforce connection available')
  }
  
  // Send notification to the assigned installer
  try {
    await sendBookingNotification({
      merchantName,
      merchantId,
      date: date.split('T')[0], // Date only
      startTime: timeSlot.start,
      endTime: timeSlot.end,
      bookingType: 'installation',
      isRescheduling: !!existingEventId,
      assignedPersonName: assignedInstaller,
      assignedPersonEmail: installer.email,
      location: merchantDetails.address  // Add merchant address to notification
    })
    console.log('📧 Notification sent to installer:', installer.email)
  } catch (notificationError) {
    console.error('Notification failed but installation booking succeeded:', notificationError)
    // Don't fail the booking if notification fails
  }

  // Send notification to the Onboarding Manager (MSM)
  if (merchantDetails.msmEmail) {
    try {
      await sendManagerBookingNotification({
        merchantName,
        merchantId,
        date: date.split('T')[0], // Date only
        startTime: timeSlot.start,
        endTime: timeSlot.end,
        bookingType: 'installation',
        isRescheduling: !!existingEventId,
        assignedPersonName: assignedInstaller,
        assignedPersonEmail: merchantDetails.msmEmail, // Manager email
        location: merchantDetails.address,
        contactPerson: merchantDetails.primaryContactName,
        contactPhone: merchantDetails.primaryContactPhone
      })
      console.log('📧 Manager notification sent to MSM:', merchantDetails.msmEmail)
    } catch (managerNotificationError) {
      console.error('Manager notification failed but installation booking succeeded:', managerNotificationError)
      // Don't fail the booking if notification fails
    }
  } else {
    console.log('⚠️ No MSM email found - skipping manager notification')
  }

  // Create Salesforce Task for internal installation booking/rescheduling
  if (merchantDetails.msmEmail) {
    try {
      const msmUserId = await getMsmSalesforceUserId(merchantDetails.msmEmail)

      if (msmUserId) {
        const formattedDate = new Date(date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })

        const isRescheduling = !!existingEventId
        const taskType = isRescheduling ? 'INTERNAL_INSTALLATION_RESCHEDULING' : 'INTERNAL_INSTALLATION_BOOKING'
        const actionText = isRescheduling ? 'RESCHEDULED' : 'BOOKED'

        const taskResult = await createSalesforceTask({
          subject: `[Portal] Check internal installation booking for ${merchantName}`,
          description: `Merchant: ${merchantName}

Installation ${actionText} via Portal

Date: ${formattedDate}
Time: ${timeSlot.start} - ${timeSlot.end}
Installer: ${assignedInstaller}

Location: ${merchantDetails.address || 'N/A'}
Contact: ${merchantDetails.primaryContactName || 'N/A'}
Phone: ${merchantDetails.primaryContactPhone || 'N/A'}

🔗 Salesforce: ${getSalesforceRecordUrl(merchantId)}`,
          status: 'Open',
          priority: 'Normal',
          ownerId: msmUserId,
          whatId: merchantId,
          activityDate: getTodayDateString()
        })

        if (taskResult.success && taskResult.taskId) {
          await prisma.salesforceTaskTracking.create({
            data: {
              taskId: taskResult.taskId,
              trainerId: merchantId,
              taskType: taskType,
              merchantName,
              msmEmail: merchantDetails.msmEmail
            }
          })
          console.log(`✅ Salesforce Task created for installation ${isRescheduling ? 'rescheduling' : 'booking'}: ${taskResult.taskId}`)
        } else {
          console.log(`⚠️ Failed to create Salesforce Task: ${taskResult.error}`)
        }
      } else {
        console.log(`⚠️ No Salesforce User found for ${merchantDetails.msmEmail}, skipping task creation`)
      }
    } catch (taskError) {
      console.error('❌ Failed to create Salesforce Task for installation:', taskError)
      // Don't fail the booking if task creation fails
    }
  }

  return {
    success: true,
    assignedInstaller: assignedInstaller,
    eventId: eventId,
    date: date.split('T')[0], // Return date only, without time
    time: timeSlot.label
  }
}

// Submit external installation request (vendor will call back)
export async function submitExternalInstallationRequest(
  merchantId: string,
  merchantName: string,
  preferredDate: string,
  preferredTime: string,
  contactPhone: string
) {
  // Read installers config dynamically to pick up changes without restart
  const installersConfig = await loadInstallersConfig()

  const vendor = installersConfig.external.vendors.find((v: any) => v.isActive)
  
  if (!vendor) {
    throw new Error('No external vendor available')
  }
  
  // Update Salesforce with request using correct field names
  const conn = await getSalesforceConnection()
  if (conn) {
    try {
      // Prepare date in correct format (Date field only, no time)
      const dateOnly = preferredDate.split('T')[0]
      console.log(`📅 External vendor - Converting date for Salesforce: ${preferredDate} -> ${dateOnly}`)
      
      // For external vendors, use the preferred time from the booking
      // Convert time (e.g., "14:00") to datetime format with Singapore timezone
      const installationDateTime = `${dateOnly}T${preferredTime}:00+08:00`  // Singapore timezone (GMT+8)
      console.log(`📅 External vendor - Installation DateTime for Salesforce: ${installationDateTime} (from preferred time: ${preferredTime})`)
      
      const updateData = {
        Id: merchantId,
        Installation_Date__c: dateOnly,  // Date only field
        Installation_Date_Time__c: installationDateTime  // DateTime field with timezone
        // Don't update status or installer fields for external vendors - just save the date
      }
      
      console.log('📦 External vendor update data:', JSON.stringify(updateData, null, 2))
      
      await conn.sobject('Onboarding_Trainer__c').update(updateData)
      
      console.log('✅ Updated Salesforce Onboarding_Trainer__c with external vendor assignment')
      
      // Also update the Onboarding_Portal__c object with the installation date
      try {
        const portalQuery = `
          SELECT Id
          FROM Onboarding_Portal__c
          WHERE Onboarding_Trainer_Record__c = '${merchantId}'
          LIMIT 1
        `
        console.log(`🔎 Looking for Onboarding_Portal__c record for merchant: ${merchantId}`)
        const portalResult = await conn.query(portalQuery)
        
        if (portalResult.totalSize > 0) {
          const portalId = portalResult.records[0].Id
          console.log(`📝 Found Onboarding_Portal__c ID: ${portalId}`)

          // Update the Onboarding_Portal__c record with the installation date
          // For external vendors, set the Installer_Name__c field to "External Vendor"
          const portalUpdateData = {
            Id: portalId,
            Installation_Date__c: installationDateTime,  // DateTime field with timezone
            Installer_Name__c: 'External Vendor'  // Set installer name for external vendors
          }

          const portalUpdateResult = await conn.sobject('Onboarding_Portal__c').update(portalUpdateData)
          console.log(`✅ Updated Onboarding_Portal__c.Installation_Date__c and set Installer_Name__c to "External Vendor":`, JSON.stringify(portalUpdateResult))
        } else {
          console.log(`⚠️ No Onboarding_Portal__c record found for merchant ${merchantId}`)
          
          // Create the Portal record if it doesn't exist
          const merchantQuery = `
            SELECT Name
            FROM Onboarding_Trainer__c
            WHERE Id = '${merchantId}'
            LIMIT 1
          `
          const merchantResult = await conn.query(merchantQuery)
          const merchantName = merchantResult.totalSize > 0 ? merchantResult.records[0].Name : 'Unknown Merchant'

          // For external vendors, set Installer_Name__c to "External Vendor"
          const createData = {
            Name: `Portal - ${merchantName}`,
            Onboarding_Trainer_Record__c: merchantId,
            Installation_Date__c: installationDateTime,  // DateTime field with timezone
            Installer_Name__c: 'External Vendor'  // Set installer name for external vendors
          }

          const createResult = await conn.sobject('Onboarding_Portal__c').create(createData)
          console.log(`✅ Created new Portal record with Installation_Date__c and Installer_Name__c set to "External Vendor": ${createResult.id}`)
        }
      } catch (portalError) {
        console.error('Failed to update Onboarding_Portal__c:', portalError)
        // Don't fail the main request if portal update fails
      }
    } catch (error) {
      console.error('Failed to update Salesforce:', error)
      // Don't fail the request if Salesforce update fails
    }
  }
  
  // Notify the onboarding manager (MSM) about external vendor assignment
  try {
    // Fetch merchant details and MSM info from Salesforce
    const merchantQuery = `
      SELECT
        Email__c,
        Shipping_Street__c,
        Shipping_City__c,
        Shipping_State__c,
        Shipping_Zip_Postal_Code__c,
        Shipping_Country__c,
        MSM_Name__r.Email,
        MSM_Name__r.Name,
        MSM_Name__r.Phone,
        Account_Name__r.Id
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    const merchantResult = await conn.query(merchantQuery)
    console.log(`🔍 [SURFTEK-DEBUG] Merchant query returned ${merchantResult.totalSize} records`)

    if (merchantResult.totalSize > 0) {
      const merchant = merchantResult.records[0]
      const msmEmail = merchant.MSM_Name__r?.Email
      const msmName = merchant.MSM_Name__r?.Name
      const msmPhone = merchant.MSM_Name__r?.Phone
      const merchantEmail = merchant.Email__c

      console.log(`🔍 [SURFTEK-DEBUG] MSM lookup result:`)
      console.log(`   - MSM_Name__r object: ${JSON.stringify(merchant.MSM_Name__r)}`)
      console.log(`   - msmEmail: ${msmEmail || 'NOT FOUND'}`)
      console.log(`   - msmName: ${msmName || 'NOT FOUND'}`)
      console.log(`   - merchantEmail: ${merchantEmail || 'NOT FOUND'}`)

      // Build store address
      const addressParts = [
        merchant.Shipping_Street__c,
        merchant.Shipping_City__c,
        merchant.Shipping_State__c,
        merchant.Shipping_Zip_Postal_Code__c,
        merchant.Shipping_Country__c
      ].filter(Boolean)
      const storeAddress = addressParts.join(', ') || 'Not provided'

      // Fetch order and hardware details
      let orderNumber = 'Not available'
      let hardwareItems: string[] = []

      if (merchant.Account_Name__r?.Id) {
        try {
          // Query for all orders for this account
          const orderQuery = `
            SELECT Id, NSOrderNumber__c, Type
            FROM Order
            WHERE AccountId = '${merchant.Account_Name__r.Id}'
            ORDER BY CreatedDate DESC
          `
          const orderResult = await conn.query(orderQuery)

          if (orderResult.totalSize > 0) {
            // Get all order IDs
            const orderIds = orderResult.records.map((order: any) => `'${order.Id}'`).join(',')

            // Find the first order with NSOrderNumber__c
            const orderWithNumber = orderResult.records.find((order: any) => order.NSOrderNumber__c)
            if (orderWithNumber) {
              orderNumber = orderWithNumber.NSOrderNumber__c
            }

            // Query for all order items across all orders
            const orderItemsQuery = `
              SELECT Product2.Name, Quantity
              FROM OrderItem
              WHERE OrderId IN (${orderIds})
            `
            const itemsResult = await conn.query(orderItemsQuery)

            if (itemsResult.totalSize > 0) {
              hardwareItems = itemsResult.records.map((item: any) =>
                `${item.Product2?.Name || 'Unknown Product'} (Qty: ${item.Quantity || 1})`
              )
            }
          }
        } catch (orderError) {
          console.error('Failed to fetch order details:', orderError)
        }
      }

      if (msmEmail) {
        console.log(`📧 Notifying onboarding manager: ${msmName} (${msmEmail})`)

        // ============================================================
        // SURFTEK API INTEGRATION
        // Automatically create installation ticket on Surftek system
        // ============================================================
        let surftekTicketId: number | null = null
        let surftekCaseNum: string | null = null

        try {
          // Fetch onboarding summary for device type detection
          const summaryQuery = `
            SELECT Onboarding_Summary__c, Merchant_PIC_Name__c, Merchant_PIC_Contact_Number__c
            FROM Onboarding_Trainer__c
            WHERE Id = '${merchantId}'
            LIMIT 1
          `
          const summaryResult = await conn.query(summaryQuery)
          const onboardingSummary = summaryResult.records[0]?.Onboarding_Summary__c || ''
          const picName = summaryResult.records[0]?.Merchant_PIC_Name__c || merchantName
          const picPhone = summaryResult.records[0]?.Merchant_PIC_Contact_Number__c || contactPhone

          // Convert hardware items to OrderItem format for device detection
          const orderItemsForDetection: OrderItem[] = hardwareItems.map(item => ({
            productName: item.split(' (Qty:')[0] // Remove quantity suffix
          }))

          // Detect device type (Android vs iOS)
          const deviceType = await getDeviceType(orderItemsForDetection, onboardingSummary)
          console.log(`📱 Detected device type: ${deviceType}`)

          // Prepare merchant details for Surftek API
          const merchantDetails: MerchantDetails = {
            merchantName,
            merchantId,
            address: storeAddress,
            contactName: picName,
            contactPhone: picPhone,
            contactEmail: merchantEmail || undefined,
            msmName: msmName || undefined,
            hardwareItems,
            onboardingSummary,
            preferredDate,
            preferredTime
          }

          // Create ticket on Surftek
          console.log('🎫 Creating Surftek ticket...')
          const ticketResult = await createTicketForMerchant(merchantDetails, deviceType)

          if (ticketResult) {
            surftekTicketId = ticketResult.ticketId
            surftekCaseNum = ticketResult.caseNum
            console.log(`✅ Surftek ticket created: ${surftekCaseNum} (ID: ${surftekTicketId})`)

            // Store Surftek ticket info in Onboarding_Portal__c
            try {
              const portalQuery = `
                SELECT Id
                FROM Onboarding_Portal__c
                WHERE Onboarding_Trainer_Record__c = '${merchantId}'
                LIMIT 1
              `
              const portalResult = await conn.query(portalQuery)

              if (portalResult.totalSize > 0) {
                const portalId = portalResult.records[0].Id
                await conn.sobject('Onboarding_Portal__c').update({
                  Id: portalId,
                  Surftek_Ticket_ID__c: String(surftekTicketId),
                  Surftek_Case_Number__c: surftekCaseNum
                })
                console.log(`✅ Stored Surftek ticket info in Onboarding_Portal__c`)
              }
            } catch (portalError) {
              console.error('Failed to store Surftek ticket info:', portalError)
              // Don't fail - ticket was already created
            }
          } else {
            console.log('⚠️ Surftek ticket creation failed, falling back to manual flow')
          }
        } catch (surftekError) {
          console.error('❌ Surftek API error, falling back to manual flow:', surftekError)
          // Continue with manual flow - don't fail the booking
        }

        // ============================================================
        // MANUAL FALLBACK FLOW
        // If Surftek API fails, continue with existing MSM notification flow
        // ============================================================

        await sendExternalVendorNotificationToManager(
          msmEmail,
          merchantName,
          merchantId,
          merchantEmail,
          storeAddress,
          preferredDate,
          preferredTime,
          orderNumber,
          hardwareItems,
          msmName || 'Not available',
          msmPhone || 'Not available',
          surftekCaseNum // Pass Surftek case number if available
        )

        // Create record in Lark base for task management (only if we have MSM email)
        try {
          const baseAppToken = process.env.LARK_EXTERNAL_VENDOR_BASE_TOKEN
          const baseTableId = process.env.LARK_EXTERNAL_VENDOR_TABLE_ID

          if (!baseAppToken || !baseTableId) {
            console.log('⚠️ Lark base configuration not found, skipping base record creation')
          } else {
            const baseFields = await mapToExternalVendorLarkBase(
              {
                merchantName,
                merchantId,
                msmEmail,
                msmName: msmName || 'Not available',
                preferredDate,
                preferredTime
              },
              larkService
            )

            const record = await larkService.createBitableRecord(
              baseAppToken,
              baseTableId,
              baseFields,
              msmEmail
            )

            console.log('✅ External vendor request added to Lark base:', record.record_id)
          }
        } catch (baseError) {
          console.error('❌ Failed to create Lark base record:', baseError)
          // Don't fail the entire booking if base creation fails
        }

        // Create Salesforce Task for external vendor booking (always create new task for every booking/reschedule)
        try {
          // Get MSM Salesforce User ID
          const msmUserId = await getMsmSalesforceUserId(msmEmail)

          if (msmUserId) {
            // Format date and time for display
            const formattedDate = new Date(preferredDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })
            const formattedTime = preferredTime

            // Format hardware list
            const hardwareList = hardwareItems.length > 0
              ? hardwareItems.map(item => `  - ${item}`).join('\n')
              : '  - Not available'

            // Create task in Salesforce
            const taskResult = await createSalesforceTask({
              subject: `[Portal] Book / check external installation booking for ${merchantName}`,
              description: `Merchant: ${merchantName}
Store Address: ${storeAddress}

ACTION REQUIRED: Book installation on external vendor website

Requested Date: ${formattedDate}
Requested Time: ${formattedTime}

Hardware:
${hardwareList}

Merchant Email: ${merchantEmail || 'Not available'}
Sales Order: ${orderNumber}

🔗 Salesforce: ${getSalesforceRecordUrl(merchantId)}`,
              status: 'Open',
              priority: 'Normal',
              ownerId: msmUserId,
              whatId: merchantId,
              activityDate: getTodayDateString() // Due date is today (when booking was made)
            })

            if (taskResult.success && taskResult.taskId) {
              // Track task in database
              await prisma.salesforceTaskTracking.create({
                data: {
                  taskId: taskResult.taskId,
                  trainerId: merchantId,
                  taskType: 'EXTERNAL_VENDOR_BOOKING',
                  merchantName,
                  msmEmail
                }
              })
              console.log(`✅ Salesforce Task created: ${taskResult.taskId}`)
            } else {
              console.log(`⚠️ Failed to create Salesforce Task: ${taskResult.error}`)
            }
          } else {
            console.log(`⚠️ No Salesforce User found for ${msmEmail}, skipping task creation`)
          }
        } catch (taskError) {
          console.error('❌ Failed to create Salesforce Task:', taskError)
          // Don't fail the booking if task creation fails
        }
      } else {
        console.log('⚠️ [SURFTEK-DEBUG] No MSM email found - SKIPPING Surftek ticket creation!')
        console.log('⚠️ [SURFTEK-DEBUG] To fix: Ensure MSM_Name__c lookup field is populated in Salesforce for this merchant')
      }
    } else {
      console.log('⚠️ [SURFTEK-DEBUG] No merchant record found - SKIPPING Surftek ticket creation!')
    }
  } catch (notifyError) {
    console.error('Failed to notify onboarding manager:', notifyError)
    // Don't fail the request if notification fails
  }

  // Log the request
  console.log('External installation request:', {
    vendor: vendor.name,
    merchant: merchantName,
    preferredDate,
    preferredTime,
    contactPhone
  })

  return {
    success: true,
    status: 'request_submitted',
    message: `${vendor.contactPerson} from ${vendor.name} will contact you within ${vendor.responseTime} to confirm your installation appointment.`,
    vendor: vendor.name
  }
}

