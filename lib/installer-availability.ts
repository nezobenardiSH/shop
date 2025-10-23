import { getSalesforceConnection } from './salesforce'
import { larkService } from './lark'
import { sendBookingNotification } from './lark-notifications'
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
      SELECT Merchant_Location__c, Name, Id 
      FROM Onboarding_Trainer__c 
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    console.log('🔍 Querying installer type with:', { merchantId, query })
    
    const result = await conn.query(query)
    const record = result.records[0]
    const merchantLocation = record?.Merchant_Location__c
    
    console.log('🔍 Installer type query result:', {
      merchantId,
      foundRecord: !!record,
      recordName: record?.Name,
      recordId: record?.Id,
      merchantLocation
    })
    
    // Check location value from Salesforce
    if (merchantLocation === 'Within Klang Valley') {
      return 'internal'
    } else if (merchantLocation === 'Outside of Klang Valley') {
      return 'external'
    }
    
    // Default to external if location not set
    return 'external'
  } catch (error) {
    console.error('Error getting installer type:', error)
    return 'external'
  }
}

// Check availability for internal installers (using same mechanism as trainers)
export async function getInternalInstallersAvailability(
  startDate: string,
  endDate: string
): Promise<InstallerAvailability[]> {
  console.log('Getting installer availability...')
  
  const installers = installersConfig.internal.installers.filter(i => i.isActive)
  console.log(`Checking availability for ${installers.length} installers:`, installers.map(i => i.name))
  
  // Map to store each installer's availability
  const installerAvailabilities: Map<string, Array<{start: string; end: string}>> = new Map()
  
  // Fetch availability for each installer
  for (const installer of installers) {
    try {
      // Check if installer has OAuth token
      const { larkOAuthService } = await import('./lark-oauth-service')
      const hasToken = await larkOAuthService.isUserAuthorized(installer.email)
      
      if (!hasToken) {
        console.log(`⚠️ ${installer.name} has no OAuth token - assuming available`)
        installerAvailabilities.set(installer.name, [])
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
      // If we can't get availability, assume installer is available
      installerAvailabilities.set(installer.name, [])
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

  const assignedInstaller = assignInstaller(availableInstallers)
  const installer = installersConfig.internal.installers.find(i => i.name === assignedInstaller)

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
               Merchant_PIC_Contact_Number__c,
               MSM_Name__r.Name
        FROM Onboarding_Trainer__c
        WHERE Id = '${merchantId}'
        LIMIT 1
      `

      const trainerResult = await conn.query(trainerQuery)

      if (trainerResult.totalSize > 0) {
        const trainer: any = trainerResult.records[0]
        merchantDetails = {
          name: trainer.Name,
          address: [
            trainer.Shipping_Street__c,
            trainer.Shipping_City__c,
            trainer.Shipping_State__c,
            trainer.Shipping_Zip_Postal_Code__c,
            trainer.Shipping_Country__c
          ].filter(Boolean).join(', '),
          primaryContactRole: trainer.Operation_Manager_Contact__r ? 'Operation Manager' :
                             trainer.Business_Owner_Contact__r ? 'Business Owner' : 'N/A',
          primaryContactName: trainer.Operation_Manager_Contact__r?.Name ||
                             trainer.Business_Owner_Contact__r?.Name || 'N/A',
          primaryContactPhone: trainer.Operation_Manager_Contact__r?.Phone ||
                              trainer.Business_Owner_Contact__r?.Phone ||
                              trainer.Merchant_PIC_Contact_Number__c || 'N/A',
          msmName: trainer.MSM_Name__r?.Name || 'N/A',
          accountId: trainer.Account_Name__c
        }

        // Get hardware list (non-software products) from Orders
        if (trainer.Account_Name__c) {
          try {
            const ordersQuery = `
              SELECT Id
              FROM Order
              WHERE AccountId = '${trainer.Account_Name__c}' AND Type = 'Non-Software Only'
              LIMIT 10
            `

            const ordersResult = await conn.query(ordersQuery)

            if (ordersResult.totalSize > 0) {
              const orderIds = ordersResult.records.map((order: any) => `'${order.Id}'`).join(',')

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
      
      for (const inst of installersConfig.internal.installers) {
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

  const eventDescription = `🔧 Pilot test: automated onboarding flow (manual Intercom ticket required)

📋 Installation Details:
Merchant Name: ${merchantDetails.name || merchantName}
Merchant Address: ${merchantDetails.address || 'N/A'}

👤 Primary Contact:
Role: ${merchantDetails.primaryContactRole || 'N/A'}
Name: ${merchantDetails.primaryContactName || 'N/A'}
Phone: ${merchantDetails.primaryContactPhone || 'N/A'}

📦 List of Hardware (Non-Software):
  • ${hardwareListText}

👨‍💼 MSM Name: ${merchantDetails.msmName || 'N/A'}

🔗 Salesforce ID: ${merchantId}`

  try {
    eventResponse = await larkService.createCalendarEvent(
      calendarId,
      {
        summary: `Installation: ${merchantDetails.name || merchantName}`,
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
      
      // Prepare update data exactly like training bookings
      const updateData: any = {
        Id: merchantId,  // Use merchantId directly as it's already the record ID
        Installation_Date__c: dateOnly,
        Installation_Event_Id__c: eventId || null
      }

      // Installer_Name__c is a lookup field to User (internal Salesforce users)
      // Same mechanism as CSM_Name__c
      console.log('📝 Attempting to set Installer_Name__c for installer:', assignedInstaller, '(', installer.email, ')')

      try {
        let userId: string | null = null

        // Search by email first (most reliable), then by name
        const searchQuery = `SELECT Id, Name, Email FROM User WHERE Email = '${installer.email}' OR Name = '${assignedInstaller}' LIMIT 1`
        console.log('🔍 Searching for User with query:', searchQuery)

        const userResult = await conn.query(searchQuery)

        if (userResult.records && userResult.records.length > 0) {
          const user: any = userResult.records[0]
          userId = user.Id
          console.log('✅ Found User:', {
            id: user.Id,
            name: user.Name,
            email: user.Email
          })
        } else {
          console.log('⚠️ No User found for installer email:', installer.email)
        }

        // If we have a User ID, update the Installer_Name__c field
        if (userId) {
          updateData.Installer_Name__c = userId
          console.log('📝 Setting Installer_Name__c to User ID:', userId)
        } else {
          console.log('⚠️ Could not get User ID for installer, Installer_Name__c will not be updated')
        }
      } catch (userError: any) {
        console.log('❌ Error searching for User for Installer_Name__c:', userError.message)
        console.log('   Installer_Name__c will not be updated, but installation date will still be saved')
      }
      
      console.log('📦 Final update data being sent to Salesforce:', JSON.stringify(updateData, null, 2))

      // Try to update with User ID first (same pattern as training bookings)
      let updateResult: any
      try {
        updateResult = await conn.sobject('Onboarding_Trainer__c').update(updateData)
        console.log('✅ Salesforce update result:', JSON.stringify(updateResult, null, 2))
      } catch (updateError: any) {
        console.log('⚠️ Failed to update with User ID:', updateError.message)

        // If the Installer_Name__c field update fails (likely due to invalid User ID),
        // retry without the Installer_Name__c field to at least update the installation date and event ID
        const updateDataWithoutInstaller: any = {
          Id: merchantId,
          Installation_Date__c: updateData.Installation_Date__c
        }

        // Also include the event ID if it was in the original update data
        if (updateData.Installation_Event_Id__c) {
          updateDataWithoutInstaller.Installation_Event_Id__c = updateData.Installation_Event_Id__c
          console.log(`📝 Including event ID in retry: Installation_Event_Id__c = ${updateData.Installation_Event_Id__c}`)
        }

        console.log('🔄 Retrying update without Installer_Name__c field...')
        console.log('📦 Retry update data:', JSON.stringify(updateDataWithoutInstaller, null, 2))

        updateResult = await conn.sobject('Onboarding_Trainer__c').update(updateDataWithoutInstaller)
        console.log('✅ Successfully updated installation date and event ID (without installer field)')
      }

      if (!updateResult || !updateResult.success) {
        console.error(`❌ Update failed:`, updateResult)
        // Don't throw - allow booking to succeed even if Salesforce update fails
      } else {
        // Verify the update
        const verifyQuery = `SELECT Id, Installation_Date__c, Installation_Event_Id__c, Installer_Name__c FROM Onboarding_Trainer__c WHERE Id = '${merchantId}'`
        const verifyResult = await conn.query(verifyQuery)
        if (verifyResult.records && verifyResult.records.length > 0) {
          const updated: any = verifyResult.records[0]
          console.log(`✔️ Verification - Installation_Date__c: ${updated.Installation_Date__c}`)
          console.log(`✔️ Verification - Installation_Event_Id__c: ${updated.Installation_Event_Id__c}`)
          console.log(`✔️ Verification - Installer_Name__c: ${updated.Installer_Name__c}`)
        }
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
  
  // Update Salesforce with request
  const conn = await getSalesforceConnection()
  if (conn) {
    await conn.sobject('Onboarding_Trainer__c').update({
      Name: merchantId,
      Preferred_Installation_Date__c: preferredDate,
      Preferred_Installation_Time__c: preferredTime,
      Installation_Status__c: 'Pending Vendor Confirmation',
      Installation_Type__c: 'External',
      Installation_Vendor__c: vendor.name
    })
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

