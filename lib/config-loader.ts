import fs from 'fs/promises'
import fsSyncModule from 'fs'
import path from 'path'

/**
 * Get the appropriate config file path based on environment
 * Uses config/local.json if it exists, otherwise falls back to production config
 */
function getConfigPath(configName: 'trainers' | 'installers'): string {
  const localConfigPath = path.join(process.cwd(), 'config', 'local.json')
  const prodConfigPath = path.join(process.cwd(), 'config', `${configName}.json`)

  // Check if local.json exists using synchronous check
  if (fsSyncModule.existsSync(localConfigPath)) {
    console.log(`📁 Using local config: ${localConfigPath}`)
    return localConfigPath
  }

  console.log(`📁 Using production config: ${prodConfigPath}`)
  return prodConfigPath
}

/**
 * Load trainers config - uses local.json if available, otherwise trainers.json
 */
export async function loadTrainersConfig(): Promise<any> {
  const configPath = getConfigPath('trainers')
  const configContent = await fs.readFile(configPath, 'utf-8')
  const config = JSON.parse(configContent)
  
  // If loading from local.json, extract trainers array
  if (configPath.includes('local.json')) {
    return config
  }
  
  return config
}

/**
 * Load installers config - uses local.json if available, otherwise installers.json
 */
export async function loadInstallersConfig(): Promise<any> {
  const configPath = getConfigPath('installers')
  const configContent = await fs.readFile(configPath, 'utf-8')
  const config = JSON.parse(configContent)
  
  // If loading from local.json, extract installers object
  if (configPath.includes('local.json')) {
    return config.installers
  }
  
  return config
}

/**
 * Get the config file path being used (for debugging)
 */
export function getActiveConfigPath(configName: 'trainers' | 'installers'): string {
  return getConfigPath(configName)
}

