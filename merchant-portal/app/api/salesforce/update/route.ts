import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, updates } = body

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID is required' },
        { status: 400 }
      )
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }

    // Get Salesforce connection
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Salesforce' },
        { status: 500 }
      )
    }

    // Validate that the account exists
    try {
      const accountCheck = await conn.query(`SELECT Id FROM Account WHERE Id = '${accountId}' LIMIT 1`)
      if (accountCheck.totalSize === 0) {
        return NextResponse.json(
          { success: false, error: 'Account not found' },
          { status: 404 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `Account validation failed: ${error}` },
        { status: 400 }
      )
    }

    // Prepare the update object
    const updateData: any = { Id: accountId }
    
    // Map frontend field names to Salesforce field names
    const fieldMapping: { [key: string]: string } = {
      businessStoreName: 'Business_Store_Name__c',
      onboardingTrainer: 'Onboarding_Trainer__c',
      servicesBought: 'Onboarding_Services_Bought__c',
      goLiveStageTimestamp: 'Go_Live_Stage_Timestamp__c',
      plannedGoLiveDate: 'Planned_Go_Live_Date__c',
      finalisedGoLiveDate: 'Finalised_Go_Live_Date__c',
      onboardingCompletedTimestamp: 'Onboarding_Completed_Stage_Timestamp__c',
      latestStageDate: 'Latest_Stage_Date__c',
      latestSFStage: 'Latest_SF_Stage__c',
      onboardingTrainerStage: 'Onboarding_Trainer_Stage__c'
    }

    // Convert updates to Salesforce field names
    for (const [frontendField, value] of Object.entries(updates)) {
      const salesforceField = fieldMapping[frontendField]
      if (salesforceField) {
        updateData[salesforceField] = value
      }
    }

    // Test each field individually to see which ones are writable
    const writableFields: string[] = []
    const nonWritableFields: string[] = []
    const finalUpdateData: any = { Id: accountId }

    for (const [salesforceField, value] of Object.entries(updateData)) {
      if (salesforceField === 'Id') continue

      try {
        // Test if we can update this single field
        const testUpdate = { Id: accountId, [salesforceField]: value }
        await conn.sobject('Account').update(testUpdate)
        writableFields.push(salesforceField)
        finalUpdateData[salesforceField] = value
      } catch (fieldError: any) {
        nonWritableFields.push(salesforceField)
        console.log(`Field ${salesforceField} is not writable:`, fieldError.message)
      }
    }

    // If no fields are writable, return error
    if (writableFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No fields are writable with current permissions',
        nonWritableFields,
        details: 'Check field-level security settings in Salesforce'
      }, { status: 403 })
    }

    // Perform the update with only writable fields
    try {
      const result = await conn.sobject('Account').update(finalUpdateData)

      if (result.success) {
        // Fetch the updated record to return current values
        const fieldsToQuery = Object.values(fieldMapping).filter(field => 
          Object.keys(updates).some(key => fieldMapping[key] === field)
        )
        
        const updatedRecord = await conn.query(`
          SELECT Id, Name, ${fieldsToQuery.join(', ')}
          FROM Account 
          WHERE Id = '${accountId}'
        `)

        const account = updatedRecord.records[0] as any
        const updatedData: any = {
          id: account.Id,
          name: account.Name
        }

        // Map back to frontend field names
        for (const [frontendField, salesforceField] of Object.entries(fieldMapping)) {
          if (fieldsToQuery.includes(salesforceField)) {
            updatedData[frontendField] = account[salesforceField]
          }
        }

        return NextResponse.json({
          success: true,
          message: `Account updated successfully! ${writableFields.length} field(s) updated.`,
          updatedData,
          salesforceResult: result,
          writableFields,
          nonWritableFields: nonWritableFields.length > 0 ? nonWritableFields : undefined,
          permissionWarning: nonWritableFields.length > 0 ?
            `Some fields couldn't be updated due to permissions: ${nonWritableFields.join(', ')}` : undefined
        })
      } else {
        return NextResponse.json(
          { success: false, error: 'Salesforce update failed', details: result },
          { status: 400 }
        )
      }
    } catch (updateError: any) {
      return NextResponse.json(
        { success: false, error: `Update failed: ${updateError.message}` },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('Salesforce update error:', error)
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}
