import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trainerId, updates } = body

    if (!trainerId) {
      return NextResponse.json(
        { success: false, error: 'Trainer ID is required' },
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

    // Validate that the trainer exists
    try {
      const trainerCheck = await conn.query(`SELECT Id FROM Onboarding_Trainer__c WHERE Id = '${trainerId}' LIMIT 1`)
      if (trainerCheck.totalSize === 0) {
        return NextResponse.json(
          { success: false, error: 'Onboarding Trainer not found' },
          { status: 404 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `Trainer validation failed: ${error}` },
        { status: 400 }
      )
    }

    // Map frontend field names to Salesforce field names
    const fieldMapping: { [key: string]: string } = {
      name: 'Name',
      firstRevisedEGLD: 'First_Revised_EGLD__c',
      onboardingTrainerStage: 'Onboarding_Trainer_Stage__c',
      installationDate: 'Installation_Date__c',
      trainingDate: 'Training_Date__c',
      phoneNumber: 'Phone_Number__c',
      merchantPICContactNumber: 'Merchant_PIC_Contact_Number__c'
    }

    // Test each field individually to see which ones are writable
    const writableFields: string[] = []
    const nonWritableFields: string[] = []
    const finalUpdateData: any = { Id: trainerId }

    for (const [frontendField, value] of Object.entries(updates)) {
      const salesforceField = fieldMapping[frontendField]
      if (salesforceField) {
        try {
          // Test if we can update this single field
          const testUpdate = { Id: trainerId, [salesforceField]: value }
          await conn.sobject('Onboarding_Trainer__c').update(testUpdate)
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
      const result = await conn.sobject('Onboarding_Trainer__c').update(finalUpdateData)
      
      if (result.success) {
        // Fetch the updated record to return current values
        const updatedRecord = await conn.query(`
          SELECT Id, Name, First_Revised_EGLD__c, Onboarding_Trainer_Stage__c, Installation_Date__c,
                 Training_Date__c, Phone_Number__c, Merchant_PIC_Contact_Number__c,
                 CreatedDate, LastModifiedDate
          FROM Onboarding_Trainer__c
          WHERE Id = '${trainerId}'
        `)

        const trainer = updatedRecord.records[0] as any
        const updatedData: any = {
          id: trainer.Id,
          name: trainer.Name,
          firstRevisedEGLD: trainer.First_Revised_EGLD__c,
          onboardingTrainerStage: trainer.Onboarding_Trainer_Stage__c,
          installationDate: trainer.Installation_Date__c,
          trainingDate: trainer.Training_Date__c,
          phoneNumber: trainer.Phone_Number__c,
          merchantPICContactNumber: trainer.Merchant_PIC_Contact_Number__c,
          createdDate: trainer.CreatedDate,
          lastModifiedDate: trainer.LastModifiedDate
        }

        return NextResponse.json({
          success: true,
          message: `Onboarding Trainer updated successfully! ${writableFields.length} field(s) updated.`,
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
    console.error('Salesforce trainer update error:', error)
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}
