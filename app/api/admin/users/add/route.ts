import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import fs from 'fs/promises'
import path from 'path'

// Helper function to verify admin token
function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get('admin-token')?.value
  
  if (!token) {
    return null
  }
  
  const decoded = verifyToken(token)
  if (!decoded || !decoded.isAdmin) {
    return null
  }
  
  return decoded
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminToken(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { type, email, name, location, languages } = await request.json()
    
    if (!type || !email || !name) {
      return NextResponse.json(
        { error: 'Type, email, and name are required' },
        { status: 400 }
      )
    }
    
    if (type === 'trainer') {
      // Add to trainers.json
      const configPath = path.join(process.cwd(), 'config', 'trainers.json')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configContent)
      
      // Check if trainer already exists
      const exists = config.trainers.some((t: any) => t.email === email)
      if (exists) {
        return NextResponse.json(
          { error: 'Trainer already exists in configuration' },
          { status: 400 }
        )
      }
      
      // Add new trainer
      config.trainers.push({
        name,
        email,
        calendarId: 'primary',
        salesforceId: '',
        languages: languages || ['English'],
        location: location ? [location] : ['Within Klang Valley'],
        larkUserId: '',
        larkOpenId: ''
      })
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))
      
      return NextResponse.json({
        success: true,
        message: `Trainer ${name} added successfully`
      })
      
    } else if (type === 'installer') {
      // Add to installers.json
      const configPath = path.join(process.cwd(), 'config', 'installers.json')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configContent)
      
      // Determine location key
      const locationKey = location === 'Penang' ? 'penang' 
        : location === 'Johor Bahru' ? 'johorBahru' 
        : 'klangValley'
      
      if (!config[locationKey]) {
        return NextResponse.json(
          { error: 'Invalid location' },
          { status: 400 }
        )
      }
      
      // Check if installer already exists
      const exists = config[locationKey].installers.some((i: any) => i.email === email)
      if (exists) {
        return NextResponse.json(
          { error: 'Installer already exists in configuration' },
          { status: 400 }
        )
      }
      
      // Add new installer
      config[locationKey].installers.push({
        name,
        email,
        larkCalendarId: '',
        isActive: true
      })
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))
      
      return NextResponse.json({
        success: true,
        message: `Installer ${name} added successfully`
      })
      
    } else {
      return NextResponse.json(
        { error: 'Invalid user type. Only trainers and installers can be added via config.' },
        { status: 400 }
      )
    }
    
  } catch (error) {
    console.error('Failed to add user:', error)
    return NextResponse.json(
      { error: 'Failed to add user' },
      { status: 500 }
    )
  }
}

