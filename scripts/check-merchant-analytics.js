const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkMerchantAnalytics() {
  const merchantId = 'a0yQ900000C5Lxl'
  const baseId = merchantId.substring(0, 15)

  console.log(`Checking analytics for merchant: ${merchantId}`)
  console.log(`Base ID: ${baseId}`)

  const activities = await prisma.pageView.findMany({
    where: {
      OR: [
        { merchantId: baseId },
        { merchantId: { startsWith: baseId } }
      ]
    },
    orderBy: { timestamp: 'desc' },
    take: 50
  })

  console.log(`\nFound ${activities.length} total activities`)

  const installationEvents = activities.filter(a => a.action === 'installation_scheduled')
  console.log(`\nInstallation events: ${installationEvents.length}`)
  installationEvents.forEach(e => {
    console.log({
      timestamp: e.timestamp,
      action: e.action,
      isInternalUser: e.isInternalUser,
      userType: e.userType,
      page: e.page,
      metadata: e.metadata
    })
  })

  const trainingEvents = activities.filter(a => a.action === 'training_scheduled')
  console.log(`\nTraining events: ${trainingEvents.length}`)
  trainingEvents.forEach(e => {
    console.log({
      timestamp: e.timestamp,
      action: e.action,
      isInternalUser: e.isInternalUser,
      userType: e.userType,
      page: e.page
    })
  })

  await prisma.$disconnect()
}

checkMerchantAnalytics().catch(console.error)
