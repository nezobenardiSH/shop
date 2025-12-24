/**
 * Script to check availability for a specific user
 * Usage: npx tsx scripts/check-availability.ts
 */

import { larkService } from '../lib/lark'
import { larkOAuthService } from '../lib/lark-oauth-service'
import { loadInstallersConfig } from '../lib/config-loader'

const EMAIL = 'fattah.osman@storehub.com'
const START_DATE = '2025-12-26'
const END_DATE = '2026-01-15'

// Time slots from installer config
const TIME_SLOTS = [
  { start: '10:00', end: '11:00', label: '10:00 AM - 11:00 AM' },
  { start: '12:00', end: '13:00', label: '12:00 PM - 1:00 PM' },
  { start: '14:30', end: '15:30', label: '2:30 PM - 3:30 PM' },
  { start: '17:00', end: '18:00', label: '5:00 PM - 6:00 PM' },
]

async function checkAvailability() {
  console.log(`\n📅 Checking availability for: ${EMAIL}`)
  console.log(`📆 Date range: ${START_DATE} to ${END_DATE}\n`)

  // Check if user has OAuth token
  const hasToken = await larkOAuthService.isUserAuthorized(EMAIL)
  if (!hasToken) {
    console.log('❌ User has NOT authorized their Lark calendar (no OAuth token)')
    console.log('   They need to complete the OAuth flow first.')
    return
  }
  console.log('✅ User has OAuth authorization\n')

  // Fetch busy times from Lark calendar
  const startDateTime = new Date(`${START_DATE}T00:00:00+08:00`)
  const endDateTime = new Date(`${END_DATE}T23:59:59+08:00`)

  console.log('🔍 Fetching calendar busy times...\n')

  const busySlots = await larkService.getRawBusyTimes(
    EMAIL,
    startDateTime,
    endDateTime
  )

  console.log(`Found ${busySlots.length} busy periods:\n`)

  // Group busy times by date for display
  const busyByDate: Record<string, Array<{ start: string; end: string }>> = {}

  for (const busy of busySlots) {
    const startDate = new Date(busy.start_time).toLocaleDateString('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    })

    const startTime = new Date(busy.start_time).toLocaleTimeString('en-SG', {
      timeZone: 'Asia/Singapore',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    const endTime = new Date(busy.end_time).toLocaleTimeString('en-SG', {
      timeZone: 'Asia/Singapore',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    if (!busyByDate[startDate]) {
      busyByDate[startDate] = []
    }
    busyByDate[startDate].push({
      start: startTime,
      end: endTime
    })
  }

  // Display busy times by date
  console.log('═'.repeat(60))
  console.log('BUSY PERIODS (Calendar Events)')
  console.log('═'.repeat(60))

  const sortedDates = Object.keys(busyByDate).sort()
  for (const date of sortedDates) {
    console.log(`\n📅 ${date}:`)
    for (const slot of busyByDate[date]) {
      console.log(`   ⏰ ${slot.start} - ${slot.end}`)
    }
  }

  // Now calculate available slots for each day
  console.log('\n')
  console.log('═'.repeat(60))
  console.log('AVAILABILITY BY DATE (Singapore Time)')
  console.log('═'.repeat(60))

  const current = new Date(startDateTime)
  const end = new Date(endDateTime)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    const dayOfWeek = current.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    const dateDisplay = current.toLocaleDateString('en-SG', {
      timeZone: 'Asia/Singapore',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })

    console.log(`\n📅 ${dateDisplay}${isWeekend ? ' (Weekend)' : ''}:`)

    for (const timeSlot of TIME_SLOTS) {
      const slotStart = new Date(`${dateStr}T${timeSlot.start}:00+08:00`)
      const slotEnd = new Date(`${dateStr}T${timeSlot.end}:00+08:00`)

      // Check if any busy period overlaps with this slot
      const isBlocked = busySlots.some((busy: any) => {
        const busyStart = new Date(busy.start_time)
        const busyEnd = new Date(busy.end_time)
        return busyStart < slotEnd && busyEnd > slotStart
      })

      if (isBlocked) {
        console.log(`   ❌ ${timeSlot.label} - BUSY`)
      } else {
        console.log(`   ✅ ${timeSlot.label} - Available`)
      }
    }

    current.setDate(current.getDate() + 1)
  }

  console.log('\n')
  console.log('═'.repeat(60))
  console.log('SUMMARY')
  console.log('═'.repeat(60))

  // Count available slots
  let totalSlots = 0
  let availableSlots = 0

  const summaryByDate: Record<string, { available: number; total: number }> = {}

  const current2 = new Date(startDateTime)
  while (current2 <= end) {
    const dateStr = current2.toISOString().split('T')[0]
    const dayOfWeek = current2.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    if (!isWeekend) {
      let dateAvailable = 0

      for (const timeSlot of TIME_SLOTS) {
        const slotStart = new Date(`${dateStr}T${timeSlot.start}:00+08:00`)
        const slotEnd = new Date(`${dateStr}T${timeSlot.end}:00+08:00`)

        const isBlocked = busySlots.some((busy: any) => {
          const busyStart = new Date(busy.start_time)
          const busyEnd = new Date(busy.end_time)
          return busyStart < slotEnd && busyEnd > slotStart
        })

        totalSlots++
        if (!isBlocked) {
          availableSlots++
          dateAvailable++
        }
      }

      summaryByDate[dateStr] = { available: dateAvailable, total: TIME_SLOTS.length }
    }

    current2.setDate(current2.getDate() + 1)
  }

  console.log(`\n📊 Total weekday slots: ${totalSlots}`)
  console.log(`✅ Available slots: ${availableSlots}`)
  console.log(`❌ Busy slots: ${totalSlots - availableSlots}`)
  console.log(`📈 Availability rate: ${((availableSlots / totalSlots) * 100).toFixed(1)}%`)

  // Days with no availability
  const fullyBookedDates = Object.entries(summaryByDate)
    .filter(([_, stats]) => stats.available === 0)
    .map(([date, _]) => date)

  if (fullyBookedDates.length > 0) {
    console.log(`\n⚠️  Fully booked days: ${fullyBookedDates.join(', ')}`)
  }

  // Days with full availability
  const fullyAvailableDates = Object.entries(summaryByDate)
    .filter(([_, stats]) => stats.available === stats.total)
    .map(([date, _]) => date)

  if (fullyAvailableDates.length > 0) {
    console.log(`\n🌟 Fully available days: ${fullyAvailableDates.join(', ')}`)
  }
}

checkAvailability()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  })
