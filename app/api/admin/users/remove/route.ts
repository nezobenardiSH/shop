import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
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
    
    const { type, email } = await request.json()
    
    if (!type || !email) {
      return NextResponse.json(
        { error: 'Type and email are required' },
        { status: 400 }
      )
    }
    
    if (type === 'trainer') {
      // Remove from trainers.json
      const configPath = path.join(process.cwd(), 'config', 'trainers.json')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configContent)
      
      const originalLength = config.trainers.length
      config.trainers = config.trainers.filter((t: any) => t.email !== email)
      
      if (config.trainers.length === originalLength) {
        return NextResponse.json(
          { error: 'Trainer not found in configuration' },
          { status: 404 }
        )
      }
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))
      
    } else if (type === 'installer') {
      // Remove from installers.json
      const configPath = path.join(process.cwd(), 'config', 'installers.json')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configContent)
      
      let found = false
      for (const location of ['klangValley', 'penang', 'johorBahru']) {
        if (config[location] && config[location].installers) {
          const originalLength = config[location].installers.length
          config[location].installers = config[location].installers.filter((i: any) => i.email !== email)
          if (config[location].installers.length < originalLength) {
            found = true
          }
        }
      }
      
      if (!found) {
        return NextResponse.json(
          { error: 'Installer not found in configuration' },
          { status: 404 }
        )
      }
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    }
    
    // Also revoke authorization from database if exists
    try {
      await prisma.larkAuthToken.delete({
        where: { userEmail: email }
      })
    } catch (error) {
      // Ignore if not found in database
      console.log(`No authorization found for ${email} in database`)
    }
    
    return NextResponse.json({
      success: true,
      message: `User ${email} removed successfully`
    })
    
  } catch (error) {
    console.error('Failed to remove user:', error)
    return NextResponse.json(
      { error: 'Failed to remove user' },
      { status: 500 }
    )
  }
}

