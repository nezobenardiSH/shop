import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { recordId, changes } = await request.json()
    
    console.log('Received Salesforce webhook:', { recordId, changes })
    
    // Find merchant by Salesforce ID
    const merchant = await prisma.merchant.findUnique({
      where: { salesforceId: recordId }
    })
    
    if (!merchant) {
      console.log('Merchant not found for Salesforce ID:', recordId)
      return NextResponse.json({ 
        success: false, 
        message: 'Merchant not found' 
      }, { status: 404 })
    }
    
    // Prepare update data from Salesforce changes
    const updateData: any = {}
    
    if (changes.BillingStreet !== undefined) {
      updateData.address = changes.BillingStreet
    }
    if (changes.Phone !== undefined) {
      updateData.phone = changes.Phone
    }
    if (changes.Onboarding_Stage__c !== undefined) {
      updateData.onboardingStage = changes.Onboarding_Stage__c
    }
    if (changes.Installation_Date__c !== undefined) {
      updateData.installationDate = changes.Installation_Date__c ? 
        new Date(changes.Installation_Date__c) : null
    }
    if (changes.Training_Date__c !== undefined) {
      updateData.trainingDate = changes.Training_Date__c ? 
        new Date(changes.Training_Date__c) : null
    }
    
    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      // Update local database with Salesforce changes
      const updatedMerchant = await prisma.merchant.update({
        where: { id: merchant.id },
        data: updateData
      })
      
      console.log('Updated merchant from Salesforce:', updatedMerchant.id)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Merchant updated successfully',
        updatedFields: Object.keys(updateData)
      })
    } else {
      return NextResponse.json({ 
        success: true, 
        message: 'No changes to process' 
      })
    }
  } catch (error) {
    console.error('Webhook processing failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
