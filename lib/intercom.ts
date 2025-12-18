/**
 * Intercom API Client
 *
 * Creates L2 Onsite Support tickets for internal installer bookings.
 *
 * API Documentation: https://developers.intercom.com/docs/references/rest-api/api.intercom.io/tickets
 */

// API Configuration
const INTERCOM_API_URL = 'https://api.intercom.io'
const INTERCOM_ACCESS_TOKEN = process.env.INTERCOM_ACCESS_TOKEN
const INTERCOM_L2_ONSITE_TICKET_TYPE_ID = process.env.INTERCOM_L2_ONSITE_TICKET_TYPE_ID || '10'
const INTERCOM_WORKSPACE_ID = 'v2axofpf'
const INTERCOM_L2_ONSITE_TEAM_ID = '5372074'

// Intercom API Version
const INTERCOM_VERSION = '2.11'

/**
 * Build Intercom ticket URL from ticket ID
 */
export function getIntercomTicketUrl(ticketId: string): string {
  return `https://app.intercom.com/a/inbox/${INTERCOM_WORKSPACE_ID}/inbox/conversation/${ticketId}?view=List`
}

// Installer Name → Intercom Admin ID mapping (for ticket assignment)
// Only internal installers from config/installers.json
const INSTALLER_ADMIN_IDS: { [key: string]: string } = {
  'Fattah': '7930989',      // Klang Valley
  'Fairul': '7505941',      // Klang Valley
  'Azroll': '7930993',      // Klang Valley
  'Steven Tan': '7535954',  // Penang
  'Faizul': '7014309',      // Johor Bahru
}

/**
 * Get Intercom admin ID for an installer name
 */
function getInstallerAdminId(installerName: string): string | null {
  // Try exact match first
  if (INSTALLER_ADMIN_IDS[installerName]) {
    return INSTALLER_ADMIN_IDS[installerName]
  }

  // Try partial match (case-insensitive)
  const nameLower = installerName.toLowerCase()
  for (const [key, value] of Object.entries(INSTALLER_ADMIN_IDS)) {
    if (nameLower.includes(key.toLowerCase()) || key.toLowerCase().includes(nameLower)) {
      return value
    }
  }

  return null
}

// L2 Onsite Support List Attribute IDs (from Intercom ticket type configuration)
const LIST_OPTIONS = {
  // Country options
  country: {
    'Malaysia': '753a2d23-a293-4599-933b-0b1f5cc12646',
    'Philippines': '1d637d25-6e6b-470c-9a7c-0c08f7523661'
  },
  // State/Province options
  stateProvince: {
    'Klang Valley': '6f10c2b4-01a0-4597-8b8b-c617d8d924b3',
    'Penang': '5e917db5-fae3-4fbd-95a9-0faff55dbed3',
    'Johor': 'a8caf515-d26e-4891-9ef7-ff30f3635a70',
    'Manila': 'abd28951-099a-42b2-8883-f32730e91106',
    'Others': 'a4d3aec3-c27e-4931-9acf-9b3daa5125c9'
  },
  // Requestor Department options
  requestorDepartment: {
    'Success : MSM': '393f475c-d43b-478d-9715-afe7a864a7e0',
    'Success : AM & Renewal': 'c7ea7964-7f7d-4fd4-8642-66aefb222ba1',
    'Success : Onboarding & CSM': '0c23d029-aecd-4b37-b6e0-edcedc147559',
    'CX Care : T1 or T2': '07d44100-85f1-4af8-8a89-1a13ab9bd481'
  },
  // Onsite Request Type options
  onsiteRequestType: {
    'Hardware Installation - New Merchant': 'e6db91f5-4072-46e7-8623-00bf69bf584e',
    'Site Inspection - New Merchant': '361295b1-aa41-42b4-a14e-bd6bf4914125',
    'Site Inspection - Existing Merchant': '37920c12-bd8a-4b03-ae8f-9c59fc16a0c4',
    'POS Hardware Troubleshooting': 'f8961515-e236-4d26-8180-c36714f12cec',
    'Hardware Installation - Existing Merchant': 'ca256fdb-7d3a-4655-b1b4-beeb8fe3a33f'
  }
}

/**
 * Merchant data required for L2 Onsite Support ticket
 */
export interface L2OnsiteSupportMerchantData {
  // Merchant identifiers
  boAccountName: string
  merchantId: string

  // Location
  shippingCountry: string
  shippingState: string
  shippingStreet: string
  shippingCity: string

  // Contact (PIC)
  picName: string
  picEmail: string
  picContactNumber: string

  // MSM (Requestor)
  msmName: string

  // Installation details
  installationDate: string
  hardwareItems: string[]

  // Assignee
  installerName: string
}

/**
 * Intercom ticket creation response
 */
export interface IntercomTicketResponse {
  type: string
  id: string
  ticket_id: string
  ticket_attributes: Record<string, any>
  ticket_state: string
  ticket_type: {
    type: string
    id: string
    name: string
  }
  contacts: {
    type: string
    contacts: Array<{ id: string; external_id?: string }>
  }
  admin_assignee_id?: string
  team_assignee_id?: string
  created_at: number
  updated_at: number
  open: boolean
  linked_objects: {
    type: string
    total_count: number
    has_more: boolean
    data: any[]
  }
  ticket_parts: {
    type: string
    ticket_parts: any[]
    total_count: number
  }
}

/**
 * Intercom error response
 */
export interface IntercomErrorResponse {
  type: 'error.list'
  request_id: string
  errors: Array<{
    code: string
    message: string
  }>
}

/**
 * Check if Intercom is configured
 */
export function isIntercomConfigured(): boolean {
  return Boolean(INTERCOM_ACCESS_TOKEN && INTERCOM_L2_ONSITE_TICKET_TYPE_ID)
}

/**
 * Make authenticated request to Intercom API
 */
async function makeIntercomRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, any>
): Promise<T> {
  if (!INTERCOM_ACCESS_TOKEN) {
    throw new Error('INTERCOM_ACCESS_TOKEN is not configured')
  }

  const url = `${INTERCOM_API_URL}${endpoint}`

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${INTERCOM_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Intercom-Version': INTERCOM_VERSION,
      'Accept': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await response.json()

  if (!response.ok) {
    const errorData = data as IntercomErrorResponse
    const errorMessage = errorData.errors?.[0]?.message || 'Unknown Intercom API error'
    const errorCode = errorData.errors?.[0]?.code || 'unknown'
    throw new Error(`Intercom API error (${errorCode}): ${errorMessage}`)
  }

  return data as T
}

/**
 * Build the onsite request description from installation date and hardware
 */
function buildOnsiteRequestDescription(
  installationDate: string,
  hardwareItems: string[]
): string {
  const hardwareList = hardwareItems.length > 0
    ? hardwareItems.join(', ')
    : 'N/A'

  return `${installationDate} - ${hardwareList}`
}

/**
 * Build the full store address
 */
function buildFullStoreAddress(
  street: string,
  city: string,
  state: string
): string {
  const parts = [street, city, state].filter(p => p && p.trim())
  return parts.join(', ') || 'N/A'
}

/**
 * Map country name to Intercom list option ID
 */
function getCountryOptionId(country: string): string {
  const countryLower = country?.toLowerCase() || ''
  if (countryLower.includes('philippines')) {
    return LIST_OPTIONS.country['Philippines']
  }
  // Default to Malaysia
  return LIST_OPTIONS.country['Malaysia']
}

/**
 * Map state/province to Intercom list option ID
 */
function getStateOptionId(state: string): string {
  const stateLower = state?.toLowerCase() || ''

  if (stateLower.includes('klang') || stateLower.includes('kuala lumpur') || stateLower.includes('selangor')) {
    return LIST_OPTIONS.stateProvince['Klang Valley']
  }
  if (stateLower.includes('penang') || stateLower.includes('pulau pinang')) {
    return LIST_OPTIONS.stateProvince['Penang']
  }
  if (stateLower.includes('johor')) {
    return LIST_OPTIONS.stateProvince['Johor']
  }
  if (stateLower.includes('manila')) {
    return LIST_OPTIONS.stateProvince['Manila']
  }
  // Default to Others for any other state
  return LIST_OPTIONS.stateProvince['Others']
}

/**
 * Create an L2 Onsite Support ticket in Intercom
 *
 * @param merchantData - The merchant data from Salesforce
 * @returns The created ticket ID or null if creation failed
 */
export async function createL2OnsiteSupportTicket(
  merchantData: L2OnsiteSupportMerchantData
): Promise<{ ticketId: string; ticketUrl: string } | null> {
  if (!isIntercomConfigured()) {
    console.log('⚠️ Intercom is not configured, skipping ticket creation')
    return null
  }

  console.log('🎫 Creating Intercom L2 Onsite Support ticket...')
  console.log('   Merchant:', merchantData.boAccountName)
  console.log('   PIC:', merchantData.picName)
  console.log('   Email:', merchantData.picEmail)
  console.log('   Installation Date:', merchantData.installationDate)
  console.log('   Installer:', merchantData.installerName)

  try {
    // Build the ticket attributes
    const onsiteRequestDescription = buildOnsiteRequestDescription(
      merchantData.installationDate,
      merchantData.hardwareItems
    )

    const fullStoreAddress = buildFullStoreAddress(
      merchantData.shippingStreet,
      merchantData.shippingCity,
      merchantData.shippingState
    )

    // Get installer admin ID for assignment
    const installerAdminId = getInstallerAdminId(merchantData.installerName)
    console.log('👤 Looking up admin ID for installer:', merchantData.installerName)
    console.log('👤 Installer admin ID:', installerAdminId || 'NOT FOUND - check INSTALLER_ADMIN_IDS mapping')

    // Create ticket request body
    // Note: List attributes require the list item ID, not the label
    const ticketRequest: any = {
      ticket_type_id: INTERCOM_L2_ONSITE_TICKET_TYPE_ID,
      contacts: [
        { email: merchantData.picEmail }
      ],
      ticket_attributes: {
        // Default fields
        _default_title_: `Installation - ${merchantData.boAccountName}`,
        _default_description_: '',
        // List fields - use IDs
        Country: getCountryOptionId(merchantData.shippingCountry),
        'State/Province': getStateOptionId(merchantData.shippingState),
        'Express Request - 3 hours Onsite Request': false,
        'Requestor Department': LIST_OPTIONS.requestorDepartment['Success : MSM'],
        'Onsite Request Type': LIST_OPTIONS.onsiteRequestType['Hardware Installation - New Merchant'],
        // String fields
        Requestor: merchantData.msmName || '',
        'Onsite request description': onsiteRequestDescription,
        'Merchant Account Name': merchantData.boAccountName,
        'PIC Name': merchantData.picName || '',
        'PIC Email': merchantData.picEmail,
        'PIC Contact Number': merchantData.picContactNumber || '',
        'FULL Store Address': fullStoreAddress,
        'Loan Hardware Serial Number (n/a if not applicable)': '-',
        'Fixed Hardware Serial Number (n/a if not applicable)': '-',
        // Custom field for workflow assignment
        'Assignee ID': installerAdminId || ''
      }
    }

    console.log('📤 Intercom ticket request:', JSON.stringify(ticketRequest, null, 2))

    const response = await makeIntercomRequest<IntercomTicketResponse>(
      '/tickets',
      'POST',
      ticketRequest
    )

    const ticketUrl = getIntercomTicketUrl(response.id)

    console.log('✅ Intercom ticket created successfully')
    console.log('   Internal ID (for API):', response.id)
    console.log('   Display Ticket ID:', response.ticket_id)
    console.log('   State:', response.ticket_state)

    // Step 2: Assign the ticket with a separate UPDATE call
    // UPDATE uses different fields: assignment.admin_id and assignment.assignee_id
    if (installerAdminId) {
      try {
        console.log('📤 Assigning ticket to installer:', installerAdminId)
        const assignRequest = {
          assignment: {
            admin_id: installerAdminId,
            assignee_id: installerAdminId
          }
        }
        console.log('📤 Assignment request:', JSON.stringify(assignRequest, null, 2))

        const assignResponse = await makeIntercomRequest<IntercomTicketResponse>(
          `/tickets/${response.id}`,
          'PUT',
          assignRequest
        )
        console.log('✅ Ticket assigned successfully')
        console.log('   Admin Assignee ID:', assignResponse.admin_assignee_id || 'NOT SET')
      } catch (assignError) {
        console.error('❌ Failed to assign ticket:', assignError)
        // Continue - ticket was created, just not assigned
      }
    }

    console.log('   URL:', ticketUrl)

    // Return the internal 'id' for API operations, not 'ticket_id' (display only)
    return { ticketId: response.id, ticketUrl }
  } catch (error) {
    console.error('❌ Failed to create Intercom ticket:', error)
    // Return null instead of throwing to not fail the booking flow
    return null
  }
}

/**
 * Update an existing L2 Onsite Support ticket (for rescheduling)
 * Only updates the date/time in description and reassigns to new installer
 */
export async function updateL2OnsiteSupportTicket(
  ticketId: string,
  installationDate: string,
  installerName: string,
  hardwareItems: string[]
): Promise<{ ticketId: string; ticketUrl: string } | null> {
  if (!isIntercomConfigured()) {
    console.log('⚠️ Intercom is not configured, skipping ticket update')
    return null
  }

  console.log('🔄 Updating Intercom ticket for rescheduling...')
  console.log('   Ticket ID:', ticketId)
  console.log('   New Installation Date:', installationDate)
  console.log('   New Installer:', installerName)

  try {
    // Get installer admin ID for reassignment
    const installerAdminId = getInstallerAdminId(installerName)
    console.log('👤 New Installer admin ID:', installerAdminId || 'Not found')

    // Build new description with updated date
    const onsiteRequestDescription = buildOnsiteRequestDescription(
      installationDate,
      hardwareItems
    )

    // Update ticket request body
    const updateRequest: any = {
      ticket_attributes: {
        'Onsite request description': onsiteRequestDescription,
        // Update Assignee ID attribute
        'Assignee ID': installerAdminId || ''
      }
    }

    // For updates, directly assign via API (T2 Onsite Request rule won't run again)
    // Use assignment object with both admin_id and assignee_id
    if (installerAdminId) {
      updateRequest.assignment = {
        admin_id: installerAdminId,
        assignee_id: installerAdminId
      }
    }

    console.log('📤 Intercom ticket update request:', JSON.stringify(updateRequest, null, 2))

    const response = await makeIntercomRequest<IntercomTicketResponse>(
      `/tickets/${ticketId}`,
      'PUT',
      updateRequest
    )

    const ticketUrl = getIntercomTicketUrl(response.id)

    console.log('✅ Intercom ticket updated successfully')
    console.log('   Internal ID:', response.id)
    console.log('   Display Ticket ID:', response.ticket_id)
    console.log('   URL:', ticketUrl)

    return { ticketId: response.id, ticketUrl }
  } catch (error) {
    console.error('❌ Failed to update Intercom ticket:', error)
    // Return null instead of throwing to not fail the booking flow
    return null
  }
}

/**
 * Delete an Intercom ticket (for cancellation)
 */
export async function deleteIntercomTicket(ticketId: string): Promise<boolean> {
  if (!isIntercomConfigured()) {
    console.log('⚠️ Intercom is not configured, skipping ticket deletion')
    return false
  }

  if (!ticketId) {
    console.log('⚠️ No ticket ID provided, skipping deletion')
    return false
  }

  console.log('🗑️ Deleting Intercom ticket...')
  console.log('   Ticket ID:', ticketId)

  try {
    // Intercom doesn't have a DELETE endpoint for tickets
    // Instead, we close the ticket by setting open: false
    const updateRequest = {
      open: false,
      ticket_attributes: {
        _default_description_: 'Installation cancelled - ticket closed automatically'
      }
    }

    await makeIntercomRequest<IntercomTicketResponse>(
      `/tickets/${ticketId}`,
      'PUT',
      updateRequest
    )

    console.log('✅ Intercom ticket closed successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to close Intercom ticket:', error)
    return false
  }
}

/**
 * Get all ticket types from Intercom (useful for finding the L2 Onsite Support ticket type ID)
 */
export async function getTicketTypes(): Promise<any> {
  console.log('📋 Fetching Intercom ticket types...')

  try {
    const response = await makeIntercomRequest<any>(
      '/ticket_types',
      'GET'
    )

    console.log('✅ Retrieved ticket types:', JSON.stringify(response, null, 2))
    return response
  } catch (error) {
    console.error('❌ Failed to fetch ticket types:', error)
    throw error
  }
}

/**
 * Map Salesforce merchant data to L2OnsiteSupportMerchantData
 * This is a helper to extract the relevant fields from a Salesforce query result
 */
export function mapSalesforceToIntercomData(
  trainerData: any,
  portalData: any,
  hardwareItems: string[],
  installationDate: string,
  installerName: string
): L2OnsiteSupportMerchantData {
  return {
    boAccountName: trainerData.BO_Account_Name__c || trainerData.Name || '',
    merchantId: trainerData.Id,
    shippingCountry: trainerData.Shipping_Country__c || 'Malaysia',
    shippingState: trainerData.Shipping_State__c || '',
    shippingStreet: trainerData.Shipping_Street__c || '',
    shippingCity: trainerData.Shipping_City__c || '',
    picName: trainerData.Merchant_PIC_Name__c || '',
    picEmail: trainerData.Email__c || '',
    picContactNumber: trainerData.Merchant_PIC_Contact_Number__c || '',
    msmName: trainerData.MSM_Name__r?.Name || '',
    installationDate: installationDate,
    hardwareItems: hardwareItems,
    installerName: installerName
  }
}
