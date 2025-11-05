import { NextRequest, NextResponse } from 'next/server'
import { larkOAuthService } from '@/lib/lark-oauth-service'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { email, userType } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Delete from database
    await prisma.larkAuthToken.deleteMany({
      where: { userEmail: email }
    })

    // Clear from config files
    if (userType === 'trainer') {
      const configPath = path.join(process.cwd(), 'config', 'trainers.json')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const trainersConfig = JSON.parse(configContent)

      const trainer = trainersConfig.trainers.find((t: any) => t.email === email)
      if (trainer) {
        delete trainer.larkUserId
        delete trainer.larkOpenId

        await fs.writeFile(configPath, JSON.stringify(trainersConfig, null, 2))
      }
    } else if (userType === 'installer') {
      const configPath = path.join(process.cwd(), 'config', 'installers.json')
      const configContent = await fs.readFile(configPath, 'utf-8')
      const installersConfig = JSON.parse(configContent)

      const installer = installersConfig.internal.installers.find((i: any) => i.email === email)
      if (installer) {
        delete installer.larkUserId
        delete installer.larkOpenId

        await fs.writeFile(configPath, JSON.stringify(installersConfig, null, 2))
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Authorization revoked for ${email}. Please re-authorize to grant calendar permissions.` 
    })
  } catch (error: any) {
    console.error('Revoke error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke authorization', details: error.message },
      { status: 500 }
    )
  }
}