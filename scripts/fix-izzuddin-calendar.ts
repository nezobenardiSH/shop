import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixIzzuddinCalendar() {
  try {
    console.log('🔧 Fixing Izzuddin\'s calendar ID...\n')
    
    // Izzuddin's correct primary calendar ID (from the test results)
    const correctCalendarId = 'feishu.cn_dj9XXgb6OvMi0GBiUNMG3g@group.calendar.feishu.cn'
    const email = 'izzuddin.azizol@storehub.com'
    
    // Update the database
    const result = await prisma.larkAuthToken.update({
      where: { userEmail: email },
      data: { calendarId: correctCalendarId }
    })
    
    console.log('✅ Successfully updated Izzuddin\'s calendar ID!')
    console.log(`   Email: ${result.userEmail}`)
    console.log(`   Old Calendar ID: feishu.cn_QcObuBtabfINnqeAEd8lqg@group.calendar.feishu.cn (Amira's calendar - READ ONLY)`)
    console.log(`   New Calendar ID: ${result.calendarId} (Izzuddin's calendar - OWNER)`)
    console.log('\n🎉 Izzuddin can now create calendar events!')
    
  } catch (error) {
    console.error('❌ Error fixing calendar ID:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixIzzuddinCalendar()

