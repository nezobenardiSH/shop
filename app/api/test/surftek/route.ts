/**
 * Test endpoint for Surftek API integration
 *
 * This endpoint allows testing the Surftek ticket creation flow
 * without going through the full external vendor booking process.
 *
 * Usage:
 * POST /api/test/surftek
 *
 * Optional body parameters:
 * - dryRun: boolean (default: true) - If true, logs but doesn't call Surftek API
 * - merchantName: string - Override merchant name
 * - address: string - Override address
 * - deviceType: 'android' | 'ios' - Override device type detection
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDeviceType, OrderItem, getServiceId } from '@/lib/device-type-detector'
import { geocodeAddress, extractStateName } from '@/lib/geocoding'
import { createTicketForMerchant, mapMerchantToSurftekTicket, MerchantDetails } from '@/lib/surftek-api'

// Only allow in development
const isDev = process.env.NODE_ENV === 'development'

export async function POST(request: NextRequest) {
  if (!isDev) {
    return NextResponse.json(
      { error: 'Test endpoint only available in development' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))

    const {
      dryRun = true,
      merchantName = 'Test Merchant',
      address = '123 Jalan Test, Kuching, Sarawak, 93000, Malaysia',
      contactName = 'Test Contact',
      contactPhone = '0123456789',
      contactEmail = 'test@example.com',
      deviceType: overrideDeviceType,
      hardwareItems = ['Sunmi V2 Pro (Qty: 1)', 'Receipt Printer (Qty: 1)'],
      onboardingSummary = 'Test merchant using Android POS device'
    } = body

    console.log('='.repeat(60))
    console.log('🧪 SURFTEK TEST ENDPOINT')
    console.log('='.repeat(60))
    console.log(`Mode: ${dryRun ? 'DRY RUN (no API call)' : '⚠️ LIVE (will call Surftek API!)'}`)
    console.log('')

    // Step 1: Test device type detection
    console.log('📱 Step 1: Device Type Detection')
    console.log('-'.repeat(40))

    const orderItems: OrderItem[] = hardwareItems.map((item: string) => ({
      productName: item.split(' (Qty:')[0]
    }))

    console.log('Order items:', orderItems.map(i => i.productName))
    console.log('Onboarding summary:', onboardingSummary.substring(0, 100) + '...')

    const detectedDeviceType = await getDeviceType(orderItems, onboardingSummary)
    const finalDeviceType = overrideDeviceType || detectedDeviceType
    const serviceId = getServiceId(finalDeviceType)

    console.log(`Detected device type: ${detectedDeviceType}`)
    console.log(`Final device type: ${finalDeviceType} (override: ${overrideDeviceType || 'none'})`)
    console.log(`Service ID: ${serviceId} (${serviceId === 39 ? 'Android' : 'iOS'} Hardware Installation)`)
    console.log('')

    // Step 2: Test geocoding
    console.log('📍 Step 2: Geocoding')
    console.log('-'.repeat(40))
    console.log(`Address: ${address}`)

    const coordinates = await geocodeAddress(address)
    const stateName = extractStateName(address)

    console.log(`Coordinates: lat=${coordinates.lat}, lng=${coordinates.lng}`)
    console.log(`State: ${stateName}`)
    console.log('')

    // Step 3: Build ticket request
    console.log('📋 Step 3: Build Ticket Request')
    console.log('-'.repeat(40))

    const merchantDetails: MerchantDetails = {
      merchantName,
      merchantId: 'TEST_MERCHANT_ID',
      address,
      contactName,
      contactPhone,
      contactEmail,
      msmName: 'Test MSM',
      hardwareItems,
      onboardingSummary,
      preferredDate: new Date().toISOString().split('T')[0],
      preferredTime: '10:00'
    }

    const ticketRequest = await mapMerchantToSurftekTicket(merchantDetails, finalDeviceType)

    console.log('Ticket Request:')
    console.log(JSON.stringify(ticketRequest, null, 2))
    console.log('')

    // Step 4: Call API (if not dry run)
    let ticketResult = null
    if (!dryRun) {
      console.log('🎫 Step 4: Creating Surftek Ticket (LIVE)')
      console.log('-'.repeat(40))
      console.log('⚠️ WARNING: This will create a real ticket on Surftek!')

      ticketResult = await createTicketForMerchant(merchantDetails, finalDeviceType)

      if (ticketResult) {
        console.log(`✅ Ticket created successfully!`)
        console.log(`   Ticket ID: ${ticketResult.ticketId}`)
        console.log(`   Case Number: ${ticketResult.caseNum}`)
      } else {
        console.log('❌ Ticket creation failed')
      }
    } else {
      console.log('🎫 Step 4: Skipped (dry run mode)')
      console.log('-'.repeat(40))
      console.log('Set dryRun: false in request body to actually call Surftek API')
    }

    console.log('')
    console.log('='.repeat(60))
    console.log('🧪 TEST COMPLETE')
    console.log('='.repeat(60))

    return NextResponse.json({
      success: true,
      dryRun,
      results: {
        deviceType: {
          detected: detectedDeviceType,
          final: finalDeviceType,
          serviceId
        },
        geocoding: {
          address,
          coordinates,
          state: stateName
        },
        ticketRequest,
        ticketResult: dryRun ? 'Skipped (dry run)' : ticketResult
      }
    })
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  if (!isDev) {
    return NextResponse.json(
      { error: 'Test endpoint only available in development' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    endpoint: '/api/test/surftek',
    method: 'POST',
    description: 'Test Surftek API integration without affecting production',
    parameters: {
      dryRun: {
        type: 'boolean',
        default: true,
        description: 'If true, logs request but does not call Surftek API'
      },
      merchantName: {
        type: 'string',
        default: 'Test Merchant',
        description: 'Merchant store name'
      },
      address: {
        type: 'string',
        default: '123 Jalan Test, Kuching, Sarawak, 93000, Malaysia',
        description: 'Full address for geocoding'
      },
      contactName: {
        type: 'string',
        default: 'Test Contact',
        description: 'Contact person name'
      },
      contactPhone: {
        type: 'string',
        default: '0123456789',
        description: 'Contact phone number'
      },
      deviceType: {
        type: 'string',
        enum: ['android', 'ios'],
        description: 'Override detected device type'
      },
      hardwareItems: {
        type: 'array',
        default: ['Sunmi V2 Pro (Qty: 1)', 'Receipt Printer (Qty: 1)'],
        description: 'Hardware items for device type detection'
      },
      onboardingSummary: {
        type: 'string',
        description: 'Onboarding summary text for device type detection'
      }
    },
    examples: {
      dryRunAndroid: {
        method: 'POST',
        body: {
          dryRun: true,
          hardwareItems: ['Sunmi V2 Pro (Qty: 1)']
        }
      },
      dryRunIos: {
        method: 'POST',
        body: {
          dryRun: true,
          hardwareItems: ['Receipt Printer (Qty: 1)', 'Cash Drawer (Qty: 1)'],
          onboardingSummary: 'Merchant has their own iPad'
        }
      },
      liveTest: {
        method: 'POST',
        body: {
          dryRun: false,
          merchantName: 'Real Test Store',
          address: '456 Jalan Real, Kuching, Sarawak, Malaysia',
          contactPhone: '0191234567'
        },
        warning: '⚠️ This will create a real ticket on Surftek!'
      }
    }
  })
}
