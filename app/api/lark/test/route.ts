import { NextRequest, NextResponse } from 'next/server'
import { larkService } from '@/lib/lark'

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  }

  // Test 1: Check environment variables
  results.tests.push({
    name: 'Environment Variables',
    status: 'checking',
    appId: process.env.LARK_APP_ID ? 'Configured' : 'Missing',
    appSecret: process.env.LARK_APP_SECRET ? 'Configured' : 'Missing',
    domain: process.env.LARK_DOMAIN || 'https://open.larksuite.com'
  })

  // Test 2: Get access token
  try {
    const token = await larkService.getAccessToken()
    results.tests.push({
      name: 'Authentication',
      status: 'success',
      message: 'Successfully obtained access token',
      tokenLength: token.length
    })
  } catch (error: any) {
    results.tests.push({
      name: 'Authentication',
      status: 'failed',
      error: error.message
    })
    return NextResponse.json(results, { status: 500 })
  }

  // Test 3: Try to get raw busy times
  try {
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 7) // Just test 1 week

    const busyTimes = await larkService.getRawBusyTimes(
      'nezo.benardi@storehub.com',
      startDate,
      endDate
    )

    results.tests.push({
      name: 'Calendar Busy Times',
      status: 'success',
      message: 'Successfully fetched busy times (FreeBusy + Calendar Events + Recurring)',
      busyPeriodsFound: busyTimes.length,
      firstBusyPeriod: busyTimes[0]
    })
  } catch (error: any) {
    results.tests.push({
      name: 'Calendar Busy Times',
      status: 'failed',
      error: error.message,
      stack: error.stack
    })
  }

  // Test 4: Check trainer config
  try {
    const fs = require('fs').promises
    const path = require('path')
    const configPath = path.join(process.cwd(), 'config', 'trainers.json')
    const configContent = await fs.readFile(configPath, 'utf-8')
    const trainersConfig = JSON.parse(configContent)

    results.tests.push({
      name: 'Trainer Configuration',
      status: 'success',
      trainersCount: trainersConfig.trainers.length,
      trainers: trainersConfig.trainers.map((t: any) => ({
        name: t.name,
        email: t.email
      }))
    })
  } catch (error: any) {
    results.tests.push({
      name: 'Trainer Configuration',
      status: 'failed',
      error: error.message
    })
  }

  const allPassed = results.tests.every((t: any) => t.status === 'success')
  
  return NextResponse.json(results, { 
    status: allPassed ? 200 : 500 
  })
}