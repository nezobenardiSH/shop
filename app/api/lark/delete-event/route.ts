import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function POST(request: NextRequest) {
  try {
    const { eventId, trainerEmail, merchantName } = await request.json()
    
    if (!eventId || !trainerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, trainerEmail' },
        { status: 400 }
      )
    }
    
    console.log('🗑️  Delete event request received:')
    console.log(`   Event ID: ${eventId}`)
    console.log(`   Trainer: ${trainerEmail}`)
    console.log(`   Merchant: ${merchantName || 'N/A'}`)
    
    const calendarId = 'feishu.cn_zLXUWDRprW4Ozy6kXXCIua@group.calendar.feishu.cn'
    
    await larkService.cancelTraining(
      trainerEmail,
      calendarId,
      eventId,
      merchantName || 'Manual deletion'
    )
    
    console.log('✅ Event deleted successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully'
    })
    
  } catch (error: any) {
    console.error('❌ Failed to delete event:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete event' },
      { status: 500 }
    )
  }
}

