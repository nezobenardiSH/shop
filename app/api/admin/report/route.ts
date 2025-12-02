import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/auth-utils'
import { getSalesforceConnection } from '@/lib/salesforce'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const cookieStore = await cookies()
    const adminToken = cookieStore.get('admin-token')?.value

    if (!adminToken) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const decoded = verifyAdminToken(adminToken)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired admin token' },
        { status: 401 }
      )
    }

    // Get Salesforce connection
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { error: 'Failed to connect to Salesforce' },
        { status: 500 }
      )
    }

    // Query Onboarding Portal records to get the list of merchants with access
    const portalQuery = `
      SELECT
        Id,
        Onboarding_Trainer_Record__c,
        Training_Date__c,
        Installation_Date__c
      FROM Onboarding_Portal__c
      WHERE Is_test_account__c = false
        AND Onboarding_Portal_Access__c = true
        AND Onboarding_Trainer_Record__c != null
    `

    const portalResult = await conn.query(portalQuery)

    if (portalResult.records.length === 0) {
      return NextResponse.json({
        success: true,
        merchants: [],
        count: 0
      })
    }

    // Extract merchant IDs and remove duplicates
    const merchantIds: string[] = Array.from(new Set(
      portalResult.records
        .map((record: any) => record.Onboarding_Trainer_Record__c as string)
        .filter((id: string | null | undefined): id is string => id != null)
    ))

    console.log('[Report API] Found merchants:', merchantIds.length)

    // Query Onboarding_Trainer__c records for these merchants
    const trainerQuery = `
      SELECT
        Id,
        Name,
        MSM_Name__r.Name,
        Onboarding_Start_Date__c,
        Planned_Go_Live_Date__c,
        Onboarding_Services_Bought__c,
        First_Call_Timestamp__c
      FROM Onboarding_Trainer__c
      WHERE Id IN ('${merchantIds.join("','")}')
      ORDER BY Name ASC
    `

    const trainerResult = await conn.query(trainerQuery)

    // Create a map of trainer data by ID
    const trainerMap = new Map(
      trainerResult.records.map((record: any) => [record.Id, record])
    )

    // Create a map of portal data by trainer ID
    const portalMap = new Map(
      portalResult.records.map((record: any) => [record.Onboarding_Trainer_Record__c, record])
    )

    // Query analytics database for training and installation scheduling data
    // Need to match both 15-char and 18-char merchant IDs
    const trainingSchedulingData = await prisma.pageView.findMany({
      where: {
        OR: merchantIds.flatMap((id: string) => {
          const baseId = id.substring(0, 15)
          return [
            { merchantId: baseId, action: 'training_scheduled' },
            { merchantId: { startsWith: baseId }, action: 'training_scheduled' }
          ]
        })
      },
      select: {
        merchantId: true,
        timestamp: true,
        isInternalUser: true
      },
      orderBy: { timestamp: 'desc' }
    })

    const installationSchedulingData = await prisma.pageView.findMany({
      where: {
        OR: merchantIds.flatMap((id: string) => {
          const baseId = id.substring(0, 15)
          return [
            { merchantId: baseId, action: 'installation_scheduled' },
            { merchantId: { startsWith: baseId }, action: 'installation_scheduled' }
          ]
        })
      },
      select: {
        merchantId: true,
        timestamp: true,
        isInternalUser: true
      },
      orderBy: { timestamp: 'desc' }
    })

    // Query for product setup (menu submission) scheduling data
    const productSetupSchedulingData = await prisma.pageView.findMany({
      where: {
        OR: merchantIds.flatMap((id: string) => {
          const baseId = id.substring(0, 15)
          return [
            { merchantId: baseId, action: 'menu_submitted' },
            { merchantId: { startsWith: baseId }, action: 'menu_submitted' }
          ]
        })
      },
      select: {
        merchantId: true,
        timestamp: true,
        isInternalUser: true
      },
      orderBy: { timestamp: 'desc' }
    })

    // Calculate analytics metrics per merchant
    const analyticsMap = new Map<string, { uniqueSessions: number, avgPages: number, pageBreakdown: string }>()

    // Query each merchant individually to match the analytics page logic
    for (const merchantId of merchantIds) {
      const baseId = merchantId.substring(0, 15)

      // Query page views for this merchant (matching both 15-char and 18-char IDs)
      // Filter by userType: 'merchant' to exclude internal team
      const merchantViews = await prisma.pageView.findMany({
        where: {
          AND: [
            {
              OR: [
                { merchantId: baseId },
                { merchantId: { startsWith: baseId } }
              ]
            },
            { userType: 'merchant' }
          ]
        },
        select: {
          sessionId: true,
          page: true
        }
      })

      // Get unique sessions using Prisma's distinct (same as analytics page)
      const uniqueSessionsData = await prisma.pageView.findMany({
        where: {
          AND: [
            {
              OR: [
                { merchantId: baseId },
                { merchantId: { startsWith: baseId } }
              ]
            },
            { userType: 'merchant' }
          ]
        },
        select: { sessionId: true },
        distinct: ['sessionId']
      })

      const uniqueSessions = uniqueSessionsData.length
      const totalPageViews = merchantViews.length
      const avgPages = uniqueSessions > 0 ? Math.round((totalPageViews / uniqueSessions) * 10) / 10 : 0

      // Debug logging for the test merchant
      if (merchantId.startsWith('a0yQ900000C0bez')) {
        console.log('[Report API] Merchant a0yQ900000C0bez analytics:', {
          merchantId,
          baseId,
          uniqueSessions,
          totalPageViews,
          avgPages,
          sampleSessionIds: uniqueSessionsData.slice(0, 3).map(s => s.sessionId)
        })
      }

      // Calculate page breakdown
      const pageCounts = merchantViews.reduce((acc, view) => {
        acc[view.page] = (acc[view.page] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const pageBreakdown = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([page, count]) => `${page}:${count}`)
        .join(', ')

      analyticsMap.set(merchantId, {
        uniqueSessions,
        avgPages,
        pageBreakdown
      })
    }

    // Create maps for first scheduling event (oldest) per merchant
    const trainingSchedulingMap = new Map<string, { timestamp: Date, actor: string }>()
    const installationSchedulingMap = new Map<string, { timestamp: Date, actor: string }>()
    const productSetupSchedulingMap = new Map<string, { timestamp: Date, actor: string }>()

    // Group by merchant and get the FIRST (oldest) event
    trainingSchedulingData.reverse().forEach(event => {
      if (!event.merchantId) return
      const baseId = event.merchantId.substring(0, 15)
      // Find the matching full merchant ID from our list
      const fullMerchantId = merchantIds.find(id => id.startsWith(baseId))
      if (fullMerchantId && !trainingSchedulingMap.has(fullMerchantId)) {
        trainingSchedulingMap.set(fullMerchantId, {
          timestamp: event.timestamp,
          actor: event.isInternalUser ? 'Internal Team' : 'Merchant'
        })
      }
    })

    installationSchedulingData.reverse().forEach(event => {
      if (!event.merchantId) return
      const baseId = event.merchantId.substring(0, 15)
      // Find the matching full merchant ID from our list
      const fullMerchantId = merchantIds.find(id => id.startsWith(baseId))
      if (fullMerchantId && !installationSchedulingMap.has(fullMerchantId)) {
        installationSchedulingMap.set(fullMerchantId, {
          timestamp: event.timestamp,
          actor: event.isInternalUser ? 'Internal Team' : 'Merchant'
        })
      }
    })

    productSetupSchedulingData.reverse().forEach(event => {
      if (!event.merchantId) return
      const baseId = event.merchantId.substring(0, 15)
      // Find the matching full merchant ID from our list
      const fullMerchantId = merchantIds.find(id => id.startsWith(baseId))
      if (fullMerchantId && !productSetupSchedulingMap.has(fullMerchantId)) {
        productSetupSchedulingMap.set(fullMerchantId, {
          timestamp: event.timestamp,
          actor: event.isInternalUser ? 'Internal Team' : 'Merchant'
        })
      }
    })

    // Merge the data
    const merchants = merchantIds.map((trainerId: string) => {
      const trainer: any = trainerMap.get(trainerId)
      const portal: any = portalMap.get(trainerId)
      const trainingScheduling = trainingSchedulingMap.get(trainerId)
      const installationScheduling = installationSchedulingMap.get(trainerId)
      const productSetupScheduling = productSetupSchedulingMap.get(trainerId)
      const analytics = analyticsMap.get(trainerId)

      if (!trainer) return null

      return {
        id: trainer.Id,
        name: trainer.Name || 'Unknown',
        analyticsLink: `/admin/analytics/${trainer.Id}`,
        salesforceLink: `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/${trainer.Id}/view`,
        onboardingManagers: trainer.MSM_Name__r?.Name || '',
        onboardingStartDate: trainer.Onboarding_Start_Date__c,
        expectedGoLiveDate: trainer.Planned_Go_Live_Date__c,
        trainingCompletedTimestamp: portal?.Training_Date__c,
        onboardingServiceBought: trainer.Onboarding_Services_Bought__c,
        firstCallTimestamp: trainer.First_Call_Timestamp__c,
        trainingScheduledTimestamp: trainingScheduling?.timestamp || null,
        trainingScheduledActor: trainingScheduling?.actor || '',
        installationScheduledTimestamp: installationScheduling?.timestamp || null,
        installationScheduledActor: installationScheduling?.actor || '',
        productSetupTimestamp: productSetupScheduling?.timestamp || null,
        productSetupActor: productSetupScheduling?.actor || '',
        uniqueSessions: analytics?.uniqueSessions || 0,
        avgPagesPerSession: analytics?.avgPages || 0,
        pageBreakdown: analytics?.pageBreakdown || ''
      }
    }).filter((merchant: any) => merchant !== null)

    return NextResponse.json({
      success: true,
      merchants,
      count: merchants.length
    })

  } catch (error) {
    console.error('[Report API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch report data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
