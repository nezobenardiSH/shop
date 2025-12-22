import { prisma } from './prisma'

/**
 * Trainer interface for database-loaded trainers
 */
export interface DatabaseTrainer {
  name: string
  email: string
  languages: string[]
  location: string[]
  calendarId: string | null
  larkUserId: string | null
  isAuthorized: boolean
}

/**
 * Installer interface for database-loaded installers
 */
export interface DatabaseInstaller {
  name: string
  email: string
  larkCalendarId: string
  isActive: boolean
}

/**
 * Load trainers config from database
 * Returns format compatible with existing code that expects trainers.json structure
 */
export async function loadTrainersConfig(): Promise<{
  trainers: Array<{
    name: string
    email: string
    calendarId: string
    languages: string[]
    location: string[]
    larkUserId: string
  }>
  defaultCalendarId: string
  timezone: string
}> {
  const dbTrainers = await prisma.larkAuthToken.findMany({
    where: {
      userType: 'trainer',
      isActive: true
    },
    select: {
      userEmail: true,
      userName: true,
      languages: true,
      location: true,
      calendarId: true,
      larkUserId: true
    }
  })

  return {
    trainers: dbTrainers.map(t => ({
      name: t.userName || t.userEmail.split('@')[0],
      email: t.userEmail,
      calendarId: t.calendarId || 'primary',
      languages: t.languages ? JSON.parse(t.languages) : ['English'],
      location: t.location ? JSON.parse(t.location) : ['Within Klang Valley'],
      larkUserId: t.larkUserId || ''
    })),
    defaultCalendarId: 'primary',
    timezone: 'Asia/Singapore'
  }
}

/**
 * Load installers config from database
 * Returns format compatible with existing code that expects installers.json structure
 */
interface ExternalVendor {
  name: string
  contactPerson: string
  email: string
  phone: string
  isActive: boolean
  notificationMethod: string
  responseTime: string
}

export async function loadInstallersConfig(): Promise<{
  klangValley: { description: string; locationValue: string; scheduling: string; installers: DatabaseInstaller[] }
  penang: { description: string; locationValue: string; scheduling: string; installers: DatabaseInstaller[] }
  johorBahru: { description: string; locationValue: string; scheduling: string; installers: DatabaseInstaller[] }
  external: { description: string; locationValues: string[]; scheduling: string; vendors: ExternalVendor[] }
  settings: {
    defaultTimeSlots: Array<{ start: string; end: string; label: string }>
    workingDays: string[]
    advanceBookingDays: number
    bufferTimeMinutes: number
    timezone: string
  }
}> {
  const dbInstallers = await prisma.larkAuthToken.findMany({
    where: {
      userType: 'installer',
      isActive: true
    },
    select: {
      userEmail: true,
      userName: true,
      location: true,
      calendarId: true,
      isActive: true
    }
  })

  // Initialize result with same structure as installers.json
  const result = {
    klangValley: {
      description: 'Internal StoreHub installers for Klang Valley area',
      locationValue: 'Within Klang Valley',
      scheduling: 'calendar',
      installers: [] as DatabaseInstaller[]
    },
    penang: {
      description: 'Internal StoreHub installers for Penang area',
      locationValue: 'Penang',
      scheduling: 'calendar',
      installers: [] as DatabaseInstaller[]
    },
    johorBahru: {
      description: 'Internal StoreHub installers for Johor Bahru area',
      locationValue: 'Johor Bahru',
      scheduling: 'calendar',
      installers: [] as DatabaseInstaller[]
    },
    external: {
      description: 'External vendor for areas outside Klang Valley, Penang, and JB',
      locationValues: ['Outside of Klang Valley', 'Others'],
      scheduling: 'request',
      vendors: [
        {
          name: 'Surftek',
          contactPerson: 'Surftek Support',
          email: 'support@surftek.com',
          phone: '+60123456789',
          isActive: true,
          notificationMethod: 'email',
          responseTime: '24 hours'
        }
      ]
    },
    settings: {
      defaultTimeSlots: [
        { start: '10:00', end: '11:00', label: '10:00 AM - 11:00 AM' },
        { start: '12:00', end: '13:00', label: '12:00 PM - 1:00 PM' },
        { start: '14:30', end: '15:30', label: '2:30 PM - 3:30 PM' },
        { start: '17:00', end: '18:00', label: '5:00 PM - 6:00 PM' }
      ],
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      advanceBookingDays: 7,
      bufferTimeMinutes: 30,
      timezone: 'Asia/Kuala_Lumpur'
    }
  }

  // Group installers by location
  for (const inst of dbInstallers) {
    const locationArray = inst.location ? JSON.parse(inst.location) : ['Within Klang Valley']
    const location = locationArray[0]

    const installer: DatabaseInstaller = {
      name: inst.userName || inst.userEmail.split('@')[0],
      email: inst.userEmail,
      larkCalendarId: inst.calendarId || '',
      isActive: inst.isActive
    }

    if (location === 'Penang') {
      result.penang.installers.push(installer)
    } else if (location === 'Johor Bahru') {
      result.johorBahru.installers.push(installer)
    } else {
      // Default to Klang Valley
      result.klangValley.installers.push(installer)
    }
  }

  return result
}

/**
 * Load authorized trainers from database
 * Returns only trainers who have completed Lark OAuth authorization
 */
export async function getAuthorizedTrainersFromDB(): Promise<DatabaseTrainer[]> {
  try {
    const dbTrainers = await prisma.larkAuthToken.findMany({
      where: {
        userType: 'trainer',
        isActive: true,
        accessToken: { not: null }
      },
      select: {
        userEmail: true,
        userName: true,
        languages: true,
        location: true,
        calendarId: true,
        larkUserId: true,
        accessToken: true
      }
    })

    return dbTrainers.map(trainer => ({
      name: trainer.userName || trainer.userEmail.split('@')[0],
      email: trainer.userEmail,
      languages: trainer.languages ? JSON.parse(trainer.languages) : ['English'],
      location: trainer.location ? JSON.parse(trainer.location) : ['Within Klang Valley'],
      calendarId: trainer.calendarId,
      larkUserId: trainer.larkUserId,
      isAuthorized: !!trainer.accessToken
    }))
  } catch (error) {
    console.error('Failed to load trainers from database:', error)
    return []
  }
}

/**
 * Load all trainers from database (including unauthorized)
 * Used by admin panel to show all trainers
 */
export async function getAllTrainersFromDB(): Promise<DatabaseTrainer[]> {
  try {
    const dbTrainers = await prisma.larkAuthToken.findMany({
      where: {
        userType: 'trainer',
        isActive: true
      },
      select: {
        userEmail: true,
        userName: true,
        languages: true,
        location: true,
        calendarId: true,
        larkUserId: true,
        accessToken: true
      }
    })

    return dbTrainers.map(trainer => ({
      name: trainer.userName || trainer.userEmail.split('@')[0],
      email: trainer.userEmail,
      languages: trainer.languages ? JSON.parse(trainer.languages) : ['English'],
      location: trainer.location ? JSON.parse(trainer.location) : ['Within Klang Valley'],
      calendarId: trainer.calendarId,
      larkUserId: trainer.larkUserId,
      isAuthorized: !!trainer.accessToken
    }))
  } catch (error) {
    console.error('Failed to load trainers from database:', error)
    return []
  }
}

/**
 * Load all installers from database (including unauthorized)
 * Used by admin panel to show all installers
 */
export async function getAllInstallersFromDB(): Promise<DatabaseInstaller[]> {
  try {
    const dbInstallers = await prisma.larkAuthToken.findMany({
      where: {
        userType: 'installer',
        isActive: true
      },
      select: {
        userEmail: true,
        userName: true,
        calendarId: true,
        isActive: true
      }
    })

    return dbInstallers.map(installer => ({
      name: installer.userName || installer.userEmail.split('@')[0],
      email: installer.userEmail,
      larkCalendarId: installer.calendarId || '',
      isActive: installer.isActive
    }))
  } catch (error) {
    console.error('Failed to load installers from database:', error)
    return []
  }
}
