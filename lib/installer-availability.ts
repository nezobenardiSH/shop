import { getSalesforceConnection } from './salesforce'
import { larkService } from './lark'
import { sendBookingNotification, sendExternalVendorNotificationToManager } from './lark-notifications'
import fs from 'fs/promises'
import path from 'path'

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
             Shipping_City__c, Shipping_State__c
      FROM Onboarding_Trainer__c 
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    console.log('🔍 Querying installer type with:', { merchantId, query })
    
    const result = await conn.query(query)
    const record = result.records[0]
    const shippingCity = record?.Shipping_City__c
    const shippingState = record?.Shipping_State__c
    
    console.log('🔍 Installer type query result:', {
      merchantId,
      foundRecord: !!record,
      recordName: record?.Name,
      recordId: record?.Id,
      shippingCity,
      shippingState
    })
    
    // Determine location based on shipping address
    const normalizedCity = shippingCity?.toLowerCase().trim() || ''
    const normalizedState = shippingState?.toLowerCase().trim() || ''

    // Check if it's in Klang Valley
    const klangValleyCities = [
      'kuala lumpur', 'kl', 'petaling jaya', 'pj', 'subang jaya', 
      'shah alam', 'klang', 'puchong', 'selayang', 'ampang jaya',
      'kajang', 'seri kembangan', 'bangi', 'banting', 'cyberjaya',
      'putrajaya', 'sepang', 'kuala selangor', 'rawang', 'gombak'
    ]
    
    const isKlangValley = klangValleyCities.some(city => 
      normalizedCity.includes(city) || normalizedState.includes(city)
    ) || normalizedState === 'selangor' || normalizedState === 'wilayah persekutuan'

    if (isKlangValley) {
      console.log('✅ Detected Klang Valley - using internal installers')
      return 'internal'
    }

    // Check if it's Johor Bahru specifically (not just any city in Johor state)
    const isJohorBahru = normalizedCity.includes('johor bahru') ||
                        normalizedCity.includes('johor bharu') ||
                        normalizedCity === 'jb' ||
                        normalizedCity === 'j.b'

    if (isJohorBahru) {
      console.log('✅ Detected Johor Bahru - using internal installers')
      return 'internal'
    }

    // Check if it's Penang (we cover all of Penang)
    const isPenang = normalizedCity.includes('penang') ||
                    normalizedCity.includes('pulau pinang') ||
                    normalizedState.includes('penang') ||
                    normalizedState.includes('pulau pinang') ||
                    normalizedCity.includes('georgetown') ||
                    normalizedCity.includes('george town')

    if (isPenang) {
      console.log('✅ Detected Penang - using internal installers')
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
      SELECT Shipping_City__c, Shipping_State__c
      FROM Onboarding_Trainer__c 
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    const result = await conn.query(query)
    const shippingCity = result.records[0]?.Shipping_City__c
    const shippingState = result.records[0]?.Shipping_State__c
    
    const normalizedCity = shippingCity?.toLowerCase().trim() || ''
    const normalizedState = shippingState?.toLowerCase().trim() || ''
    
    // Check for Klang Valley
    const klangValleyCities = [
      'kuala lumpur', 'kl', 'petaling jaya', 'pj', 'subang jaya', 
      'shah alam', 'klang', 'puchong', 'selayang', 'ampang jaya',
      'kajang', 'seri kembangan', 'bangi', 'banting', 'cyberjaya',
      'putrajaya', 'sepang', 'kuala selangor', 'rawang', 'gombak'
    ]
    
    const isKlangValley = klangValleyCities.some(city => 
      normalizedCity.includes(city) || normalizedState.includes(city)
    ) || normalizedState === 'selangor' || normalizedState === 'wilayah persekutuan'
    
    if (isKlangValley) {
      return 'klangValley'
    }
    
    // Check for Johor Bahru specifically
    const isJohorBahru = normalizedCity.includes('johor bahru') ||
                        normalizedCity.includes('johor bharu') ||
                        normalizedCity === 'jb' ||
                        normalizedCity === 'j.b'
    
    if (isJohorBahru) {
      return 'johorBahru'
    }
    
    // Check for Penang
    const isPenang = normalizedCity.includes('penang') ||
                    normalizedCity.includes('pulau pinang') ||
                    normalizedState.includes('penang') ||
                    normalizedState.includes('pulau pinang') ||
                    normalizedCity.includes('georgetown') ||
                    normalizedCity.includes('george town')
    
    if (isPenang) {
      return 'penang'
    }
    
    return 'external'
  } catch (error) {
    console.error('Error getting location category:', error)
    return 'external'
  }
}

// Check availability for internal installers (using same mechanism as trainers)
export async function getInternalInstallersAvailability(
  startDate: string,
  endDate: string,
  merchantId?: string
): Promise<InstallerAvailability[]> {
  console.log('Getting installer availability...')
  
  // Read installers config dynamically to pick up changes without restart
  const configPath = path.join(process.cwd(), 'config', 'installers.json')
  const configContent = await fs.readFile(configPath, 'utf-8')
  const installersConfig = JSON.parse(configContent)

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

  // Parse dates directly as strings to avoid timezone conversion issues
  const start = new Date(startDate)
  const end = new Date(endDate)
  const current = new Date(start)

  while (current <= end) {
    const dayOfWeek = current.getUTCDay()

    // Only weekdays (Monday=1 to Friday=5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const year = current.getUTCFullYear()
      const month = String(current.getUTCMonth() + 1).padStart(2, '0')
      const day = String(current.getUTCDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
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
  existingEventId?: string
) {
  console.log('📦 bookInternalInstallation called with:', {
    merchantId,
    merchantIdLength: merchantId?.length,
    merchantIdType: typeof merchantId,
    merchantName,
    date,
    timeSlot,
    availableInstallers,
    existingEventId
  })

  // Read installers config dynamically to pick up changes without restart
  const configPath = path.join(process.cwd(), 'config', 'installers.json')
  const configContent = await fs.readFile(configPath, 'utf-8')
  const installersConfig = JSON.parse(configContent)

  // Get location category for the merchant
  const locationCategory = await getLocationCategory(merchantId)
  const locationKey = locationCategory === 'external' ? 'klangValley' : locationCategory

  const assignedInstaller = assignInstaller(availableInstallers)
  const locationConfig = (installersConfig as any)[locationKey] || installersConfig.klangValley
  
  // Find installer by name - handle both short names (from config) and full names (from Lark)
  let installer = locationConfig.installers.find((i: any) => i.name === assignedInstaller)
  
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
  
  console.log(`✅ Found installer: ${installer.name} (${installer.email})`)

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
  
  // If this is a rescheduling, cancel the existing event first
  if (existingEventId) {
    try {
      console.log('🗑️ Rescheduling detected - need to cancel existing event')
      console.log('   Event ID:', existingEventId)
      console.log('   Event ID length:', existingEventId.length)
      
      // For rescheduling, we need to try to delete from all installer calendars
      // since we don't know which installer originally created it
      let deleted = false
      
      // Try to delete from all active installers in the same location
      for (const inst of locationConfig.installers) {
        if (!inst.isActive) continue
        
        try {
          const instCalendarId = await CalendarIdManager.getResolvedCalendarId(inst.email)
          console.log(`   Attempting to delete from ${inst.name}'s calendar (${instCalendarId})`)
          
          await larkService.deleteCalendarEvent(instCalendarId, existingEventId, inst.email)
          console.log(`   ✅ Successfully deleted from ${inst.name}'s calendar`)
          deleted = true
          break // Event deleted successfully, no need to try other calendars
        } catch (err) {
          // This installer doesn't have the event, try next one
          console.log(`   ⚠️ Not found in ${inst.name}'s calendar, trying next...`)
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

  // Build description with structured formatting
  // Simplified version without emojis to test if Lark accepts it
  let eventDescription = ''

  // Add pilot merchant note
  eventDescription += `⚠️ Pilot merchant. Intercom ticket creation required\n\n`

  // Core installation details
  eventDescription += `Installation Details\n`
  eventDescription += `==================\n\n`
  
  eventDescription += `Merchant: ${merchantDetails.name || merchantName}\n`

  if (merchantDetails.address) {
    eventDescription += `\nStore Address:\n${merchantDetails.address}\n`
  }
  
  eventDescription += `\nPrimary Contact:\n`
  eventDescription += `- Name: ${merchantDetails.primaryContactName || 'N/A'}\n`
  eventDescription += `- Role: ${merchantDetails.primaryContactRole || 'N/A'}\n`
  eventDescription += `- Phone: ${merchantDetails.primaryContactPhone || 'N/A'}\n`
  if (merchantDetails.primaryContactEmail) {
    eventDescription += `- Email: ${merchantDetails.primaryContactEmail}\n`
  }
  
  eventDescription += `\nHardware List:\n`
  const simpleHardwareList = hardwareList.length > 0 
    ? hardwareList.map(item => `- ${item}`).join('\n')
    : '- No hardware items found'
  eventDescription += simpleHardwareList + '\n'
  
  if (merchantDetails.onboardingSummary && merchantDetails.onboardingSummary !== 'N/A') {
    eventDescription += `\nOnboarding Summary:\n${merchantDetails.onboardingSummary}\n`
  }
  
  eventDescription += `\nOnboarding Manager:\n`
  eventDescription += `- Name: ${merchantDetails.msmName || 'N/A'}\n`
  if (merchantDetails.msmPhone && merchantDetails.msmPhone !== 'N/A') {
    eventDescription += `- Phone: ${merchantDetails.msmPhone}\n`
  }
  if (merchantDetails.msmEmail) {
    eventDescription += `- Email: ${merchantDetails.msmEmail}\n`
  }
  
  eventDescription += `\nSalesforce: ${salesforceUrl}`

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
  const configPath = path.join(process.cwd(), 'config', 'installers.json')
  const configContent = await fs.readFile(configPath, 'utf-8')
  const installersConfig = JSON.parse(configContent)

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
          // For external vendors, clear the Installer_Name__c field (set to null)
          const portalUpdateData = {
            Id: portalId,
            Installation_Date__c: installationDateTime,  // DateTime field with timezone
            Installer_Name__c: null  // Clear installer name for external vendors
          }

          const portalUpdateResult = await conn.sobject('Onboarding_Portal__c').update(portalUpdateData)
          console.log(`✅ Updated Onboarding_Portal__c.Installation_Date__c and cleared Installer_Name__c:`, JSON.stringify(portalUpdateResult))
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

          // For external vendors, don't set Installer_Name__c (leave it null)
          const createData = {
            Name: `Portal - ${merchantName}`,
            Onboarding_Trainer_Record__c: merchantId,
            Installation_Date__c: installationDateTime  // DateTime field with timezone
            // Installer_Name__c is intentionally not set for external vendors
          }

          const createResult = await conn.sobject('Onboarding_Portal__c').create(createData)
          console.log(`✅ Created new Portal record with Installation_Date__c (no installer for external vendor): ${createResult.id}`)
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

    if (merchantResult.totalSize > 0) {
      const merchant = merchantResult.records[0]
      const msmEmail = merchant.MSM_Name__r?.Email
      const msmName = merchant.MSM_Name__r?.Name
      const msmPhone = merchant.MSM_Name__r?.Phone
      const merchantEmail = merchant.Email__c

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
          msmPhone || 'Not available'
        )
      } else {
        console.log('⚠️ No MSM email found for notification')
      }
    } else {
      console.log('⚠️ No merchant record found for notification')
    }
  } catch (notifyError) {
    console.error('Failed to notify onboarding manager:', notifyError)
    // Don't fail the request if notification fails
  }
  
  // TODO: Send email notification to vendor
  // For now, just log the request
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

