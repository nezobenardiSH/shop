import trainersConfig from '../config/trainers.json'
import installersConfig from '../config/installers.json'

/**
 * Get Lark user ID from config files or database
 */
export async function getLarkUserId(email: string): Promise<{ userId: string; openId: string } | null> {
  // Check trainers config
  const trainer = trainersConfig.trainers.find(t => t.email === email) as any
  if (trainer?.larkUserId || trainer?.larkOpenId) {
    return {
      userId: trainer.larkUserId || trainer.larkOpenId || '',
      openId: trainer.larkOpenId || trainer.larkUserId || ''
    }
  }

  // Check default trainer
  if (trainersConfig.defaultTrainer?.email === email) {
    const defaultTrainer = trainersConfig.defaultTrainer as any
    if (defaultTrainer.larkUserId || defaultTrainer.larkOpenId) {
      return {
        userId: defaultTrainer.larkUserId || defaultTrainer.larkOpenId || '',
        openId: defaultTrainer.larkOpenId || defaultTrainer.larkUserId || ''
      }
    }
  }

  // Check installers config
  const installer = installersConfig.internal?.installers?.find((i: any) => i.email === email) as any
  if (installer?.larkUserId || installer?.larkOpenId) {
    return {
      userId: installer.larkUserId || installer.larkOpenId || '',
      openId: installer.larkOpenId || installer.larkUserId || ''
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