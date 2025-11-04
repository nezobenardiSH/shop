import { getSalesforceConnection } from './salesforce'
import { larkService } from './lark'
import { sendBookingNotification, sendExternalVendorNotificationToManager } from './lark-notifications'
import installersConfig from '../config/installers.json'

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

// Get the installer type based on merchant location from Salesforce
export async function getInstallerType(merchantId: string): Promise<'internal' | 'external'> {
  try {
    const conn = await getSalesforceConnection()
    if (!conn) {
      console.error('Failed to get Salesforce connection')
      return 'external' // Default to external if can't connect
    }

    const query = `
      SELECT Merchant_Location__c, Name, Id, Assigned_Installer__c,
             Shipping_City__c, Shipping_State__c
      FROM Onboarding_Trainer__c 
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    console.log('🔍 Querying installer type with:', { merchantId, query })
    
    const result = await conn.query(query)
    const record = result.records[0]
    const merchantLocation = record?.Merchant_Location__c
    const assignedInstaller = record?.Assigned_Installer__c
    const shippingCity = record?.Shipping_City__c
    const shippingState = record?.Shipping_State__c
    
    console.log('🔍 Installer type query result:', {
      merchantId,
      foundRecord: !!record,
      recordName: record?.Name,
      recordId: record?.Id,
      merchantLocation,
      assignedInstaller,
      shippingCity,
      shippingState
    })
    
    // Check if already assigned to external vendor (Surfstek)
    // This takes precedence over location-based logic
    if (assignedInstaller && assignedInstaller.toLowerCase() === 'surfstek') {
      console.log('📦 Assigned to Surfstek - treating as external vendor')
      return 'external'
    }
    
    // Check location value from Salesforce
    if (merchantLocation === 'Within Klang Valley') {
      return 'internal'
    } else if (merchantLocation === 'Penang') {
      return 'internal'
    } else if (merchantLocation === 'Johor Bahru') {
      return 'internal'
    } else if (merchantLocation === 'Outside of Klang Valley') {
      // Fallback: Check shipping address for specific cities we cover
      // We only cover Johor Bahru (not all of Johor) and Penang
      console.log('📍 Merchant location is "Outside of Klang Valley"')
      console.log('📍 Checking shipping city:', shippingCity)
      console.log('📍 Checking shipping state:', shippingState)

      const normalizedCity = shippingCity?.toLowerCase().trim() || ''
      const normalizedState = shippingState?.toLowerCase().trim() || ''

      // Check if it's Johor Bahru specifically (not just any city in Johor state)
      const isJohorBahru = normalizedCity.includes('johor bahru') ||
                          normalizedCity.includes('johor bharu') ||
                          normalizedCity === 'jb' ||
                          normalizedCity === 'j.b'

      if (isJohorBahru) {
        console.log('✅ Detected Johor Bahru - using internal installers (Johor Bahru team)')
        return 'internal'
      }

      // Check if it's Penang (we cover all of Penang)
      const isPenang = normalizedCity.includes('penang') ||
                      normalizedCity.includes('pulau pinang') ||
                      normalizedState.includes('penang') ||
                      normalizedState.includes('pulau pinang')

      if (isPenang) {
        console.log('✅ Detected Penang - using internal installers (Penang team)')
        return 'internal'
      }

      // Otherwise, it's truly outside our service areas (external vendor)
      console.log('❌ Location not in Johor Bahru or Penang - using external vendor')
      return 'external'
    } else if (merchantLocation === 'Others') {
      return 'external'
    }
    
    // Default to external if location not set
    return 'external'
  } catch (error) {
    console.error('Error getting installer type:', error)
    return 'external'
  }
}

// Get location category from merchant location
export async function getLocationCategory(merchantId: string): Promise<'klangValley' | 'penang' | 'johorBahru' | 'external'> {
  try {
    const conn = await getSalesforceConnection()
    if (!conn) {
      console.error('Failed to get Salesforce connection')
      return 'external'
    }
    const query = `
      SELECT Merchant_Location__c, Shipping_City__c, Shipping_State__c
      FROM Onboarding_Trainer__c 
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    const result = await conn.query(query)
    const merchantLocation = result.records[0]?.Merchant_Location__c
    const shippingCity = result.records[0]?.Shipping_City__c
    const shippingState = result.records[0]?.Shipping_State__c
    
    if (merchantLocation === 'Within Klang Valley') {
      return 'klangValley'
    } else if (merchantLocation === 'Penang') {
      return 'penang'
    } else if (merchantLocation === 'Johor Bahru') {
      return 'johorBahru'
    } else if (merchantLocation === 'Outside of Klang Valley') {
      // Fallback logic for location detection
      if ((shippingCity && (shippingCity.toLowerCase().includes('johor') || shippingCity.toLowerCase() === 'jb')) ||
          (shippingState && shippingState.toLowerCase().includes('johor'))) {
        return 'johorBahru'
      }
      if ((shippingCity && shippingCity.toLowerCase().includes('penang')) ||
          (shippingState && (shippingState.toLowerCase().includes('penang') || shippingState.toLowerCase().includes('pulau pinang')))) {
        return 'penang'
      }
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

  const current = new Date(`${startDate}T00:00:00+08:00`)
  const end = new Date(`${endDate}T23:59:59+08:00`)

  while (current <= end) {
    const dayOfWeek = current.getDay()

    // Only weekdays (Monday=1 to Friday=5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const day = String(current.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
      const slots = TIME_SLOTS.map(timeSlot => {
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
    
    current.setDate(current.getDate() + 1)
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

  // Get location category for the merchant
  const locationCategory = await getLocationCategory(merchantId)
  const locationKey = locationCategory === 'external' ? 'klangValley' : locationCategory
  
  const assignedInstaller = assignInstaller(availableInstallers)
  const locationConfig = (installersConfig as any)[locationKey] || installersConfig.klangValley
  const installer = locationConfig.installers.find((i: any) => i.name === assignedInstaller)

  if (!installer) {
    throw new Error('Installer configuration not found')
  }

  // Fetch merchant details from Salesforce for calendar event
  console.log('📋 Fetching merchant details from Salesforce for calendar event...')
  const conn = await getSalesforceConnection()
  let merchantDetails: any = {}
  let hardwareList: string[] = []

  if (conn) {
    try {
      // Get merchant/trainer record with all required fields
      const trainerQuery = `
        SELECT Id, Name, Account_Name__c,
               Shipping_Street__c, Shipping_City__c, Shipping_State__c, Shipping_Zip_Postal_Code__c, Shipping_Country__c,
               Operation_Manager_Contact__r.Name, Operation_Manager_Contact__r.Phone,
               Business_Owner_Contact__r.Name, Business_Owner_Contact__r.Phone,
               Merchant_PIC_Name__c, Merchant_PIC_Contact_Number__c,
               MSM_Name__r.Name,
               Onboarding_Summary__c
        FROM Onboarding_Trainer__c
        WHERE Id = '${merchantId}'
        LIMIT 1
      `

      const trainerResult = await conn.query(trainerQuery)

      if (trainerResult.totalSize > 0) {
        const trainer: any = trainerResult.records[0]
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
          ].filter(Boolean).join(', '),
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
          msmName: trainer.MSM_Name__r?.Name || 'N/A',
          onboardingSummary: trainer.Onboarding_Summary__c || 'N/A',
          accountId: trainer.Account_Name__c
        }

        // Get hardware list and invoice number (non-software products) from Orders
        if (trainer.Account_Name__c) {
          try {
            const ordersQuery = `
              SELECT Id, NSOrderNumber__c
              FROM Order
              WHERE AccountId = '${trainer.Account_Name__c}' AND Type = 'Non-Software Only'
              LIMIT 10
            `

            const ordersResult = await conn.query(ordersQuery)

            if (ordersResult.totalSize > 0) {
              const orderIds = ordersResult.records.map((order: any) => `'${order.Id}'`).join(',')

              // Get invoice number from first order
              const firstOrder: any = ordersResult.records[0]
              merchantDetails.invoiceNumber = firstOrder.NSOrderNumber__c || 'N/A'

              const orderItemsQuery = `
                SELECT Product2.Name, Quantity
                FROM OrderItem
                WHERE OrderId IN (${orderIds})
              `

              const orderItemsResult = await conn.query(orderItemsQuery)

              if (orderItemsResult.totalSize > 0) {
                hardwareList = orderItemsResult.records.map((item: any) => {
                  const qty = item.Quantity > 1 ? ` (x${item.Quantity})` : ''
                  return `${item.Product2?.Name || 'Unknown Product'}${qty}`
                })
              }
            }
          } catch (hardwareError) {
            console.error('Failed to fetch hardware list:', hardwareError)
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

  // Build detailed description for calendar event
  const hardwareListText = hardwareList.length > 0
    ? hardwareList.join('\n  • ')
    : 'No hardware items found'

  // Use Onboarding Trainer Name (e.g., "Nasi Lemak") for the merchant field in description
  // merchantDetails.name is always the correct Onboarding_Trainer__c.Name field
  const merchantDisplayName = merchantDetails.name || merchantName

  const salesforceUrl = `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchantId}/view`

  const eventDescription = `🔧 Pilot test: automated onboarding flow (manual Intercom ticket required)

📋 Installation Details:
Merchant: ${merchantDisplayName}
Merchant Address: ${merchantDetails.address || 'N/A'}
Invoice Number: ${merchantDetails.invoiceNumber || 'N/A'}

👤 Primary Contact:
Role: ${merchantDetails.primaryContactRole || 'N/A'}
Name: ${merchantDetails.primaryContactName || 'N/A'}
Phone: ${merchantDetails.primaryContactPhone || 'N/A'}

📦 List of Hardware (Non-Software):
  • ${hardwareListText}

👨‍💼 MSM Name: ${merchantDetails.msmName || 'N/A'}

📝 Onboarding Summary:
${merchantDetails.onboardingSummary || 'N/A'}

🔗 Salesforce: ${salesforceUrl}`

  try {
    eventResponse = await larkService.createCalendarEvent(
      calendarId,
      {
        summary: `Installation: ${assignedInstaller}`,
        description: eventDescription,
        start_time: {
          timestamp: Math.floor(new Date(`${date}T${timeSlot.start}:00+08:00`).getTime() / 1000).toString()
        },
        end_time: {
          timestamp: Math.floor(new Date(`${date}T${timeSlot.end}:00+08:00`).getTime() / 1000).toString()
        }
      },
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

      // Store the Lark event ID and installer in Onboarding_Portal__c object (same pattern as training bookings)
      console.error(`📝 [PORTAL-SAVE] Storing event ID in Onboarding_Portal__c.Installation_Event_ID__c: ${eventId}`)
      console.error(`📏 [PORTAL-SAVE] Event ID length: ${eventId?.length} characters`)
      console.error(`🔍 [PORTAL-SAVE] Merchant ID: ${merchantId}`)
      console.error(`👤 [PORTAL-SAVE] Installer: ${assignedInstaller} (email: ${installer.email})`)

      try {
        // First, find the User ID by installer email (for Onboarding_Portal__c.Installer_Name__c)
        // Use 3-tier search strategy like we do for CSM names
        let installerUserId = null
        try {
          console.error(`🔍 [PORTAL-SAVE] Looking up User for installer: ${assignedInstaller} (${installer.email})`)

          // Tier 1: Try exact email match
          let userQuery = `
            SELECT Id, Name, Email
            FROM User
            WHERE Email = '${installer.email}'
            AND IsActive = true
            LIMIT 1
          `
          console.error(`🔍 [PORTAL-SAVE] Tier 1: Exact email match query`)
          let userResult = await conn.query(userQuery)

          if (userResult.totalSize > 0) {
            installerUserId = userResult.records[0].Id
            console.error(`✅ [PORTAL-SAVE] Tier 1 SUCCESS: Found User ID: ${installerUserId} (${userResult.records[0].Name})`)
          } else {
            console.error(`⚠️ [PORTAL-SAVE] Tier 1 FAILED: No User found with email: ${installer.email}`)

            // Tier 2: Try exact name match
            userQuery = `
              SELECT Id, Name, Email
              FROM User
              WHERE Name = '${assignedInstaller}'
              AND IsActive = true
              LIMIT 1
            `
            console.error(`🔍 [PORTAL-SAVE] Tier 2: Exact name match query for: ${assignedInstaller}`)
            userResult = await conn.query(userQuery)

            if (userResult.totalSize > 0) {
              installerUserId = userResult.records[0].Id
              console.error(`✅ [PORTAL-SAVE] Tier 2 SUCCESS: Found User ID: ${installerUserId} (${userResult.records[0].Email})`)
            } else {
              console.error(`⚠️ [PORTAL-SAVE] Tier 2 FAILED: No User found with name: ${assignedInstaller}`)

              // Tier 3: Try fuzzy name match (contains)
              userQuery = `
                SELECT Id, Name, Email
                FROM User
                WHERE Name LIKE '%${assignedInstaller}%'
                AND IsActive = true
                LIMIT 1
              `
              console.error(`🔍 [PORTAL-SAVE] Tier 3: Fuzzy name match query`)
              userResult = await conn.query(userQuery)

              if (userResult.totalSize > 0) {
                installerUserId = userResult.records[0].Id
                console.error(`✅ [PORTAL-SAVE] Tier 3 SUCCESS: Found User ID: ${installerUserId} (${userResult.records[0].Name}, ${userResult.records[0].Email})`)
              } else {
                console.error(`❌ [PORTAL-SAVE] ALL TIERS FAILED: No User found for installer: ${assignedInstaller}`)
                console.error(`❌ [PORTAL-SAVE] Please ensure a User record exists in Salesforce with email: ${installer.email} or name: ${assignedInstaller}`)
              }
            }
          }
        } catch (userError: any) {
          console.error(`❌ [PORTAL-SAVE] Error looking up User:`, userError.message)
          console.error(`❌ [PORTAL-SAVE] Full error:`, userError)
        }
        
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
            Installation_Date__c: installationDateTime  // Send with timezone offset, not UTC
          }
          
          // Only set Installer_Name__c if we found a User ID
          if (installerUserId) {
            updateData.Installer_Name__c = installerUserId
            console.error(`📝 [PORTAL-SAVE] Setting Installer_Name__c to User ID: ${installerUserId}`)
          } else {
            console.error(`⚠️ [PORTAL-SAVE] No installer User ID found - Installer_Name__c will not be set`)
          }

          console.error(`📦 [PORTAL-SAVE] Final update data:`, JSON.stringify(updateData, null, 2))
          const updateResult = await conn.sobject('Onboarding_Portal__c').update(updateData)
          console.error(`✅ [PORTAL-SAVE] Update result:`, JSON.stringify(updateResult))

          // Verify what was actually saved
          if (updateResult.success) {
            const verifyQuery = `
              SELECT Id, Installation_Event_ID__c, Installation_Date__c, Installer_Name__c, Installer_Name__r.Name
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
              console.error(`   - Installer_Name__c (User ID): ${savedRecord.Installer_Name__c}`)
              console.error(`   - Installer_Name__r.Name: ${savedRecord.Installer_Name__r?.Name || 'NULL (relationship not populated)'}`)
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
            Installation_Date__c: installationDateTime  // Send with timezone offset, not UTC
          }
          
          // Only set Installer_Name__c if we found a User ID
          if (installerUserId) {
            createData.Installer_Name__c = installerUserId
            console.error(`📝 [PORTAL-SAVE] Setting Installer_Name__c to User ID: ${installerUserId}`)
          } else {
            console.error(`⚠️ [PORTAL-SAVE] No installer User ID found - Installer_Name__c will not be set`)
          }

          console.error(`📦 [PORTAL-SAVE] Final create data:`, JSON.stringify(createData, null, 2))
          const createResult = await conn.sobject('Onboarding_Portal__c').create(createData)
          console.error(`✅ [PORTAL-SAVE] Created new Portal record: ${createResult.id}`)
          console.error(`✅ [PORTAL-SAVE] Successfully created Onboarding_Portal__c with all fields`)
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
      assignedPersonEmail: installer.email
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
  const vendor = installersConfig.external.vendors.find(v => v.isActive)
  
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

