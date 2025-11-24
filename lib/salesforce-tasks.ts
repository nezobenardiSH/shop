import { getSalesforceConnection } from './salesforce'

/**
 * Salesforce Task Creation and Management Module
 *
 * This module handles automatic creation of Salesforce Tasks for:
 * - Menu submissions
 * - Store setup video uploads
 * - External vendor booking requests
 */

// Type definitions
export interface CreateTaskParams {
  subject: string
  description: string
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Waiting on someone else' | 'Deferred'
  priority: 'High' | 'Normal' | 'Low'
  ownerId: string // Salesforce User ID
  whatId: string // Related record ID (e.g., Onboarding_Trainer__c)
  activityDate: string // Due date in YYYY-MM-DD format
}

export interface TaskResponse {
  success: boolean
  taskId?: string
  message?: string
  error?: string
}

export interface UserQueryResult {
  Id: string
  Email: string
  Name: string
}

/**
 * Get Salesforce User ID from email address
 * @param email - User's email address
 * @returns Salesforce User ID or null if not found
 */
export async function getMsmSalesforceUserId(email: string): Promise<string | null> {
  try {
    const conn = await getSalesforceConnection()
    if (!conn) {
      console.error('Cannot get MSM Salesforce User ID - no connection')
      return null
    }

    // Query User by email
    const query = `SELECT Id, Email, Name FROM User WHERE Email = '${email}' AND IsActive = true LIMIT 1`
    const result = await conn.query(query)

    if (result.totalSize === 0) {
      console.warn(`No active Salesforce User found with email: ${email}`)
      return null
    }

    const user = result.records[0] as UserQueryResult
    console.log(`✅ Found Salesforce User: ${user.Name} (${user.Id})`)
    return user.Id

  } catch (error) {
    console.error('Error getting MSM Salesforce User ID:', error)
    return null
  }
}

/**
 * Create a Task in Salesforce
 * @param params - Task creation parameters
 * @returns TaskResponse with success status and task ID
 */
export async function createSalesforceTask(params: CreateTaskParams): Promise<TaskResponse> {
  try {
    const conn = await getSalesforceConnection()
    if (!conn) {
      return {
        success: false,
        error: 'No Salesforce connection available'
      }
    }

    // Validate required fields
    if (!params.ownerId) {
      return {
        success: false,
        error: 'OwnerId is required - cannot assign task without owner'
      }
    }

    // Prepare Task data
    const taskData = {
      Subject: params.subject,
      Description: params.description,
      Status: params.status,
      Priority: params.priority,
      OwnerId: params.ownerId,
      WhatId: params.whatId,
      ActivityDate: params.activityDate
    }

    console.log('📝 Creating Salesforce Task:', {
      subject: params.subject,
      owner: params.ownerId,
      whatId: params.whatId
    })

    // Create Task
    const result = await conn.sobject('Task').create(taskData)

    if (result.success && result.id) {
      console.log(`✅ Salesforce Task created successfully: ${result.id}`)
      return {
        success: true,
        taskId: result.id,
        message: 'Task created successfully'
      }
    } else {
      const errorMessages = result.errors?.join(', ') || 'Unknown error'
      console.error('❌ Task creation failed:', errorMessages)
      return {
        success: false,
        error: `Task creation failed: ${errorMessages}`
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error creating Salesforce Task:', errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Update an existing Task in Salesforce
 * @param taskId - Salesforce Task ID
 * @param updates - Fields to update (e.g., { Status: 'Completed' })
 * @returns TaskResponse with success status
 */
export async function updateSalesforceTask(
  taskId: string,
  updates: Partial<{
    Status: string
    CompletedDateTime: string
    Description: string
    Priority: string
  }>
): Promise<TaskResponse> {
  try {
    const conn = await getSalesforceConnection()
    if (!conn) {
      return {
        success: false,
        error: 'No Salesforce connection available'
      }
    }

    console.log('🔄 Updating Salesforce Task:', taskId)

    const result = await conn.sobject('Task').update({
      Id: taskId,
      ...updates
    })

    if (result.success) {
      console.log(`✅ Salesforce Task updated successfully: ${taskId}`)
      return {
        success: true,
        taskId: taskId,
        message: 'Task updated successfully'
      }
    } else {
      const errorMessages = result.errors?.join(', ') || 'Unknown error'
      console.error('❌ Task update failed:', errorMessages)
      return {
        success: false,
        error: `Task update failed: ${errorMessages}`
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error updating Salesforce Task:', errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Helper function to format Salesforce record URL
 * @param recordId - Salesforce record ID
 * @returns Full URL to the record in Salesforce
 */
export function getSalesforceRecordUrl(recordId: string): string {
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL || 'https://storehub.lightning.force.com'
  return `${instanceUrl}/${recordId}`
}

/**
 * Helper function to get today's date in Salesforce date format (YYYY-MM-DD)
 * Uses Singapore timezone (GMT+8)
 */
export function getTodayDateString(): string {
  const now = new Date()
  // Convert to Singapore timezone (GMT+8)
  const singaporeTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }))
  const year = singaporeTime.getFullYear()
  const month = String(singaporeTime.getMonth() + 1).padStart(2, '0')
  const day = String(singaporeTime.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Helper function to get date N days from now in Salesforce format
 * @param daysFromNow - Number of days to add to today
 */
export function getFutureDateString(daysFromNow: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().split('T')[0]
}
