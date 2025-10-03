import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function POST(request: NextRequest) {
  try {
    const { trainerId, fieldName, value, bookingType } = await request.json()

    if (!trainerId || !fieldName) {
      return NextResponse.json(
        { success: false, message: 'Trainer ID and field name are required' },
        { status: 400 }
      )
    }

    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { success: false, message: 'Failed to connect to Salesforce' },
        { status: 500 }
      )
    }

    // Map booking types to Salesforce field names and objects
    const fieldMapping: { [key: string]: { field: string, object: string } } = {
      'hardware-fulfillment': { field: 'Hardware_Fulfillment_Date__c', object: 'Order' },
      'installation': { field: 'Installation_Date__c', object: 'Onboarding_Trainer__c' },
      'training': { field: 'Training_Date__c', object: 'Onboarding_Trainer__c' },
      'go-live': { field: 'First_Revised_EGLD__c', object: 'Onboarding_Trainer__c' },
      'firstRevisedEGLD': { field: 'First_Revised_EGLD__c', object: 'Onboarding_Trainer__c' },
      'installationDate': { field: 'Installation_Date__c', object: 'Onboarding_Trainer__c' },
      'trainingDate': { field: 'Training_Date__c', object: 'Onboarding_Trainer__c' },
      'hardwareFulfillmentDate': { field: 'Hardware_Fulfillment_Date__c', object: 'Order' }
    }

    // Get the actual Salesforce field name and object
    const mapping = fieldMapping[bookingType] || fieldMapping[fieldName]
    
    if (!mapping) {
      return NextResponse.json(
        { success: false, message: `Unknown field mapping for: ${bookingType || fieldName}` },
        { status: 400 }
      )
    }
    
    const { field: sfFieldName, object: sfObject } = mapping

    let result: any = null
    
    if (sfObject === 'Order') {
      // For Order object, we need to find the Order first
      console.log('📦 Updating Hardware Fulfillment Date in Order object')
      console.log('Looking for trainer with ID:', trainerId)
      
      // Get the OnboardingTrainer to find associated Account
      const trainer = await conn.sobject('Onboarding_Trainer__c')
        .select('Id, Account_Name__c')
        .where({ Id: trainerId })
        .limit(1)
        .execute()
      
      if (!trainer || trainer.length === 0) {
        console.log('❌ No trainer found with ID:', trainerId)
        return NextResponse.json(
          { success: false, message: 'Trainer not found' },
          { status: 404 }
        )
      }
      
      const accountId = trainer[0].Account_Name__c
      console.log('Found Account ID:', accountId)
      
      // Find Order for this Account
      const orders = await conn.query(
        `SELECT Id FROM Order WHERE AccountId = '${accountId}' LIMIT 1`
      )
      
      if (!orders.records || orders.records.length === 0) {
        console.log('❌ No Order found for Account:', accountId)
        return NextResponse.json(
          { success: false, message: 'No Order found for this account' },
          { status: 404 }
        )
      }
      
      const orderId = orders.records[0].Id
      console.log('Found Order ID:', orderId)
      
      // Update the Order
      const orderUpdateData: any = {
        Id: orderId
      }
      
      if (value) {
        const dateValue = new Date(value).toISOString().split('T')[0]
        orderUpdateData[sfFieldName] = dateValue
      } else {
        orderUpdateData[sfFieldName] = null
      }
      
      console.log('Updating Order with:', orderUpdateData)
      console.log('Field name:', sfFieldName, 'Value:', value)
      
      result = await conn.sobject('Order').update(orderUpdateData)
      console.log('Order update result:', result)
      
    } else {
      // Update Onboarding_Trainer__c record
      const updateData: any = {
        Id: trainerId
      }
      
      // Set the field value - handle both date strings and null values
      if (value) {
        // Ensure date is in YYYY-MM-DD format for Salesforce
        const dateValue = new Date(value).toISOString().split('T')[0]
        updateData[sfFieldName] = dateValue
      } else {
        updateData[sfFieldName] = null
      }

      console.log('Updating Onboarding_Trainer__c with:', updateData)
      result = await conn.sobject('Onboarding_Trainer__c').update(updateData)
    }

    if (result.success) {
      // Fetch the updated record to return fresh data
      const updatedRecord = await conn.sobject('Onboarding_Trainer__c')
        .select('Id, Name, First_Revised_EGLD__c, Installation_Date__c, Training_Date__c')
        .where({ Id: trainerId })
        .limit(1)
        .execute()

      return NextResponse.json({
        success: true,
        message: `Successfully updated ${sfFieldName}`,
        updatedData: updatedRecord[0],
        fieldUpdated: sfFieldName,
        newValue: value
      })
    } else {
      console.error('Salesforce update failed:', result)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to update Salesforce',
          error: result.errors?.join(', ') || 'Unknown error'
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Date update error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update date',
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}