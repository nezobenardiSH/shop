import trainersConfig from '@/config/trainers.json'
import merchantMapping from '@/config/merchant-trainer-mapping.json'

export interface TrainerAssignment {
  trainerName: string
  trainerEmail: string
  assignmentMethod: 'salesforce' | 'mapping' | 'operationManager' | 'default'
}

/**
 * Determine which trainer should handle a merchant based on various rules
 */
export function getAssignedTrainer(merchantData: any): TrainerAssignment {
  // 1. Check if merchant has a specific trainer assigned in Salesforce
  if (merchantData.assignedTrainerEmail) {
    const trainer = trainersConfig.trainers.find(t => 
      t.email.toLowerCase() === merchantData.assignedTrainerEmail.toLowerCase()
    )
    if (trainer) {
      return {
        trainerName: trainer.name,
        trainerEmail: trainer.email,
        assignmentMethod: 'salesforce'
      }
    }
  }

  // 2. Check merchant-to-trainer mapping
  const mapping = merchantMapping.mappings.find(m => {
    if (m.merchantId && merchantData.id === m.merchantId) return true
    if (m.merchantName && merchantData.name === m.merchantName) return true
    if (m.merchantNamePattern) {
      const pattern = new RegExp(m.merchantNamePattern)
      return pattern.test(merchantData.name)
    }
    return false
  })

  if (mapping) {
    return {
      trainerName: mapping.assignedTrainer,
      trainerEmail: mapping.assignedTrainerEmail,
      assignmentMethod: 'mapping'
    }
  }

  // 3. Use Operation Manager if their name matches a trainer
  if (merchantMapping.assignmentRules.useOperationManager && 
      merchantData.operationManagerContact?.name) {
    const trainer = trainersConfig.trainers.find(t => 
      t.name.toLowerCase() === merchantData.operationManagerContact.name.toLowerCase()
    )
    if (trainer) {
      return {
        trainerName: trainer.name,
        trainerEmail: trainer.email,
        assignmentMethod: 'operationManager'
      }
    }
  }

  // 4. Fallback to default trainer
  if (merchantMapping.assignmentRules.fallbackToDefault) {
    return {
      trainerName: merchantMapping.defaultTrainer.name,
      trainerEmail: merchantMapping.defaultTrainer.email,
      assignmentMethod: 'default'
    }
  }

  // If no assignment method works, use the first configured trainer
  return {
    trainerName: trainersConfig.trainers[0].name,
    trainerEmail: trainersConfig.trainers[0].email,
    assignmentMethod: 'default'
  }
}

/**
 * Get trainer availability considering their workload
 */
export async function getTrainerWithAvailability(
  preferredTrainer: string,
  date: Date
): Promise<string> {
  // This could check actual calendar availability and reassign if needed
  // For now, return the preferred trainer
  return preferredTrainer
}

/**
 * Round-robin assignment for load balancing
 */
let lastAssignedIndex = 0
export function getNextAvailableTrainer(): TrainerAssignment {
  const trainers = trainersConfig.trainers
  lastAssignedIndex = (lastAssignedIndex + 1) % trainers.length
  const trainer = trainers[lastAssignedIndex]
  
  return {
    trainerName: trainer.name,
    trainerEmail: trainer.email,
    assignmentMethod: 'default'
  }
}