/**
 * Script to debug all calendars and their permissions
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugCalendars() {
  try {
    const tokens = await prisma.larkAuthToken.findMany()
    
    for (const token of tokens) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`User: ${token.userName || token.userEmail}`)
      console.log(`Email: ${token.userEmail}`)
      
      const response = await fetch('https://open.larksuite.com/open-apis/calendar/v4/calendars', {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`
        }
      })

      const data = await response.json()
      
      if (data.code === 0 && data.data?.calendar_list) {
        const calendars = data.data.calendar_list
        
        console.log(`\nTotal calendars: ${calendars.length}\n`)
        
        calendars.forEach((cal: any, idx: number) => {
          console.log(`${idx + 1}. ${cal.summary || 'No title'}`)
          console.log(`   ID: ${cal.calendar_id}`)
          console.log(`   Role: ${cal.role}`)
          console.log(`   Type: ${cal.type || 'unknown'}`)
          console.log(`   Permissions: ${cal.permissions || 'none'}`)
          console.log(`   Color: ${cal.color || 'none'}`)
          console.log(`   Summary Type: ${cal.summary_alias || 'none'}`)
          console.log('')
        })
      } else {
        console.log(`\n❌ Failed to get calendars: ${data.msg}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugCalendars()

