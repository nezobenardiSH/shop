import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const merchantId = searchParams.get('id') || 'a3B2v00000GBVLVEA5'
    
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json({ error: 'No Salesforce connection' }, { status: 500 })
    }
    
    const query = `
      SELECT Id, Name,
             Shipping_Street__c, 
             Shipping_City__c, 
             Shipping_State__c,
             Shipping_Zip_Postal_Code__c, 
             Shipping_Country__c,
             Onboarding_Services_Bought__c,
             Service_Type__c
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `
    
    const result = await conn.query(query)
    
    if (result.totalSize === 0) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 })
    }
    
    const record = result.records[0] as any
    
    return NextResponse.json({
      id: record.Id,
      name: record.Name,
      shipping: {
        street: record.Shipping_Street__c,
        city: record.Shipping_City__c,
        state: record.Shipping_State__c,
        postalCode: record.Shipping_Zip_Postal_Code__c,
        country: record.Shipping_Country__c
      },
      services: {
        onboardingServicesBought: record.Onboarding_Services_Bought__c,
        serviceType: record.Service_Type__c
      },
      computed: {
        merchantAddress: [record.Shipping_State__c, record.Shipping_Country__c].filter(Boolean).join(', '),
        merchantState: record.Shipping_City__c && record.Shipping_State__c 
          ? `${record.Shipping_City__c}, ${record.Shipping_State__c}`
          : record.Shipping_State__c || record.Shipping_City__c || 'No location data'
      }
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}