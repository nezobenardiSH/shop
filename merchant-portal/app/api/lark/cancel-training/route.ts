import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import trainersConfig from '@/config/trainers.json'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      merchantId,
      merchantName,
      trainerName,
      eventId
    } = body

    if (!merchantId || !merchantName || !trainerName || !eventId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let trainer = trainersConfig.trainers.find(
      t => t.name.toLowerCase().trim() === trainerName.toLowerCase().trim()
    )
    
    // If trainer not found by name, use default trainer config
    if (!trainer && trainersConfig.defaultTrainer) {
      console.log('Trainer not found, using default trainer configuration')
      trainer = {
        name: trainerName,
        ...trainersConfig.defaultTrainer
      }
    }
    
    if (!trainer) {
      return NextResponse.json(
        { error: `Trainer "${trainerName}" not found in configuration` },
        { status: 404 }
      )
    }

    const calendarId = trainer.calendarId || trainersConfig.defaultCalendarId

    await larkService.cancelTraining(
      trainer.email,
      calendarId,
      eventId,
      merchantName
    )

    try {
      const conn = await getSalesforceConnection()
      
      await conn.sobject('Onboarding_Trainer__c').update({
        Id: merchantId,
        Training_Date__c: null,
        Lark_Event_Id__c: null,
        Training_Status__c: 'Not Scheduled'
      })
    } catch (sfError) {
      console.error('Failed to update Salesforce:', sfError)
    }

    return NextResponse.json({
      success: true,
      message: 'Training session cancelled successfully'
    })
  } catch (error) {
    console.error('Error cancelling training:', error)
    return NextResponse.json(
      { error: 'Failed to cancel training session' },
      { status: 500 }
    )
  }
}