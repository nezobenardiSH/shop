import fs from 'fs'
import path from 'path'

interface TrainerConfig {
  name: string
  email: string
  larkUserId?: string
  larkOpenId?: string
  calendarId: string
  salesforceId?: string
  languages: string[]
  location: string[]
}

interface InstallerConfig {
  name: string
  email: string
  larkUserId?: string
  larkOpenId?: string
  larkCalendarId?: string
  phone: string
  isActive: boolean
}

/**
 * Get the appropriate config file path based on environment
 * Uses config/local.json if it exists, otherwise falls back to production config
 */
function getConfigPath(configName: 'trainers' | 'installers'): string {
  const localConfigPath = path.join(process.cwd(), 'config', 'local.json')
  const prodConfigPath = path.join(process.cwd(), 'config', `${configName}.json`)

  // Check if local.json exists
  try {
    fs.accessSync(localConfigPath)
    // Local config exists, use it
    return localConfigPath
  } catch {
    // Local config doesn't exist, use production config
    return prodConfigPath
  }
}

/**
 * Update trainer config with Lark IDs after OAuth authorization
 */
export async function updateTrainerLarkIds(
  email: string,
  larkUserId: string,
  larkOpenId: string
): Promise<void> {
  const configPath = getConfigPath('trainers')
  
  try {
    // Read current config
    const configData = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configData)
    
    // Update trainer with matching email
    let updated = false
    if (config.trainers) {
      config.trainers = config.trainers.map((trainer: TrainerConfig) => {
        if (trainer.email === email) {
          updated = true
          return {
            ...trainer,
            larkUserId,
            larkOpenId
          }
        }
        return trainer
      })
    }
    
    // Update default trainer if email matches
    if (config.defaultTrainer && config.defaultTrainer.email === email) {
      config.defaultTrainer = {
        ...config.defaultTrainer,
        larkUserId,
        larkOpenId
      }
      updated = true
    }
    
    if (updated) {
      // Write back to file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      console.log(`✅ Updated trainers.json with Lark IDs for ${email}`)
    } else {
      console.log(`⚠️ Trainer with email ${email} not found in trainers.json`)
    }
  } catch (error) {
    console.error('Failed to update trainers.json:', error)
  }
}

/**
 * Update installer config with Lark IDs after OAuth authorization
 */
export async function updateInstallerLarkIds(
  email: string,
  larkUserId: string,
  larkOpenId: string
): Promise<void> {
  const configPath = getConfigPath('installers')
  
  try {
    // Read current config
    const configData = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configData)
    
    // Update installer with matching email
    let updated = false
    
    // Check internal installers
    if (config.internal?.installers) {
      config.internal.installers = config.internal.installers.map((installer: InstallerConfig) => {
        if (installer.email === email) {
          updated = true
          return {
            ...installer,
            larkUserId,
            larkOpenId
          }
        }
        return installer
      })
    }
    
    // Check external vendors (if they have email)
    if (config.external?.vendors) {
      config.external.vendors = config.external.vendors.map((vendor: any) => {
        if (vendor.email === email) {
          updated = true
          return {
            ...vendor,
            larkUserId,
            larkOpenId
          }
        }
        return vendor
      })
    }
    
    if (updated) {
      // Write back to file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      console.log(`✅ Updated installers.json with Lark IDs for ${email}`)
    } else {
      console.log(`⚠️ Installer with email ${email} not found in installers.json`)
    }
  } catch (error) {
    console.error('Failed to update installers.json:', error)
  }
}

/**
 * Update either trainer or installer config based on the auth type
 */
export async function updateConfigWithLarkIds(
  email: string,
  larkUserId: string,
  larkOpenId: string,
  userType: 'trainer' | 'installer' | 'manager' = 'trainer'
): Promise<void> {
  if (userType === 'trainer') {
    await updateTrainerLarkIds(email, larkUserId, larkOpenId)
  } else if (userType === 'installer') {
    await updateInstallerLarkIds(email, larkUserId, larkOpenId)
  }
  // Managers don't have a config file to update
}