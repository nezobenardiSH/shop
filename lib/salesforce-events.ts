import { getSalesforceConnection } from './salesforce'

/**
 * Parameters for creating a Salesforce Event
 */
export interface CreateSalesforceEventParams {
  subject: string           // Event title (max 255 chars)
  startDateTime: string     // ISO 8601 with timezone, e.g., "2024-11-19T14:30:00+08:00"
  endDateTime: string       // ISO 8601 with timezone, e.g., "2024-11-19T16:30:00+08:00"
  ownerId: string          // Salesforce User ID (18 chars) - assigns event to trainer
  whatId: string           // Merchant/Account ID (18 chars) - links to merchant record
  type?: string            // Event type (e.g., "Meeting", "Training", "Installation")
  description?: string     // Meeting details, link, etc. (max 32000 chars)
  location?: string        // Physical address for onsite meetings (max 255 chars)
}

/**
 * Creates a Salesforce Event (Activity) for KPI tracking
 *
 * This function creates a calendar event in Salesforce that appears in the Activity timeline.
 * It's used to track trainer KPIs for training and installation bookings.
 *
 * @param params - Event creation parameters
 * @returns Salesforce Event ID if successful, null if failed
 *
 * @example
 * const eventId = await createSalesforceEvent({
 *   subject: 'Training: ABC Merchant',
 *   startDateTime: '2024-11-19T14:30:00+08:00',
 *   endDateTime: '2024-11-19T16:30:00+08:00',
 *   ownerId: '0058d000001234ABC',
 *   whatId: 'a0B8d000001234ABC',
 *   type: 'Training',
 *   description: 'Remote training with meeting link: https://...',
 *   location: '123 Main St, Singapore'
 * })
 */
export async function createSalesforceEvent(
  params: CreateSalesforceEventParams
): Promise<string | null> {
  try {
    const conn = await getSalesforceConnection()

    // Prepare event data according to Salesforce Event object schema
    // Reference: https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_event.htm
    const eventData = {
      Subject: params.subject,
      StartDateTime: params.startDateTime,
      EndDateTime: params.endDateTime,
      OwnerId: params.ownerId,        // Assigns event to trainer (for KPI tracking)
      WhatId: params.whatId,          // Links to merchant/account
      Type: params.type || 'Meeting',
      Description: params.description || '',
      Location: params.location || '',
      // Required boolean fields
      IsAllDayEvent: false,
      IsPrivate: false,               // Make visible for KPI tracking
      IsRecurrence: false,
      IsReminderSet: false
    }

    // Create the event using jsforce
    const result = await conn.sobject('Event').create(eventData)

    if (result.success) {
      console.log('[Salesforce Event] Created successfully:', {
        eventId: result.id,
        subject: params.subject,
        ownerId: params.ownerId,
        whatId: params.whatId
      })
      return result.id
    } else {
      console.error('[Salesforce Event] Creation failed:', {
        errors: result.errors,
        subject: params.subject
      })
      return null
    }
  } catch (error) {
    // Log error but don't throw - this is non-blocking
    console.error('[Salesforce Event] Error during creation:', {
      error: error instanceof Error ? error.message : String(error),
      subject: params.subject,
      ownerId: params.ownerId,
      whatId: params.whatId
    })
    return null
  }
}

/**
 * Updates an existing Salesforce Event (for rescheduling)
 *
 * This is used when a booking is rescheduled - we update the existing Event
 * rather than creating a new one to maintain clean Activity timeline.
 *
 * @param eventId - Existing Salesforce Event ID to update
 * @param params - Updated event parameters (same as create)
 * @returns true if successful, false if failed
 */
export async function updateSalesforceEvent(
  eventId: string,
  params: CreateSalesforceEventParams
): Promise<boolean> {
  try {
    const conn = await getSalesforceConnection()

    // Prepare update data
    // NOTE: IsRecurrence and IsReminderSet are read-only after creation, so we exclude them from updates
    const eventData = {
      Id: eventId,  // Include ID for update
      Subject: params.subject,
      StartDateTime: params.startDateTime,
      EndDateTime: params.endDateTime,
      OwnerId: params.ownerId,
      WhatId: params.whatId,
      Type: params.type || 'Meeting',
      Description: params.description || '',
      Location: params.location || '',
      IsAllDayEvent: false,
      IsPrivate: false
      // IsRecurrence: false,    // READ-ONLY - Cannot update after creation
      // IsReminderSet: false    // READ-ONLY - Cannot update after creation
    }

    const result = await conn.sobject('Event').update(eventData)

    if (result.success) {
      console.log('[Salesforce Event] Updated successfully:', {
        eventId,
        subject: params.subject,
        startDateTime: params.startDateTime,
        endDateTime: params.endDateTime
      })
      return true
    } else {
      console.error('[Salesforce Event] Update failed:', {
        eventId,
        errors: result.errors
      })
      return false
    }
  } catch (error) {
    console.error('[Salesforce Event] Error during update:', {
      error: error instanceof Error ? error.message : String(error),
      eventId,
      subject: params.subject
    })
    return false
  }
}

/**
 * Deletes a Salesforce Event by ID
 *
 * Useful for handling rescheduling scenarios where old events should be removed.
 *
 * @param eventId - Salesforce Event ID
 * @returns true if successful, false if failed
 */
export async function deleteSalesforceEvent(eventId: string): Promise<boolean> {
  try {
    const conn = await getSalesforceConnection()
    const result = await conn.sobject('Event').delete(eventId)

    if (result.success) {
      console.log('[Salesforce Event] Deleted successfully:', eventId)
      return true
    } else {
      console.error('[Salesforce Event] Deletion failed:', {
        eventId,
        errors: result.errors
      })
      return false
    }
  } catch (error) {
    console.error('[Salesforce Event] Error during deletion:', {
      error: error instanceof Error ? error.message : String(error),
      eventId
    })
    return false
  }
}
