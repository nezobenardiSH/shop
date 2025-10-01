import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function GET(request: NextRequest) {
  try {
    // Get Salesforce connection
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Salesforce' },
        { status: 500 }
      )
    }

    // Get picklist values for Onboarding_Trainer_Stage__c field
    try {
      const describe = await conn.sobject('Onboarding_Trainer__c').describe()
      
      // Find the Onboarding_Trainer_Stage__c field
      const stageField = describe.fields.find((field: any) => 
        field.name === 'Onboarding_Trainer_Stage__c'
      )
      
      if (!stageField) {
        return NextResponse.json({
          success: false,
          error: 'Onboarding_Trainer_Stage__c field not found',
          availableFields: describe.fields.map((f: any) => f.name)
        }, { status: 404 })
      }

      // Extract picklist values
      const picklistValues = stageField.picklistValues || []
      const stages = picklistValues.map((value: any) => ({
        label: value.label,
        value: value.value,
        active: value.active,
        defaultValue: value.defaultValue
      }))

      return NextResponse.json({
        success: true,
        message: 'Successfully retrieved trainer stages',
        stages: stages,
        totalStages: stages.length,
        fieldInfo: {
          name: stageField.name,
          label: stageField.label,
          type: stageField.type,
          required: !stageField.nillable
        }
      })

    } catch (error: any) {
      console.error('Failed to describe Onboarding_Trainer__c:', error)
      
      // Fallback: try to get unique values from existing records
      try {
        const stageQuery = `
          SELECT Onboarding_Trainer_Stage__c 
          FROM Onboarding_Trainer__c 
          WHERE Onboarding_Trainer_Stage__c != null 
          GROUP BY Onboarding_Trainer_Stage__c 
          ORDER BY Onboarding_Trainer_Stage__c
        `
        
        const stageResult = await conn.query(stageQuery)
        const uniqueStages = stageResult.records.map((record: any) => ({
          label: record.Onboarding_Trainer_Stage__c,
          value: record.Onboarding_Trainer_Stage__c,
          active: true,
          defaultValue: false
        }))

        return NextResponse.json({
          success: true,
          message: 'Retrieved stages from existing data (fallback method)',
          stages: uniqueStages,
          totalStages: uniqueStages.length,
          note: 'These are stages found in existing records, not complete picklist values'
        })

      } catch (fallbackError) {
        return NextResponse.json({
          success: false,
          error: `Failed to get stage values: ${error.message}`,
          fallbackError: `Fallback also failed: ${fallbackError}`
        }, { status: 500 })
      }
    }

  } catch (error: any) {
    console.error('Trainer stages API error:', error)
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}
