import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const merchantId = searchParams.get('merchantId')

    if (!merchantId) {
      return NextResponse.json(
        { error: 'Missing merchantId parameter' },
        { status: 400 }
      )
    }

    console.log('🔗 Testing Salesforce connection...')
    const conn = await getSalesforceConnection()

    if (!conn) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get Salesforce connection',
        connection: null
      })
    }

    console.log('✅ Salesforce connection established')

    // Test query for Onboarding_Trainer__c
    console.log(`🔍 Querying Onboarding_Trainer__c for ID: ${merchantId}`)

    const trainerQuery = `
      SELECT Id, Name, Account_Name__c,
             Shipping_Street__c, Shipping_City__c, Shipping_State__c, Shipping_Zip_Postal_Code__c, Shipping_Country__c,
             Operation_Manager_Contact__r.Name, Operation_Manager_Contact__r.Phone, Operation_Manager_Contact__r.Email,
             Business_Owner_Contact__r.Name, Business_Owner_Contact__r.Phone, Business_Owner_Contact__r.Email,
             Merchant_PIC_Name__c, Merchant_PIC_Contact_Number__c, Merchant_PIC_Role__c,
             Email__c,
             MSM_Name__r.Name, MSM_Name__r.Email, MSM_Name__r.Phone,
             Onboarding_Summary__c, Pilot_Test__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `

    console.log('📝 Query:', trainerQuery)

    const trainerResult = await conn.query(trainerQuery)

    console.log('📊 Query result:')
    console.log('   totalSize:', trainerResult.totalSize)
    console.log('   records count:', trainerResult.records?.length || 0)

    if (trainerResult.totalSize > 0) {
      const trainer = trainerResult.records[0]
      console.log('✅ Record found!')
      console.log('   Full record:', JSON.stringify(trainer, null, 2))

      return NextResponse.json({
        success: true,
        connection: 'Connected',
        query: 'Onboarding_Trainer__c',
        totalSize: trainerResult.totalSize,
        record: {
          id: trainer.Id,
          name: trainer.Name,
          accountId: trainer.Account_Name__c,
          shippingStreet: trainer.Shipping_Street__c,
          shippingCity: trainer.Shipping_City__c,
          shippingState: trainer.Shipping_State__c,
          shippingZip: trainer.Shipping_Zip_Postal_Code__c,
          shippingCountry: trainer.Shipping_Country__c,
          merchantPicName: trainer.Merchant_PIC_Name__c,
          merchantPicPhone: trainer.Merchant_PIC_Contact_Number__c,
          merchantPicRole: trainer.Merchant_PIC_Role__c,
          email: trainer.Email__c,
          operationManager: trainer.Operation_Manager_Contact__r,
          businessOwner: trainer.Business_Owner_Contact__r,
          msm: trainer.MSM_Name__r,
          onboardingSummary: trainer.Onboarding_Summary__c,
          pilotTest: trainer.Pilot_Test__c
        },
        fullRecord: trainer
      })
    } else {
      console.log('❌ No record found for ID:', merchantId)
      return NextResponse.json({
        success: false,
        connection: 'Connected',
        query: 'Onboarding_Trainer__c',
        totalSize: 0,
        error: `No Onboarding_Trainer__c record found with ID: ${merchantId}`,
        record: null
      })
    }
  } catch (error: any) {
    console.error('❌ Error testing Salesforce connection:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.toString()
    }, { status: 500 })
  }
}

