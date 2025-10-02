import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trainerId, trainingDate } = body

    if (!trainerId || !trainingDate) {
      return NextResponse.json(
        { error: 'Missing required fields: trainerId and trainingDate' },
        { status: 400 }
      )
    }

    console.log('📅 Updating training date for trainer:', trainerId)
    console.log('   New date:', trainingDate)

    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { error: 'Salesforce connection failed' },
        { status: 500 }
      )
    }

    // Update the Onboarding_Trainer__c record
    const updateResult = await conn.sobject('Onboarding_Trainer__c').update({
      Id: trainerId,
      Training_Date__c: trainingDate
    })

    console.log('Update result:', updateResult)

    if (updateResult.success) {
      // Fetch the updated record to confirm
      const updatedRecord = await conn.sobject('Onboarding_Trainer__c')
        .select('Id, Name, Training_Date__c')
        .where({ Id: trainerId })
        .execute()

      return NextResponse.json({
        success: true,
        message: 'Training date updated successfully',
        trainerId,
        trainingDate,
        updatedRecord: updatedRecord[0]
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to update training date',
        details: updateResult.errors
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Error updating training date:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update training date',
      details: error.message
    }, { status: 500 })
  }
}