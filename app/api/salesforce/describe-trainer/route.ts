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

    // Describe the Onboarding_Trainer__c object to see all available fields
    try {
      const describe = await conn.sobject('Onboarding_Trainer__c').describe()
      
      // Extract field information
      const fields = describe.fields.map((field: any) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        referenceTo: field.referenceTo,
        relationshipName: field.relationshipName,
        required: !field.nillable,
        updateable: field.updateable,
        createable: field.createable
      }))

      // Look for Contact-related fields
      const contactFields = fields.filter((field: any) => 
        field.referenceTo?.includes('Contact') || 
        field.name.toLowerCase().includes('contact') ||
        field.relationshipName?.toLowerCase().includes('contact')
      )

      return NextResponse.json({
        success: true,
        message: 'Successfully described Onboarding_Trainer__c object',
        totalFields: fields.length,
        fields: fields,
        contactRelatedFields: contactFields,
        objectInfo: {
          name: describe.name,
          label: describe.label,
          labelPlural: describe.labelPlural,
          keyPrefix: describe.keyPrefix,
          createable: describe.createable,
          updateable: describe.updateable,
          deletable: describe.deletable
        }
      })

    } catch (error: any) {
      console.error('Failed to describe Onboarding_Trainer__c:', error)
      return NextResponse.json({
        success: false,
        error: `Failed to describe object: ${error.message}`
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Describe trainer API error:', error)
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}
