import jsforce from 'jsforce'
import { prisma } from './prisma'

let connection: any | null = null
let connectionError: string | null = null

export async function getSalesforceConnection() {
  // Return cached connection if available
  if (connection && connection.accessToken) {
    try {
      // Test the connection with a simple query
      await connection.query('SELECT Id FROM Account LIMIT 1')
      return connection
    } catch (error) {
      console.log('Cached connection invalid, reconnecting...')
      connection = null
    }
  }

  // Check if we have the required credentials
  const hasUsernamePassword = process.env.SF_USERNAME && process.env.SF_PASSWORD && process.env.SF_TOKEN
  const hasOAuth = process.env.SF_CLIENT_ID && process.env.SF_CLIENT_SECRET

  if (!hasUsernamePassword && !hasOAuth) {
    connectionError = 'No Salesforce credentials provided. Please set SF_USERNAME/SF_PASSWORD/SF_TOKEN or SF_CLIENT_ID/SF_CLIENT_SECRET'
    console.warn(connectionError)
    return null
  }

  try {
    // Default to sandbox URL for development
    const loginUrl = process.env.SF_LOGIN_URL || 'https://test.salesforce.com'
    console.log(`🔗 Connecting to Salesforce at: ${loginUrl}`)

    connection = new jsforce.Connection({
      loginUrl: loginUrl
    })

    if (hasUsernamePassword) {
      // Username/Password flow
      console.log('Connecting to Salesforce with username/password...')
      await connection.login(
        process.env.SF_USERNAME!,
        process.env.SF_PASSWORD! + process.env.SF_TOKEN!
      )
    } else if (hasOAuth) {
      // OAuth flow (for production)
      console.log('Connecting to Salesforce with OAuth...')
      await connection.login(
        process.env.SF_CLIENT_ID!,
        process.env.SF_CLIENT_SECRET!
      )
    }

    console.log('Salesforce connection established successfully')
    connectionError = null
    return connection

  } catch (error) {
    connectionError = `Salesforce connection failed: ${error}`
    console.error('Salesforce connection error:', error)
    connection = null
    return null
  }
}

export async function syncToSalesforce(merchant: any) {
  try {
    const conn = await getSalesforceConnection()

    // Skip sync if no connection (missing credentials)
    if (!conn) {
      console.log('⏭️ Skipping Salesforce sync - no connection available')
      return { success: false, message: 'No Salesforce connection' }
    }

    // Prepare Salesforce data mapping
    const sfData: any = {
      Name: merchant.companyName,
      External_Id__c: merchant.id
    }

    // Only include fields that have values
    if (merchant.address) sfData.BillingStreet = merchant.address
    if (merchant.phone) sfData.Phone = merchant.phone
    if (merchant.onboardingStage) sfData.Onboarding_Stage__c = merchant.onboardingStage
    if (merchant.installationDate) sfData.Installation_Date__c = merchant.installationDate
    if (merchant.trainingDate) sfData.Training_Date__c = merchant.trainingDate

    if (merchant.salesforceId) {
      // Update existing record
      console.log('🔄 Updating Salesforce Account:', merchant.salesforceId)
      const result = await conn.sobject('Account').update({
        Id: merchant.salesforceId,
        ...sfData
      })

      if (result.success) {
        console.log('Salesforce Account updated successfully')
        return { success: true, message: 'Account updated', salesforceId: merchant.salesforceId }
      } else {
        throw new Error(`Update failed: ${result.errors?.join(', ')}`)
      }
    } else {
      // Create new record
      console.log('➕ Creating new Salesforce Account for merchant:', merchant.id)
      const result = await conn.sobject('Account').create(sfData)

      if (result.success && result.id) {
        // Update merchant with Salesforce ID
        await prisma.merchant.update({
          where: { id: merchant.id },
          data: { salesforceId: result.id }
        })

        console.log('Created Salesforce Account with ID:', result.id)
        return { success: true, message: 'Account created', salesforceId: result.id }
      } else {
        throw new Error(`Creation failed: ${result.errors?.join(', ')}`)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Salesforce sync failed:', errorMessage)
    return { success: false, message: errorMessage }
  }
}

export async function testSalesforceConnection() {
  try {
    const conn = await getSalesforceConnection()
    if (!conn) {
      return {
        success: false,
        message: connectionError || 'No Salesforce credentials provided',
        environment: 'Not connected'
      }
    }

    // Test with a simple query and get org info
    const [accountResult, orgResult] = await Promise.all([
      conn.query('SELECT Id, Name FROM Account LIMIT 5'),
      conn.query('SELECT Id, Name, OrganizationType, IsSandbox FROM Organization LIMIT 1')
    ])

    const org = orgResult.records[0] as any
    const environment = org?.IsSandbox ? 'Sandbox' : 'Production'

    // Test custom fields query - first get the specific account ID
    let customFieldsData = null
    let onboardingTrainerData = null
    const accountId = accountResult.records[0]?.Id

    if (accountId) {
      // First, let's describe the Account object to see what fields are available
      let availableFields = []
      try {
        const accountDescribe = await conn.sobject('Account').describe()
        availableFields = accountDescribe.fields.map((field: any) => field.name)
        console.log('Available Account fields:', availableFields.filter((f: any) => f.includes('__c')).slice(0, 20))
      } catch (describeError) {
        console.log('Could not describe Account object:', describeError)
      }

      // Test each field individually to see which ones exist
      const fieldsToTest = [
        'Business_Store_Name__c',
        'Onboarding_Trainer__c',
        'Onboarding_Services_Bought__c',
        'Go_Live_Stage_Timestamp__c',
        'Planned_Go_Live_Date__c',
        'Finalised_Go_Live_Date__c',
        'Onboarding_Completed_Stage_Timestamp__c',
        'Latest_Stage_Date__c',
        'Latest_SF_Stage__c',
        'Onboarding_Trainer_Stage__c'
      ]

      const existingFields = []
      const fieldTestResults = []

      for (const field of fieldsToTest) {
        try {
          await conn.query(`SELECT Id, ${field} FROM Account WHERE Id = '${accountId}' LIMIT 1`)
          existingFields.push(field)
          fieldTestResults.push({ field, exists: true })
        } catch (error: any) {
          fieldTestResults.push({ field, exists: false, error: error.message })
        }
      }

      // Now query with only the existing fields
      if (existingFields.length > 0) {
        try {
          const customFieldsQuery = `
            SELECT Id, Name${existingFields.length > 0 ? ', ' + existingFields.join(', ') : ''}
            FROM Account
            WHERE Id = '${accountId}'
          `

          const customFieldsResult = await conn.query(customFieldsQuery)
          const account = customFieldsResult.records[0] as any

          customFieldsData = {
            account: {
              id: account.Id,
              name: account.Name,
              businessStoreName: account.Business_Store_Name__c,
              onboardingTrainer: account.Onboarding_Trainer__c,
              servicesBought: account.Onboarding_Services_Bought__c,
              goLiveStageTimestamp: account.Go_Live_Stage_Timestamp__c,
              plannedGoLiveDate: account.Planned_Go_Live_Date__c,
              finalisedGoLiveDate: account.Finalised_Go_Live_Date__c,
              onboardingCompletedTimestamp: account.Onboarding_Completed_Stage_Timestamp__c,
              latestStageDate: account.Latest_Stage_Date__c,
              latestSFStage: account.Latest_SF_Stage__c,
              onboardingTrainerStage: account.Onboarding_Trainer_Stage__c
            },
            fieldTestResults,
            existingFields,
            availableCustomFields: availableFields.filter((f: any) => f.includes('__c')).slice(0, 20)
          }
        } catch (queryError) {
          customFieldsData = {
            error: `Query failed: ${queryError}`,
            fieldTestResults,
            availableCustomFields: availableFields.filter((f: any) => f.includes('__c')).slice(0, 20)
          }
        }
      } else {
        customFieldsData = {
          error: 'None of the specified custom fields exist on this Account',
          fieldTestResults,
          availableCustomFields: availableFields.filter((f: any) => f.includes('__c')).slice(0, 20)
        }
      }
    } else {
      customFieldsData = { error: 'No Account found to test custom fields' }
    }

    // Test Onboarding Trainer data
    try {
      const onboardingTrainerQuery = `
        SELECT Id, Name, First_Revised_EGLD__c, Training_Date__c, CreatedDate, LastModifiedDate
        FROM Onboarding_Trainer__c
        ORDER BY CreatedDate DESC
        LIMIT 10
      `

      const onboardingTrainerResult = await conn.query(onboardingTrainerQuery)
      onboardingTrainerData = {
        totalCount: onboardingTrainerResult.totalSize,
        trainers: onboardingTrainerResult.records.map((trainer: any) => ({
          id: trainer.Id,
          name: trainer.Name,
          firstRevisedEGLD: trainer.First_Revised_EGLD__c,
          trainingDate: trainer.Training_Date__c,
          createdDate: trainer.CreatedDate,
          lastModifiedDate: trainer.LastModifiedDate
        }))
      }
    } catch (trainerError) {
      console.log('Onboarding Trainer query failed:', trainerError)
      onboardingTrainerData = { error: `Onboarding Trainer access failed: ${trainerError}` }
    }

    return {
      success: true,
      message: `Connected to Salesforce ${environment}`,
      environment: environment,
      orgName: org?.Name,
      accountCount: accountResult.totalSize,
      loginUrl: process.env.SF_LOGIN_URL || 'https://test.salesforce.com',
      accounts: accountResult.records.map((acc: any) => ({ id: acc.Id, name: acc.Name })),
      customFieldsData: customFieldsData,
      onboardingTrainerData: onboardingTrainerData
    }
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error}`,
      environment: 'Connection failed'
    }
  }
}
