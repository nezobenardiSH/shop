import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'
import { validatePIN, validatePINWithUser, generateToken, checkRateLimit, recordLoginAttempt } from '@/lib/auth-utils'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { merchantId, pin } = await request.json()
    
    if (!merchantId || !pin) {
      return NextResponse.json(
        { error: 'Merchant ID and PIN are required' },
        { status: 400 }
      )
    }
    
    // Check rate limiting
    const rateLimit = checkRateLimit(merchantId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: `Too many attempts. Please try again in ${rateLimit.lockoutTime} minutes.`,
          lockout: true 
        },
        { status: 429 }
      )
    }
    
    // Get Salesforce connection
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }
    
    // Query merchant's phone numbers using the Salesforce ID
    // merchantId is now the Salesforce Onboarding_Trainer__c.Id (e.g., a0yBE000002SwCnYAK)
    console.log('🔍 Looking for merchant by Salesforce ID:', merchantId)

    const query = `
      SELECT Id, Name,
             Business_Owner_Contact__r.Phone,
             Business_Owner_Contact__r.Name,
             Merchant_PIC_Contact_Number__c,
             Operation_Manager_Contact__r.Phone,
             Operation_Manager_Contact__r.Name
      FROM Onboarding_Trainer__c
      WHERE Id = '${merchantId}'
      LIMIT 1
    `

    const result = await conn.query(query)
    console.log('📊 Query result - found:', result.totalSize, 'records')

    if (result.totalSize === 0) {
      console.log('❌ Merchant not found in Salesforce')
      recordLoginAttempt(merchantId, false)
      return NextResponse.json(
        {
          error: 'Invalid merchant ID or PIN',
          remainingAttempts: rateLimit.remainingAttempts ? rateLimit.remainingAttempts - 1 : 0
        },
        { status: 401 }
      )
    }

    const trainer = result.records[0] as any
    console.log('✅ Found merchant:', trainer.Name)
    
    // Extract phone numbers with associated contact names
    const phoneData = [
      {
        phone: trainer.Business_Owner_Contact__r?.Phone,
        name: trainer.Business_Owner_Contact__r?.Name
      },
      {
        phone: trainer.Merchant_PIC_Contact_Number__c,
        name: 'Merchant PIC' // This field doesn't have a name, so use a generic label
      },
      {
        phone: trainer.Operation_Manager_Contact__r?.Phone,
        name: trainer.Operation_Manager_Contact__r?.Name
      }
    ].filter(({ phone }) => phone) // Remove entries without phone numbers

    console.log('📞 Phone data found:', phoneData.map(p => ({ phone: p.phone, name: p.name })))

    // Check if we have any phone numbers
    if (phoneData.length === 0) {
      return NextResponse.json(
        { error: 'No phone numbers configured for this merchant. Please contact support.' },
        { status: 400 }
      )
    }

    console.log('🔑 Submitted PIN:', pin)

    // Validate PIN and get the user name
    const validationResult = validatePINWithUser(pin, phoneData)
    console.log('✅ Validation result:', validationResult)
    if (!validationResult.isValid) {
      recordLoginAttempt(merchantId, false)
      const updatedRateLimit = checkRateLimit(merchantId)
      
      return NextResponse.json(
        { 
          error: 'Invalid PIN',
          remainingAttempts: updatedRateLimit.remainingAttempts || 0
        },
        { status: 401 }
      )
    }
    
    // Successful login - clear rate limit
    recordLoginAttempt(merchantId, true)
    
    // Generate JWT token (don't add exp field - jwt.sign handles it)
    const token = generateToken({
      merchantId: merchantId,
      trainerId: trainer.Id,
      trainerName: trainer.Name,
      userName: validationResult.userName,
      pin: pin
    })
    
    console.log('🎫 Generated token for:', {
      merchantId,
      trainerId: trainer.Id,
      trainerName: trainer.Name
    })
    
    // Set httpOnly cookie
    const cookieStore = await cookies()
    
    // First, explicitly delete any existing auth-token to ensure clean state
    cookieStore.delete('auth-token')
    
    // Then set the new token
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/'
    })
    
    return NextResponse.json({
      success: true,
      merchantName: trainer.Name
    })
    
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Authentication failed. Please try again.' },
      { status: 500 }
    )
  }
}