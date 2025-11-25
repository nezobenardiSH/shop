import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import { getSlotAvailability, assignTrainer, getTrainerDetails } from '@/lib/trainer-availability'
import { getSalesforceConnection } from '@/lib/salesforce'
import { createSalesforceEvent, updateSalesforceEvent } from '@/lib/salesforce-events'
import { sendBookingNotification, sendManagerBookingNotification } from '@/lib/lark-notifications'
import { trackEvent, generateSessionId, getClientInfo } from '@/lib/analytics'
import { verifyToken } from '@/lib/auth-utils'
import { cookies } from 'next/headers'
import trainersConfig from '@/config/trainers.json'
import { createSalesforceTask, getMsmSalesforceUserId, getTodayDateString, getSalesforceRecordUrl } from '@/lib/salesforce-tasks'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const body = await request.json()
    const {
      merchantId,
      merchantName,
      merchantAddress,
      merchantState,  // State for location-based trainer assignment
      merchantPhone,
      merchantContactPerson,
      merchantBusinessType,
      trainerName,
      onboardingTrainerName,  // Salesforce Onboarding_Trainer__c.Name (e.g., "Nasi Lemak")
      date,
      startTime,
      endTime,
      bookingType = 'training',
      trainerLanguages,  // Required languages for the training session
      requiredFeatures,  // Required features by merchant
      onboardingSummary,  // Onboarding summary
      workaroundElaboration,  // Workaround elaboration
      onboardingServicesBought,  // To determine if onsite or remote training
      existingEventId,  // Event ID of existing booking to be cancelled (for rescheduling)
      currentTrainerEmail  // Email of the trainer who created the existing event (for rescheduling)
    } = body

    console.log('📥 Booking request received:', {
      merchantId,
      merchantName,
      date,
      startTime,
      endTime,
      bookingType,
      existingEventId: existingEventId || 'NONE (new booking)',
      existingEventIdLength: existingEventId ? existingEventId.length : 0,
      currentTrainerEmail: currentTrainerEmail || 'NOT PROVIDED',
      isRescheduling: !!existingEventId
    })

    // DEBUG: Log the full body to see what's being sent
    console.log('📋 Full request body keys:', Object.keys(body))
    if (existingEventId) {
      console.log('🔍 RESCHEDULING DETECTED - Event ID details:', {
        eventId: existingEventId,
        length: existingEventId.length,
        currentTrainerEmail: currentTrainerEmail,
        type: typeof existingEventId
      })
    }

    // Warn if event ID is too long for Salesforce
    if (existingEventId && existingEventId.length > 20) {
      console.warn('⚠️ WARNING: Existing event ID is too long for Salesforce (max 20 chars):', {
        eventId: existingEventId,
        length: existingEventId.length,
        note: 'Rescheduling may fail - Salesforce field needs to be expanded'
      })
    }

    if (!merchantId || !merchantName || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Step 1: Determine if location filtering should be applied
    const { detectServiceType, shouldFilterByLocation, canBook } = await import('@/lib/service-type-detector')
    const serviceType = detectServiceType(onboardingServicesBought)
    
    // Check if booking is allowed based on service type
    if (!canBook(serviceType)) {
      console.log('❌ Booking blocked - service type is not configured')
      return NextResponse.json(
        { 
          error: 'Training delivery method not configured',
          details: 'The Onboarding Services Bought field must be set to either "Onsite Training" or "Remote Training" before booking. Please contact support to update this field in Salesforce.'
        },
        { status: 400 }
      )
    }
    
    // Determine if location filtering is needed
    // - Onsite training: YES - filter trainers by merchant location
    // - Remote training: NO - show all trainers regardless of location
    const filterByLocation = shouldFilterByLocation(serviceType, bookingType)

    console.log('🔍 Service Type Detection:', {
      onboardingServicesBought,
      serviceType,
      filterByLocation,
      merchantState
    })

    // Step 2: Check which trainers are available for this slot (skip in mock mode)
    const mockMode = process.env.MOCK_LARK_BOOKING === 'true' || searchParams.get('mock') === 'true'

    let available = true
    let availableTrainers = ['Nezo'] // Default trainer for mock mode

    if (!mockMode) {
      console.log('Checking availability for slot:', { date, startTime, endTime })
      console.log('🏢 Merchant details:', {
        merchantState: merchantState,
        onboardingServicesBought: onboardingServicesBought,
        serviceType: serviceType,
        filterByLocation: filterByLocation
      })

      // Pass merchantState only if location filtering should be applied (onsite training)
      const stateForFiltering = filterByLocation ? merchantState : undefined
      console.log(`📍 State for filtering: ${stateForFiltering || 'NONE (remote training)'}`)

      const slotResult = await getSlotAvailability(date, startTime, endTime, stateForFiltering)
      available = slotResult.available
      availableTrainers = slotResult.availableTrainers

      console.log(`📊 Availability check result: ${availableTrainers.length} trainers available`)
      console.log(`   Available trainers: ${availableTrainers.join(', ')}`)
      console.log(`   Service type: ${serviceType}`)
      console.log(`   Location filtering: ${filterByLocation ? 'YES' : 'NO'}`)
    } else {
      console.log('MOCK MODE: Skipping availability check')
    }
    
    if (!available || availableTrainers.length === 0) {
      return NextResponse.json(
        { 
          error: 'No trainers available for this time slot',
          details: 'All trainers are busy during the selected time'
        },
        { status: 409 }
      )
    }
    
    // Step 3: Filter to only trainers with OAuth tokens (for real booking)
    let trainersWithAuth = availableTrainers
    if (!mockMode) {
      const { larkOAuthService } = await import('@/lib/lark-oauth-service')
      const authCheckPromises = availableTrainers.map(async (trainerName) => {
        const trainer = await getTrainerDetails(trainerName)
        const hasAuth = await larkOAuthService.isUserAuthorized(trainer.email)
        return hasAuth ? trainerName : null
      })
      const authResults = await Promise.all(authCheckPromises)
      trainersWithAuth = authResults.filter((t): t is string => t !== null)

      console.log('Trainers with OAuth tokens:', trainersWithAuth)

      if (trainersWithAuth.length === 0) {
        console.log('⚠️ No trainers with OAuth tokens available')
        return NextResponse.json(
          {
            error: 'No authorized trainers available',
            details: 'Available trainers have not yet connected their Lark calendars. Please contact support.'
          },
          { status: 503 }
        )
      }
    }

    // Step 4: Intelligently assign a trainer based on language requirements
    console.log('Available trainers for slot:', trainersWithAuth)
    console.log('Required languages:', trainerLanguages)
    
    let assignment
    try {
      assignment = await assignTrainer(trainersWithAuth, trainerLanguages)
      console.log('Assigned trainer:', assignment)
    } catch (error: any) {
      // Language requirements couldn't be met
      console.error('Language assignment failed:', error.message)
      return NextResponse.json(
        { 
          error: 'No trainers available with required language skills',
          details: error.message,
          availableTrainers: trainersWithAuth
        },
        { status: 400 }
      )
    }

    // Step 5: Get the assigned trainer's details
    const trainer = await getTrainerDetails(assignment.assigned)
    console.log('Trainer details from getTrainerDetails:', {
      assignedName: assignment.assigned,
      fullName: trainer.name,
      email: trainer.email
    })

    // Get calendar ID using centralized Calendar ID Manager
    let calendarId = trainer.calendarId // fallback
    if (!mockMode) {
      try {
        console.log(`🔍 Resolving calendar ID for booking using CalendarIdManager...`)
        const { CalendarIdManager } = await import('@/lib/calendar-id-manager')
        calendarId = await CalendarIdManager.getResolvedCalendarId(trainer.email)
        console.log(`📅 Using resolved calendar ID for booking: ${calendarId}`)
      } catch (error) {
        console.log('⚠️ CalendarIdManager failed, using config calendar ID:', error)
        console.log('Using config calendar ID:', calendarId)
      }
    }
    
    console.log('Booking training with:', {
      merchantName,
      trainerEmail: trainer.email,
      calendarId,
      date,
      startTime,
      endTime,
      existingEventId
    })

    // Step 5.5: Fetch Merchant PIC contact information and additional fields from Salesforce
    let merchantPICName: string | undefined
    let merchantPICPhone: string | undefined
    let fetchedOnboardingSummary: string | undefined
    let fetchedWorkaroundElaboration: string | undefined
    let fetchedRequiredFeatures: string | undefined

    // Fetch merchant email from Salesforce
    let merchantEmail: string | null = null

    // MSM (Onboarding Manager) data for manager notifications
    let msmEmail: string | null = null
    let msmName: string | null = null

    // For rescheduling: store current trainer and event ID
    let currentTrainerEmailForDeletion: string | null = null
    let currentEventIdForDeletion: string | null = null
    let currentSalesforceEventId: string | null = null

    try {
      const conn = await getSalesforceConnection()
      if (conn) {
        const trainerQuery = `
          SELECT Merchant_PIC_Name__c, Merchant_PIC_Contact_Number__c,
                 Onboarding_Summary__c, Workaround_Elaboration__c,
                 Required_Features_by_Merchant__c,
                 Email__c, CSM_Name__c, CSM_Name__r.Email,
                 MSM_Name__c, MSM_Name__r.Email, MSM_Name__r.Name
          FROM Onboarding_Trainer__c
          WHERE Id = '${merchantId}'
          LIMIT 1
        `

        // Query Portal for current event ID if rescheduling
        let portalQuery = ''
        if (existingEventId) {
          portalQuery = `
            SELECT Training_Event_ID__c, Training_Salesforce_Event_ID__c
            FROM Onboarding_Portal__c
            WHERE Onboarding_Trainer_Record__c = '${merchantId}'
            LIMIT 1
          `
        }

        const trainerResult = await conn.query(trainerQuery)
        if (trainerResult.totalSize > 0) {
          const trainerRecord = trainerResult.records[0] as any
          merchantPICName = trainerRecord.Merchant_PIC_Name__c
          merchantPICPhone = trainerRecord.Merchant_PIC_Contact_Number__c
          fetchedOnboardingSummary = trainerRecord.Onboarding_Summary__c
          fetchedWorkaroundElaboration = trainerRecord.Workaround_Elaboration__c
          fetchedRequiredFeatures = trainerRecord.Required_Features_by_Merchant__c
          merchantEmail = trainerRecord.Email__c

          // Get MSM (Onboarding Manager) data for manager notifications
          msmEmail = trainerRecord.MSM_Name__r?.Email || null
          msmName = trainerRecord.MSM_Name__r?.Name || null

          // CRITICAL: Get current trainer for deletion (Onboarding_Trainer__c.CSM_Name__c)
          if (existingEventId && trainerRecord.CSM_Name__r?.Email) {
            currentTrainerEmailForDeletion = trainerRecord.CSM_Name__r.Email
            console.log(`✅ Found current trainer from Onboarding_Trainer__c.CSM_Name__c: ${currentTrainerEmailForDeletion}`)
          }

          console.log('📞 Fetched Merchant PIC contact and additional fields:', {
            merchantPICName,
            merchantPICPhone,
            merchantEmail,
            msmEmail,
            msmName,
            fetchedOnboardingSummary: fetchedOnboardingSummary ? 'Yes' : 'No',
            fetchedWorkaroundElaboration: fetchedWorkaroundElaboration ? 'Yes' : 'No',
            fetchedRequiredFeatures: fetchedRequiredFeatures ? 'Yes' : 'No'
          })
        }

        // Get current event ID and Salesforce Event ID if rescheduling
        if (existingEventId && portalQuery) {
          const portalResult = await conn.query(portalQuery)
          if (portalResult.totalSize > 0) {
            const portalRecord = portalResult.records[0] as any
            currentEventIdForDeletion = portalRecord.Training_Event_ID__c
            currentSalesforceEventId = portalRecord.Training_Salesforce_Event_ID__c
            console.log(`✅ Found current event ID from Onboarding_Portal__c.Training_Event_ID__c: ${currentEventIdForDeletion}`)
            console.log(`✅ Found current Salesforce Event ID: ${currentSalesforceEventId}`)
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Failed to fetch Merchant PIC contact and additional fields, will use fallback:', error)
      // Continue with booking even if we can't fetch these fields
    }

    // Step 5.6: If this is a reschedule (existingEventId provided), delete the old event first
    if (existingEventId && !mockMode) {
      let deleted = false
      const trainerEmailForDeletion = currentTrainerEmailForDeletion || currentTrainerEmail
      const eventIdForDeletion = currentEventIdForDeletion || existingEventId

      console.log('🗑️ Rescheduling detected - attempting to delete existing event:', {
        eventId: eventIdForDeletion,
        expectedTrainer: trainerEmailForDeletion
      })

      // Attempt 1: Try expected trainer first (fast path)
      if (trainerEmailForDeletion) {
        try {
          const { CalendarIdManager } = await import('@/lib/calendar-id-manager')
          const deleteCalendarId = await CalendarIdManager.getResolvedCalendarId(trainerEmailForDeletion)
          await larkService.deleteCalendarEvent(deleteCalendarId, eventIdForDeletion, trainerEmailForDeletion)
          console.log(`✅ Successfully deleted event from ${trainerEmailForDeletion}'s calendar`)
          deleted = true
        } catch (err: any) {
          console.log(`⚠️ Event not in expected trainer's calendar (${trainerEmailForDeletion}): ${err.message}`)
          console.log('🔍 Searching across all authorized trainers...')
        }
      }

      // Attempt 2: Search all authorized trainers' calendars
      if (!deleted) {
        for (const trainerConfig of trainersConfig.trainers) {
          // Skip if already tried this trainer
          if (trainerConfig.email === trainerEmailForDeletion) continue

          // Skip trainers without OAuth authorization
          const { larkOAuthService } = await import('@/lib/lark-oauth-service')
          const hasAuth = await larkOAuthService.isUserAuthorized(trainerConfig.email)
          if (!hasAuth) {
            console.log(`   Skipping ${trainerConfig.name} (not authorized)`)
            continue
          }

          try {
            const { CalendarIdManager } = await import('@/lib/calendar-id-manager')
            const calId = await CalendarIdManager.getResolvedCalendarId(trainerConfig.email)
            await larkService.deleteCalendarEvent(calId, eventIdForDeletion, trainerConfig.email)
            console.log(`✅ Found and deleted event from ${trainerConfig.name}'s calendar`)
            deleted = true
            break
          } catch (err: any) {
            console.log(`   Not in ${trainerConfig.name}'s calendar, trying next...`)
          }
        }
      }

      // Log final outcome
      if (!deleted) {
        console.log('⚠️ Event not found in any trainer calendar')
        console.log('   This may indicate the event was manually deleted - proceeding with new booking')
      }
    }

    // Step 6: Create VC meeting FIRST for remote training (before calendar event)
    let meetingLink: string | null = null
    let vcReservationId: string | null = null
    const isRemoteTraining = serviceType === 'remote'

    if (isRemoteTraining && !mockMode && bookingType === 'training') {
      try {
        console.log('🎥 Creating Lark VC meeting for remote training...')
        console.log(`   Trainer: ${trainer.email}`)

        // Create meeting title
        const meetingTitle = `Remote Training - ${merchantName}`

        // Create description
        const meetingDescription = `
Remote Training Session

Merchant: ${merchantName}
Contact: ${merchantPICName || 'N/A'}
Email: ${merchantEmail || 'N/A'}
Phone: ${merchantPICPhone || 'N/A'}

Training Language: ${trainerLanguages?.join(', ') || 'N/A'}

Required Features:
${requiredFeatures || fetchedRequiredFeatures || 'N/A'}

Salesforce: https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${merchantId}/view
        `.trim()

        // Convert date/time to Unix timestamps
        const startDateTime = new Date(`${date}T${startTime}`)
        const endDateTime = new Date(`${date}T${endTime}`)
        const startTimestamp = Math.floor(startDateTime.getTime() / 1000)
        const endTimestamp = Math.floor(endDateTime.getTime() / 1000)

        // Use new method that leverages existing OAuth infrastructure
        const vcMeeting = await larkService.createVCMeetingWithTrainerAuth(
          trainer.email,
          meetingTitle,
          startTimestamp,
          endTimestamp,
          meetingDescription
        )

        if (vcMeeting) {
          meetingLink = vcMeeting.meetingLink
          vcReservationId = vcMeeting.reservationId
          console.log('✅ Lark VC meeting created:', meetingLink)
        } else {
          console.warn('⚠️ Could not create VC meeting - trainer may not have authorized Lark')
          console.warn('⚠️ Booking will continue without meeting link')
        }

      } catch (vcError: any) {
        console.error('❌ Failed to create Lark VC meeting:', vcError.message)
        // Don't fail entire booking if VC creation fails
        // Booking succeeds, admin can manually add link later
      }
    }

    // Step 7: Create calendar event (with VC link if available)
    let eventId: string

    if (mockMode) {
      // Mock mode for testing without Lark permissions
      console.log('MOCK MODE: Simulating calendar event creation')
      eventId = `mock-event-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      console.log('Mock event created:', eventId)
    } else {
      try {
        console.log('🎯 NOT IN MOCK MODE - Attempting real calendar booking')
        console.log('Trainer details:', {
          name: trainer.name,
          email: trainer.email,
          calendarId: calendarId
        })

        if (meetingLink) {
          console.log('📎 Including VC meeting link in calendar event:', meetingLink)
        }

        eventId = await larkService.bookTraining(
          {
            name: merchantName,
            address: serviceType === 'onsite' ? merchantAddress : undefined,  // Only include address for onsite training
            phone: merchantPhone,
            contactPerson: merchantContactPerson,
            businessType: merchantBusinessType,
            salesforceId: merchantId,
            language: trainerLanguages,  // Pass selected language to calendar event
            requiredFeatures: requiredFeatures || fetchedRequiredFeatures,  // Pass required features to calendar event (use fetched value as fallback)
            onboardingSummary: onboardingSummary || fetchedOnboardingSummary,  // Use passed value or fetched from Salesforce
            workaroundElaboration: workaroundElaboration || fetchedWorkaroundElaboration,  // Use passed value or fetched from Salesforce
            merchantPICName: merchantPICName,  // Merchant PIC Name from Salesforce
            merchantPICPhone: merchantPICPhone,  // Merchant PIC Contact Number from Salesforce
            merchantEmail: merchantEmail,  // Merchant Email from Salesforce
            onboardingServicesBought: onboardingServicesBought,  // Onboarding Services Bought (to show onsite/remote)
            meetingLink: meetingLink || undefined  // Pass VC meeting link to include in calendar event
          },
          trainer.email,
          calendarId,
          date,
          startTime,
          endTime,
          bookingType,
          onboardingTrainerName || merchantName  // Use Onboarding Trainer Name (e.g., "Nasi Lemak") for event title
        )

        console.log('✅ Real calendar event created successfully:', eventId)
      } catch (bookingError: any) {
        console.error('❌ Lark calendar booking failed:', {
          message: bookingError.message,
          stack: bookingError.stack,
          name: bookingError.name
        })

        // Return error response instead of using mock fallback
        return NextResponse.json(
          {
            error: 'Failed to create calendar event',
            details: bookingError.message || 'Unable to create calendar event. Please check Lark calendar permissions.'
          },
          { status: 500 }
        )
      }
    }

    // Update Salesforce with the booking
    let salesforceUpdated = false
    let newSalesforceEventId: string | null = null

    try {
      const conn = await getSalesforceConnection()

      console.log(`Updating Salesforce ${bookingType} date:`, {
        trainerId: merchantId,
        date: date,
        eventId: eventId,
        assignedTrainer: assignment.assigned,
        bookingType: bookingType
      })

      // First check if we have a valid connection
      if (!conn) {
        console.error('No Salesforce connection available')
        throw new Error('No Salesforce connection available')
      }

      // Note: Current trainer and event ID were already queried earlier in Step 5.5
      // currentTrainerEmailForDeletion and currentEventIdForDeletion are already set
      
      // Map booking types to Salesforce field names
      const fieldMapping: { [key: string]: { field: string, object: string } } = {
        'hardware-fulfillment': { field: 'Hardware_Fulfillment_Date__c', object: 'Order' },
        'installation': { field: 'Installation_Date__c', object: 'Onboarding_Trainer__c' },
        'training': { field: 'Training_Date__c', object: 'Onboarding_Trainer__c' },
        'go-live': { field: 'First_Revised_EGLD__c', object: 'Onboarding_Trainer__c' }
      }

      const mapping = fieldMapping[bookingType] || { field: 'Training_Date__c', object: 'Onboarding_Trainer__c' }

      console.log('📋 Field mapping for bookingType:', bookingType, '→', mapping)
      
      let updateResult: any
      
      if (mapping.object === 'Order') {
        // For Order object, we need to find the Order first
        console.log('Updating Hardware Fulfillment Date in Order object')
        const trainer = await conn.sobject('Onboarding_Trainer__c')
          .select('Id, Account_Name__c')
          .where({ Id: merchantId })
          .limit(1)
          .execute()
        
        if (trainer && trainer.length > 0) {
          const accountId = trainer[0].Account_Name__c
          console.log('Found Account ID:', accountId)
          
          const orders = await conn.query(
            `SELECT Id FROM Order WHERE AccountId = '${accountId}' LIMIT 1`
          )
          
          if (orders.records && orders.records.length > 0) {
            const orderId = orders.records[0].Id
            console.log('Found Order ID:', orderId)
            console.log('Updating field:', mapping.field, 'with date:', date)
            
            updateResult = await conn.sobject('Order').update({
              Id: orderId,
              [mapping.field]: date
            })
            
            console.log('Order update result:', updateResult)
          } else {
            console.log('No Order found for Account:', accountId)
          }
        } else {
          console.log('No Trainer found with ID:', merchantId)
        }
      } else {
        // Update Onboarding_Trainer__c record
        // For DateTime fields, we need to include the time in ISO format
        const dateTimeValue = `${date}T${startTime}:00+08:00` // Singapore timezone

        console.log('Updating Salesforce field:', mapping.field)
        console.log('Date value:', date)
        console.log('DateTime value:', dateTimeValue)

        // Prepare update object with training date
        let fieldValue: string
        if (bookingType === 'training') {
          // Training_Date__c is a Date field, not DateTime
          fieldValue = date // Just the date, no time
          console.log('Using date only for Training_Date__c field')
        } else {
          // Other fields like Installation_Date__c are DateTime
          fieldValue = dateTimeValue
          console.log('Using datetime for field:', mapping.field)
        }

        const updateData: any = {
          Id: merchantId,
          [mapping.field]: fieldValue
        }

        // For installation bookings, also update the Assigned_Installer__c field
        if (bookingType === 'installation' && trainer && trainer.name) {
          updateData.Assigned_Installer__c = trainer.name
          console.log('📝 Setting Assigned_Installer__c to:', trainer.name)
        }

        // Store the Lark event ID in Onboarding_Portal__c object
        const eventIdFieldMapping: { [key: string]: string } = {
          'installation': 'Installation_Event_ID__c',
          'training': 'Training_Event_ID__c'
        }

        const eventIdField = eventIdFieldMapping[bookingType]
        let portalIdForUpdate: string | null = null

        if (eventIdField) {
          console.log(`📝 Storing event ID in Onboarding_Portal__c.${eventIdField}: ${eventId}`)
          console.log(`📏 Event ID length: ${eventId.length} characters`)

          // Query Onboarding_Portal__c by Onboarding_Trainer_Record__c lookup
          try {
            const portalQuery = `
              SELECT Id
              FROM Onboarding_Portal__c
              WHERE Onboarding_Trainer_Record__c = '${merchantId}'
              LIMIT 1
            `
            const portalResult = await conn.query(portalQuery)

            if (portalResult.totalSize > 0) {
              portalIdForUpdate = portalResult.records[0].Id
              console.log(`📝 Found Onboarding_Portal__c ID: ${portalIdForUpdate}`)

              // Check if eventId exceeds Salesforce field limit
              // DO NOT truncate - this would break rescheduling!
              if (eventId.length > 255) {
                console.error(`❌ Event ID exceeds 255 chars (${eventId.length}) - cannot store in Salesforce`)
                console.error(`   Event ID: ${eventId}`)
                console.error(`   This will prevent rescheduling from working!`)
                // Don't store a truncated ID - it's better to not store it at all
                throw new Error('Event ID too long for Salesforce storage')
              }
            } else {
              console.log(`⚠️ No Onboarding_Portal__c record found for Onboarding_Trainer_Record__c = ${merchantId}`)
            }
          } catch (portalError: any) {
            console.log(`❌ Error querying Onboarding_Portal__c:`, portalError.message)
            console.log(`   Event ID will not be saved, but booking will continue`)
          }
        }

        // Update the CSM field for training bookings
        // CSM_Name__c is a lookup field to User (internal Salesforce users)
        console.log('📝 Attempting to set CSM_Name__c for trainer:', trainer.name, '(', trainer.email, ')')
        console.log('📝 Booking type:', bookingType)

        // Declare userId outside try block so it's available for Portal update later
        let userId: string | null = null

        // Search for User (internal Salesforce user) using trainer info from trainers.json
        try {

          // Try multiple search strategies to find the User
          console.log('🔍 Attempting to find Salesforce User for trainer:', {
            name: trainer.name,
            email: trainer.email
          })

          // Strategy 1: Search by email (most reliable)
          let searchQuery = `SELECT Id, Name, Email, IsActive FROM User WHERE Email = '${trainer.email}' AND IsActive = true LIMIT 1`
          console.log('🔍 Strategy 1 - Searching by email:', searchQuery)
          let searchResult = await conn.query(searchQuery)
          console.log('   Result:', searchResult.totalSize, 'record(s) found')

          // Strategy 2: If email search fails, try by name
          if (searchResult.totalSize === 0) {
            searchQuery = `SELECT Id, Name, Email, IsActive FROM User WHERE Name = '${trainer.name}' AND IsActive = true LIMIT 1`
            console.log('🔍 Strategy 2 - Searching by name:', searchQuery)
            searchResult = await conn.query(searchQuery)
            console.log('   Result:', searchResult.totalSize, 'record(s) found')
          }

          // Strategy 3: If still not found, try case-insensitive LIKE search on name
          if (searchResult.totalSize === 0) {
            const nameParts = trainer.name.split(' ')
            // Store userId for later use in Portal update
            let foundUserId = null
            if (nameParts.length >= 2) {
              const firstName = nameParts[0]
              const lastName = nameParts[nameParts.length - 1]
              searchQuery = `SELECT Id, Name, Email, IsActive FROM User WHERE (Name LIKE '%${firstName}%' AND Name LIKE '%${lastName}%') AND IsActive = true LIMIT 1`
              console.log('🔍 Strategy 3 - Searching by name parts:', searchQuery)
              searchResult = await conn.query(searchQuery)
              console.log('   Result:', searchResult.totalSize, 'record(s) found')
            }
          }

          if (searchResult.records && searchResult.records.length > 0) {
            userId = searchResult.records[0].Id
            const foundUser = searchResult.records[0] as any
            console.log('✅ Found User:', {
              id: userId,
              name: foundUser.Name,
              email: foundUser.Email,
              isActive: foundUser.IsActive
            })
            console.log('   Matched trainer config:', {
              configName: trainer.name,
              configEmail: trainer.email
            })

            // CRITICAL: Store the trainer User ID in Portal for rescheduling
            // This allows us to know which trainer's calendar to delete from
            if (bookingType === 'training') {
              console.log(`📝 Will store Trainer_Name__c (User ID) in Portal: ${userId}`)
              console.log(`   This allows us to delete from the correct trainer's calendar during rescheduling`)
            }
          } else {
            console.log('❌ No User found for trainer after trying all strategies')
            console.log('   Trainer config:', {
              name: trainer.name,
              email: trainer.email
            })
            console.log('   Please verify:')
            console.log('   1. User exists in Salesforce with this email or name')
            console.log('   2. User is Active (IsActive = true)')
            console.log('   3. Email/name in trainers.json matches Salesforce exactly')
          }

          // If we have a User ID, update the CSM field for training
          if (userId) {
            if (bookingType === 'training') {
              updateData.CSM_Name__c = userId
              console.log('📝 Setting CSM_Name__c (Training) to User ID:', userId)
              console.log('   This will link the trainer to the merchant record')

              // Note: Trainer assignment is stored in Onboarding_Trainer__c.CSM_Name__c
              // We don't need to store it in Portal since we query from Onboarding_Trainer__c during rescheduling
            } else {
              console.log('ℹ️ Booking type is not training, skipping CSM_Name__c update')
            }
          } else {
            console.log('⚠️ Could not get User ID for trainer, CSM_Name__c will not be updated')
            console.log('   Trainer name will show as "Not Assigned" in the UI')
          }
        } catch (userError: any) {
          console.log('❌ Error searching for User for CSM fields:', userError.message)
          console.log('   Full error:', userError)
          console.log('   CSM fields will not be updated, but training date will still be saved')
        }

        console.log('📦 Final update data being sent to Salesforce:', JSON.stringify(updateData, null, 2))
        console.log('Update data keys:', Object.keys(updateData))
        console.log('CSM_Name__c value:', updateData.CSM_Name__c)
        
        // Try to update with User ID first
        try {
          updateResult = await conn.sobject('Onboarding_Trainer__c').update(updateData)
          console.log('✅ Successfully updated Salesforce with data:', JSON.stringify(updateResult, null, 2))
          if (updateData.CSM_Name__c) {
            console.log('✅ CSM_Name__c field was successfully saved to Salesforce')
          }
        } catch (updateError: any) {
          console.log('⚠️ Failed to update Salesforce:', updateError.message)
          console.log('   Full error:', JSON.stringify(updateError, null, 2))

          // If the CSM field update fails (likely due to invalid User ID),
          // retry without the CSM field to at least update the training date and event ID
          if (updateError.message && (updateError.message.includes('CSM') || updateError.message.includes('User'))) {
            console.log('❌ CSM field update failed, retrying without CSM field...')
            const updateDataWithoutCSM: any = {
              Id: merchantId,
              [mapping.field]: fieldValue
            }

            updateResult = await conn.sobject('Onboarding_Trainer__c').update(updateDataWithoutCSM)
            console.log('✅ Successfully updated training date (without CSM field)')
            console.log('⚠️ WARNING: Trainer name will show as "Not Assigned" because CSM_Name__c could not be saved')
          } else {
            throw updateError
          }
        }

        // Create or Update Salesforce Event for KPI tracking (BEFORE Portal update so we have the Event ID)
        // This creates/updates a calendar event in Salesforce linked to the trainer
        try {
          // Only create/update Event if we have a valid trainer User ID
          if (userId) {
            const dateTimeStart = `${date}T${startTime}:00+08:00`
            const dateTimeEnd = `${date}T${endTime}:00+08:00`

            // Build event description with meeting details
            let eventDescription = `Merchant: ${onboardingTrainerName || merchantName}\n`
            eventDescription += `Contact: ${merchantPICName || merchantContactPerson}\n`
            eventDescription += `Phone: ${merchantPICPhone || merchantPhone}\n`
            eventDescription += `Type: ${onboardingServicesBought || 'Training'}\n`

            if (requiredFeatures && requiredFeatures.length > 0) {
              // Handle both string (semicolon-separated) and array formats
              const featuresText = Array.isArray(requiredFeatures)
                ? requiredFeatures.join(', ')
                : requiredFeatures
              eventDescription += `Features: ${featuresText}\n`
            }

            if (onboardingSummary) {
              eventDescription += `\nOnboarding Summary: ${onboardingSummary}\n`
            }

            if (workaroundElaboration) {
              eventDescription += `\nWorkaround: ${workaroundElaboration}\n`
            }

            if (meetingLink) {
              eventDescription += `\nMeeting Link: ${meetingLink}\n`
            }

            eventDescription += `\nSalesforce: https://test.salesforce.com/${merchantId}`

            // Build event subject based on booking type and service
            let eventSubject: string
            if (bookingType === 'installation') {
              eventSubject = `Installation - ${onboardingTrainerName || merchantName}`
            } else {
              // Training - use service type in subject
              if (serviceType === 'onsite') {
                eventSubject = `Onsite Training - ${onboardingTrainerName || merchantName}`
              } else {
                eventSubject = `Remote Training - ${onboardingTrainerName || merchantName}`
              }
            }

            const eventLocation = serviceType === 'onsite'
              ? merchantAddress
              : undefined

            // Determine event type based on onboarding service
            // Salesforce Type picklist values: "Face to face", "Online", "Call"
            const eventType = serviceType === 'onsite'
              ? 'Face to face'
              : 'Online'

            const eventParams = {
              subject: eventSubject,
              startDateTime: dateTimeStart,
              endDateTime: dateTimeEnd,
              ownerId: userId,
              whatId: merchantId,
              type: eventType,
              description: eventDescription,
              location: eventLocation
            }

            // Check if this is a reschedule with existing Salesforce Event
            if (existingEventId && currentSalesforceEventId) {
              // RESCHEDULING: Try to update existing Event
              console.log('🔄 Rescheduling: Updating existing Salesforce Event:', currentSalesforceEventId)
              const updated = await updateSalesforceEvent(currentSalesforceEventId, eventParams)
              if (updated) {
                console.log('✅ Salesforce Event updated for reschedule:', currentSalesforceEventId)
                newSalesforceEventId = currentSalesforceEventId // Keep same Event ID
              } else {
                // Update failed (possibly Event was deleted) - create new Event instead
                console.log('⚠️ Salesforce Event update failed (Event may have been deleted), creating new Event instead')
                const createdEventId = await createSalesforceEvent(eventParams)
                if (createdEventId) {
                  console.log('✅ New Salesforce Event created after update failure:', createdEventId)
                  newSalesforceEventId = createdEventId
                } else {
                  console.log('⚠️ Failed to create new Salesforce Event after update failure')
                }
              }
            } else {
              // NEW BOOKING: Create new Event
              console.log('📝 New booking: Creating new Salesforce Event')
              const createdEventId = await createSalesforceEvent(eventParams)
              if (createdEventId) {
                console.log('✅ Salesforce Event created for KPI tracking:', createdEventId)
                newSalesforceEventId = createdEventId
              } else {
                console.log('⚠️ Salesforce Event creation failed, but booking succeeded')
              }
            }
          } else {
            console.log('⚠️ Skipping Salesforce Event creation/update - trainer User ID not found')
          }
        } catch (eventError) {
          console.error('Salesforce Event creation/update failed but booking succeeded:', eventError)
          // Don't fail the booking if Event creation/update fails
        }

        // CRITICAL: Also update Onboarding_Portal__c with the new event ID and date/time
        // This is needed for rescheduling to know which event to delete
        console.log(`\n🔍 PORTAL UPDATE CHECK:`)
        console.log(`   portalIdForUpdate: ${portalIdForUpdate}`)
        console.log(`   eventIdField: ${eventIdField}`)
        console.log(`   eventId: ${eventId}`)
        console.log(`   Will update Portal? ${!!(portalIdForUpdate && eventIdField && eventId)}`)

        if (portalIdForUpdate && eventIdField && eventId) {
          console.log(`\n✅ PROCEEDING WITH PORTAL UPDATE`)
          try {
            // Build Portal update with BOTH event ID and date/time
            const dateTimeValue = `${date}T${startTime}:00+08:00` // Singapore timezone

            const portalUpdateData: any = {
              Id: portalIdForUpdate,
              [eventIdField]: eventId
            }

            // Add date/time fields based on booking type
            if (bookingType === 'training') {
              // ALWAYS update date/time (critical for reporting)
              portalUpdateData.Training_Date__c = dateTimeValue
              console.log(`📝 Updating Onboarding_Portal__c with Training_Date__c: ${dateTimeValue}`)

              // Update trainer name if we found the User ID
              if (userId) {
                portalUpdateData.Trainer_Name__c = userId
                console.log(`📝 Updating Onboarding_Portal__c with Trainer_Name__c (User ID): ${userId}`)
              } else {
                console.log(`⚠️ Skipping Trainer_Name__c update - User ID not found`)
              }

              // Add remote training meeting link if available
              if (meetingLink) {
                portalUpdateData.Remote_Training_Meeting_Link__c = meetingLink
                console.log(`📝 Updating Onboarding_Portal__c with Remote_Training_Meeting_Link__c: ${meetingLink}`)
              }

              // Store Salesforce Event ID for future rescheduling
              if (newSalesforceEventId) {
                portalUpdateData.Training_Salesforce_Event_ID__c = newSalesforceEventId
                console.log(`📝 Updating Onboarding_Portal__c with Training_Salesforce_Event_ID__c: ${newSalesforceEventId}`)
              }
            } else if (bookingType === 'installation') {
              // ALWAYS update date/time and event ID (critical for rescheduling)
              portalUpdateData.Installation_Date__c = dateTimeValue
              // Installer_Name__c is a text field - use installer name
              portalUpdateData.Installer_Name__c = trainer.name
              console.log(`📝 Updating Onboarding_Portal__c with Installation_Date__c: ${dateTimeValue}`)
              console.log(`📝 Updating Onboarding_Portal__c with Installer_Name__c: ${trainer.name}`)
            }

            console.log(`📝 Updating Onboarding_Portal__c.${eventIdField} with event ID: ${eventId}`)
            await conn.sobject('Onboarding_Portal__c').update(portalUpdateData)
            console.log(`✅ Successfully updated Onboarding_Portal__c (event ID + date/time + person name)`)
          } catch (portalUpdateError: any) {
            console.log(`⚠️ Failed to update Portal:`, portalUpdateError.message)
            console.log(`   Portal will not be updated, but booking succeeded`)
          }
        }
      }

      console.log('Salesforce update result:', updateResult)

      // Check if update was successful
      if (updateResult.success || updateResult.id) {
        salesforceUpdated = true
        console.log('Training date updated successfully in Salesforce')
      } else {
        console.error('Salesforce update failed:', updateResult.errors)
        salesforceUpdated = false
      }
    } catch (sfError: any) {
      const errorMessage = sfError.message || sfError
      console.error('Failed to update Salesforce:', errorMessage)
      salesforceUpdated = false
      
      // If it's a permission/validation error for hardware fulfillment, provide clearer feedback
      if (bookingType === 'hardware-fulfillment' && errorMessage.includes('CSM')) {
        console.log('⚠️ Note: Hardware Fulfillment Date requires special permissions in Salesforce')
      }
    }

    // Send notification to the assigned trainer
    try {
      await sendBookingNotification({
        merchantName: onboardingTrainerName || merchantName,
        merchantId,
        date,
        startTime,
        endTime,
        bookingType,
        isRescheduling: !!existingEventId,
        assignedPersonName: assignment.assigned,
        assignedPersonEmail: trainer.email,
        location: merchantAddress,
        // Use Merchant PIC contact if available, otherwise fall back to provided contact
        contactPerson: merchantPICName || merchantContactPerson,
        contactPhone: merchantPICPhone || merchantPhone,
        onboardingServicesBought: onboardingServicesBought  // Add onboarding services bought to notification
      })
      console.log('📧 Notification sent to trainer:', trainer.email)
    } catch (notificationError) {
      console.error('Notification failed but booking succeeded:', notificationError)
      // Don't fail the booking if notification fails
    }

    // Send notification to the Onboarding Manager (MSM)
    if (msmEmail) {
      try {
        await sendManagerBookingNotification({
          merchantName: onboardingTrainerName || merchantName,
          merchantId,
          date,
          startTime,
          endTime,
          bookingType,
          isRescheduling: !!existingEventId,
          assignedPersonName: assignment.assigned,
          assignedPersonEmail: msmEmail, // Manager email instead of trainer
          location: merchantAddress,
          contactPerson: merchantPICName || merchantContactPerson,
          contactPhone: merchantPICPhone || merchantPhone,
          onboardingServicesBought: onboardingServicesBought
        })
        console.log('📧 Manager notification sent to MSM:', msmEmail)
      } catch (managerNotificationError) {
        console.error('Manager notification failed but booking succeeded:', managerNotificationError)
        // Don't fail the booking if notification fails
      }
    } else {
      console.log('⚠️ No MSM email found - skipping manager notification')
    }

    // Create Salesforce Task for training booking/rescheduling
    if (msmEmail && bookingType === 'training') {
      try {
        const msmUserId = await getMsmSalesforceUserId(msmEmail)

        if (msmUserId) {
          const formattedDate = new Date(`${date}T${startTime}`).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })

          const isRescheduling = !!existingEventId
          const taskType = isRescheduling ? 'TRAINING_RESCHEDULING' : 'TRAINING_BOOKING'
          const actionText = isRescheduling ? 'RESCHEDULED' : 'BOOKED'

          const taskResult = await createSalesforceTask({
            subject: `[Portal] Check training date for ${onboardingTrainerName || merchantName}`,
            description: `Merchant: ${onboardingTrainerName || merchantName}

Training ${actionText} via Portal

Date: ${formattedDate}
Time: ${startTime} - ${endTime}
Type: ${serviceType === 'onsite' ? 'Onsite Training' : 'Remote Training'}
Trainer: ${assignment.assigned}

Contact: ${merchantPICName || merchantContactPerson || 'N/A'}
Phone: ${merchantPICPhone || merchantPhone || 'N/A'}

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
                merchantName: onboardingTrainerName || merchantName,
                msmEmail
              }
            })
            console.log(`✅ Salesforce Task created for training ${isRescheduling ? 'rescheduling' : 'booking'}: ${taskResult.taskId}`)
          } else {
            console.log(`⚠️ Failed to create Salesforce Task: ${taskResult.error}`)
          }
        } else {
          console.log(`⚠️ No Salesforce User found for ${msmEmail}, skipping task creation`)
        }
      } catch (taskError) {
        console.error('❌ Failed to create Salesforce Task for training:', taskError)
        // Don't fail the booking if task creation fails
      }
    }

    // Track the booking event
    try {
      const cookieStore = await cookies()
      const sessionId = cookieStore.get('analytics-session-id')?.value || generateSessionId(request)
      const { userAgent, ipAddress, deviceType } = getClientInfo(request)
      
      // Get user info from auth token
      let isInternalUser = false
      let userType = 'merchant'
      const authToken = cookieStore.get('auth-token')?.value
      if (authToken) {
        const decoded = verifyToken(authToken)
        if (decoded) {
          isInternalUser = decoded.isInternalUser || false
          userType = decoded.userType || 'internal_team'
        }
      }
      
      const eventAction = bookingType === 'training' ? 'training_scheduled' : 
                          bookingType === 'installation' ? 'installation_scheduled' : 
                          `${bookingType}_scheduled`
      
      await trackEvent({
        merchantId: merchantId,
        merchantName: onboardingTrainerName || merchantName,
        page: `booking-${bookingType}`,
        action: eventAction,
        sessionId,
        userAgent,
        deviceType,
        ipAddress,
        isInternalUser,
        userType,
        metadata: {
          bookedBy: isInternalUser ? 'internal' : 'merchant',
          bookingType: bookingType,
          date: date,
          startTime: startTime,
          endTime: endTime,
          assignedTrainer: assignment.assigned,
          isRescheduling: !!existingEventId,
          serviceType: onboardingServicesBought
        }
      })
      console.log(`📊 Analytics: ${bookingType} scheduling tracked`)
    } catch (analyticsError) {
      console.error(`Failed to track ${bookingType} scheduling:`, analyticsError)
      // Don't fail the request if analytics fails
    }

    return NextResponse.json({
      success: true,
      eventId,
      assignedTrainer: assignment.assigned,
      assignmentReason: assignment.reason,
      salesforceUpdated,
      trainingDate: `${date}T${startTime}:00`,
      message: `Training session booked with ${assignment.assigned} for ${date} from ${startTime} to ${endTime}`
    })
  } catch (error) {
    console.error('Error booking training:', error)
    return NextResponse.json(
      { error: 'Failed to book training session' },
      { status: 500 }
    )
  }
}