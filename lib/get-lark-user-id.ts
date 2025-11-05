import fs from 'fs/promises'
import path from 'path'

/**
 * Get Lark user ID from config files or database
 */
export async function getLarkUserId(email: string): Promise<{ userId: string; openId: string } | null> {
  // Read configs dynamically to pick up changes without restart
  const trainersConfigPath = path.join(process.cwd(), 'config', 'trainers.json')
  const trainersConfigContent = await fs.readFile(trainersConfigPath, 'utf-8')
  const trainersConfig = JSON.parse(trainersConfigContent)

  const installersConfigPath = path.join(process.cwd(), 'config', 'installers.json')
  const installersConfigContent = await fs.readFile(installersConfigPath, 'utf-8')
  const installersConfig = JSON.parse(installersConfigContent)

  // Check trainers config
  const trainer = trainersConfig.trainers.find((t: any) => t.email === email) as any
  if (trainer?.larkUserId || trainer?.larkOpenId) {
    return {
      userId: trainer.larkUserId || trainer.larkOpenId || '',
      openId: trainer.larkOpenId || trainer.larkUserId || ''
    }
  }


  // Check installers config across all locations
  for (const location of ['klangValley', 'penang', 'johorBahru']) {
    const locationConfig = (installersConfig as any)[location]
    if (locationConfig?.installers) {
      const installer = locationConfig.installers.find((i: any) => i.email === email) as any
      if (installer?.larkUserId || installer?.larkOpenId) {
        return {
          userId: installer.larkUserId || installer.larkOpenId || '',
          openId: installer.larkOpenId || installer.larkUserId || ''
        }
      }
    }
  }
  
  // If not found in config, check database
  try {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
    const authToken = await prisma.larkAuthToken.findUnique({
      where: { userEmail: email }
    })
    
    await prisma.$disconnect()
    
    if (authToken?.larkUserId) {
      return {
        userId: authToken.larkUserId,
        openId: authToken.larkUserId // Use same ID
      }
    }
  } catch (error) {
    console.error('Failed to check database for Lark ID:', error)
  }
  
  return null
}