import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function GET(request: NextRequest) {
  try {
    console.log('🔗 Testing Salesforce connection...')
    const conn = await getSalesforceConnection()

    if (!conn) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get Salesforce connection'
      })
    }

    console.log('✅ Salesforce connection established')

    // Describe the Onboarding_Trainer__c object to see all available fields
    console.log('🔍 Describing Onboarding_Trainer__c object...')

    const describe = await conn.describe('Onboarding_Trainer__c')

    console.log('✅ Object described')
    console.log('   Total fields:', describe.fields.length)

    // Filter for fields that might contain contact, email, phone, or merchant info
    const relevantFields = describe.fields.filter((field: any) => {
      const name = field.name.toLowerCase()
      return name.includes('contact') || 
             name.includes('email') || 
             name.includes('phone') || 
             name.includes('merchant') ||
             name.includes('pic') ||
             name.includes('manager') ||
             name.includes('msm') ||
             name.includes('shipping') ||
             name.includes('address') ||
             name.includes('summary') ||
             name.includes('pilot')
    })

    console.log('📋 Relevant fields found:', relevantFields.length)
    relevantFields.forEach((field: any) => {
      console.log(`   - ${field.name} (${field.type})`)
    })

    return NextResponse.json({
      success: true,
      connection: 'Connected',
      objectName: 'Onboarding_Trainer__c',
      totalFields: describe.fields.length,
      relevantFields: relevantFields.map((field: any) => ({
        name: field.name,
        type: field.type,
        label: field.label,
        length: field.length,
        updateable: field.updateable,
        createable: field.createable
      })),
      allFields: describe.fields.map((field: any) => ({
        name: field.name,
        type: field.type,
        label: field.label
      }))
    })
  } catch (error: any) {
    console.error('❌ Error describing Salesforce object:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.toString()
    }, { status: 500 })
  }
}

