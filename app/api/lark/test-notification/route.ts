import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'
import { sendBookingNotification, sendCancellationNotification } from '@/lib/lark-notifications'

export async function POST(request: NextRequest) {
  try {
    const { email, message, type = 'simple' } = await request.json()
    
    if (!email) {
      return NextResponse.json({ 
        error: 'Email is required' 
      }, { status: 400 })
    }
    
    console.log('🧪 Testing notification for:', email)
    console.log('   Type:', type)
    
    let result = {}
    
    if (type === 'simple') {
      // Test simple message
      const user = await larkService.getUserByEmail(email)
      console.log('User found:', user)
      result = { user }
      
      await larkService.sendAppMessage(
        email, 
        message || 'Test notification from Onboarding Portal', 
        'text'
      )
      console.log('✅ Simple notification sent')
      
    } else if (type === 'booking') {
      // Test booking notification
      await sendBookingNotification({
        merchantName: 'Test Merchant ABC',
        merchantId: 'TEST001',
        date: '2024-03-20',
        startTime: '10:00',
        endTime: '12:00',
        bookingType: 'training',
        isRescheduling: false,
        assignedPersonName: 'Test Trainer',
        assignedPersonEmail: email,
        location: 'Klang Valley, Malaysia',
        contactPerson: 'John Doe',
        contactPhone: '+60123456789'
      })
      console.log('✅ Booking notification sent')
      
    } else if (type === 'reschedule') {
      // Test rescheduling notification
      await sendBookingNotification({
        merchantName: 'Rescheduled Merchant XYZ',
        merchantId: 'TEST002',
        date: '2024-03-25',
        startTime: '14:00',
        endTime: '16:00',
        bookingType: 'pos-training',
        isRescheduling: true,
        assignedPersonName: 'Test Trainer',
        assignedPersonEmail: email,
        location: 'Penang, Malaysia'
      })
      console.log('✅ Rescheduling notification sent')
      
    } else if (type === 'cancellation') {
      // Test cancellation notification
      await sendCancellationNotification(
        email,
        'Cancelled Merchant DEF',
        '2024-03-22',
        'training'
      )
      console.log('✅ Cancellation notification sent')
      
    } else if (type === 'installation') {
      // Test installation notification
      await sendBookingNotification({
        merchantName: 'Installation Test Merchant',
        merchantId: 'TEST003',
        date: '2024-03-21',
        startTime: '09:00',
        endTime: '11:00',
        bookingType: 'installation',
        isRescheduling: false,
        assignedPersonName: 'Test Installer',
        assignedPersonEmail: email
      })
      console.log('✅ Installation notification sent')
    }
    
    return NextResponse.json({ 
      success: true,
      type,
      recipient: email,
      ...result
    })
    
  } catch (error) {
    console.error('❌ Test notification failed:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to send notification',
      details: error 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Return test instructions
  return NextResponse.json({
    message: 'Lark Notification Test Endpoint',
    usage: 'POST to this endpoint with JSON body',
    parameters: {
      email: 'Required - Email address of the recipient',
      message: 'Optional - Custom message for simple type',
      type: 'Optional - Type of test notification'
    },
    types: [
      'simple - Send a simple text message',
      'booking - Send a new booking notification',
      'reschedule - Send a rescheduling notification',
      'cancellation - Send a cancellation notification',
      'installation - Send an installation booking notification'
    ],
    example: {
      email: 'trainer@company.com',
      type: 'booking'
    }
  })
}