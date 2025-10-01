import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { opportunityId, updates } = body

    if (!opportunityId) {
      return NextResponse.json(
        { success: false, error: 'Opportunity ID is required' },
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

    // Validate that the opportunity exists
    try {
      const oppCheck = await conn.query(`SELECT Id FROM Opportunity WHERE Id = '${opportunityId}' LIMIT 1`)
      if (oppCheck.totalSize === 0) {
        return NextResponse.json(
          { success: false, error: 'Opportunity not found' },
          { status: 404 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `Opportunity validation failed: ${error}` },
        { status: 400 }
      )
    }

    // Map frontend field names to Salesforce field names
    const fieldMapping: { [key: string]: string } = {
      name: 'Name',
      stageName: 'StageName',
      amount: 'Amount',
      closeDate: 'CloseDate',
      onboardingTrainer: 'Onboarding_Trainer__c',
      firstRevisedEGLD: 'First_Revised_EGLD__c'
    }

    // Test each field individually to see which ones are writable
    const writableFields: string[] = []
    const nonWritableFields: string[] = []
    const finalUpdateData: any = { Id: opportunityId }

    for (const [frontendField, value] of Object.entries(updates)) {
      const salesforceField = fieldMapping[frontendField]
      if (salesforceField) {
        try {
          // Test if we can update this single field
          const testUpdate = { Id: opportunityId, [salesforceField]: value }
          await conn.sobject('Opportunity').update(testUpdate)
          writableFields.push(salesforceField)
          finalUpdateData[salesforceField] = value
        } catch (fieldError: any) {
          nonWritableFields.push(salesforceField)
          console.log(`Field ${salesforceField} is not writable:`, fieldError.message)
        }
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
      const result = await conn.sobject('Opportunity').update(finalUpdateData)
      
      if (result.success) {
        // Fetch the updated record to return current values
        const fieldsToQuery = Object.values(fieldMapping).filter(field => 
          writableFields.includes(field)
        )
        
        const updatedRecord = await conn.query(`
          SELECT Id, Name, StageName, Amount, CloseDate,
                 Onboarding_Trainer__c, First_Revised_EGLD__c
          FROM Opportunity 
          WHERE Id = '${opportunityId}'
        `)

        const opportunity = updatedRecord.records[0] as any
        const updatedData: any = {
          id: opportunity.Id,
          name: opportunity.Name,
          stageName: opportunity.StageName,
          amount: opportunity.Amount,
          closeDate: opportunity.CloseDate,
          onboardingTrainer: opportunity.Onboarding_Trainer__c,
          firstRevisedEGLD: opportunity.First_Revised_EGLD__c
        }

        return NextResponse.json({
          success: true,
          message: `Opportunity updated successfully! ${writableFields.length} field(s) updated.`,
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
    console.error('Salesforce opportunity update error:', error)
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}
