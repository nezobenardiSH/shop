import { NextResponse } from 'next/server'
import { testSalesforceConnection } from '@/lib/salesforce'

export async function GET() {
  const result = await testSalesforceConnection()
  
  return NextResponse.json(result, {
    status: result.success ? 200 : 500
  })
}
