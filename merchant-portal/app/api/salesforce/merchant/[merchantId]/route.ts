import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  const resolvedParams = await params
  const trainerName = resolvedParams.merchantId

  try {

    if (!trainerName) {
      return NextResponse.json(
        { success: false, message: 'Trainer name is required' },
        { status: 400 }
      )
    }

    // Get Salesforce connection
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { success: false, message: 'Failed to connect to Salesforce' },
        { status: 500 }
      )
    }

    // Convert URL-friendly trainer name back to actual name
    // "Nasi-Lemak-" should become "Nasi Lemak-"
    // Replace hyphens with spaces, but preserve trailing hyphen
    let actualTrainerName = trainerName
    if (trainerName.includes('-')) {
      if (trainerName.endsWith('-')) {
        // For names ending with hyphen: "Nasi-Lemak-" -> "Nasi Lemak-"
        const withoutTrailingHyphen = trainerName.slice(0, -1) // Remove last hyphen
        const withSpaces = withoutTrailingHyphen.replace(/-/g, ' ') // Replace remaining hyphens with spaces
        actualTrainerName = withSpaces + '-' // Add back the trailing hyphen
      } else {
        // For names not ending with hyphen: replace all hyphens with spaces
        actualTrainerName = trainerName.replace(/-/g, ' ')
      }
    }

    // First, find the OnboardingTrainer by name
    let trainerResult: any = null

    // Let's use the JavaScript filtering approach since SOQL queries are failing
    console.log('Getting all trainers and filtering in JavaScript...')

    try {
      const allTrainersQuery = `
        SELECT Id, Name, First_Revised_EGLD__c, Onboarding_Trainer_Stage__c, Installation_Date__c,
               Training_Date__c, Phone_Number__c, Merchant_PIC_Contact_Number__c,
               Operation_Manager_Contact__c, Operation_Manager_Contact__r.Phone, Operation_Manager_Contact__r.Name,
               Business_Owner_Contact__c, Business_Owner_Contact__r.Phone, Business_Owner_Contact__r.Name,
               CreatedDate, LastModifiedDate
        FROM Onboarding_Trainer__c
        ORDER BY Name LIMIT 50
      `
      const allTrainersResult = await conn.query(allTrainersQuery)

      console.log('All trainers found:', allTrainersResult.records.map((t: any) => `"${t.Name}"`))
      console.log('Looking for:', `"${actualTrainerName}"`)

      // Filter in JavaScript for exact match
      const matchingTrainer = allTrainersResult.records.find((trainer: any) => {
        console.log(`Comparing "${trainer.Name}" === "${actualTrainerName}": ${trainer.Name === actualTrainerName}`)
        return trainer.Name === actualTrainerName ||
               trainer.Name === trainerName ||
               trainer.Name.toLowerCase() === actualTrainerName.toLowerCase() ||
               trainer.Name.toLowerCase() === trainerName.toLowerCase()
      })

      if (matchingTrainer) {
        console.log('Found matching trainer:', matchingTrainer.Name)
        trainerResult = {
          totalSize: 1,
          records: [matchingTrainer]
        }
      } else {
        console.log('No matching trainer found in JavaScript filter')
        trainerResult = { totalSize: 0, records: [] }
      }

    } catch (error) {
      console.log('Failed to get all trainers:', error)
      trainerResult = { totalSize: 0, records: [] }
    }

    // The search logic is now handled above

    if (!trainerResult || trainerResult.totalSize === 0) {
      // Debug: Let's see what trainers actually exist
      let allTrainersResult: any = null
      try {
        allTrainersResult = await conn.query(`
          SELECT Id, Name
          FROM Onboarding_Trainer__c
          ORDER BY Name
          LIMIT 20
        `)
      } catch (error) {
        console.log('Failed to get all trainers for debugging:', error)
      }

      return NextResponse.json({
        success: false,
        message: `No OnboardingTrainer found with name: ${trainerName}`,
        searchedFor: trainerName,
        searchedVariations: [
          `"${trainerName}"`,
          `"${actualTrainerName}"`,
          `"${trainerName.replace(/-/g, ' ')}"`,
          `"${trainerName.toLowerCase()}"`,
          `"${actualTrainerName.toLowerCase()}"`
        ],
        suggestion: 'Try using the exact OnboardingTrainer.Name from Salesforce',
        availableTrainers: allTrainersResult?.records?.map((t: any) => t.Name) || [],
        totalTrainersInSystem: allTrainersResult?.totalSize || 0
      }, { status: 404 })
    }

    const trainer = trainerResult.records[0]

    // Since Account__c field doesn't exist, let's get the first account for now
    // This might need refinement based on your actual data model
    let account: any = null
    try {
      const accountResult = await conn.query(`SELECT Id, Name, Business_Store_Name__c FROM Account LIMIT 1`)
      if (accountResult.totalSize > 0) {
        account = accountResult.records[0]
      }
    } catch (error) {
      console.log('Failed to get account:', error)
    }

    // Get detailed account data with custom fields (if account exists)
    let accountData = null
    if (account) {
      try {
        const detailedAccountQuery = `
          SELECT Id, Name, Business_Store_Name__c, Onboarding_Trainer__c,
                 Onboarding_Services_Bought__c, Go_Live_Stage_Timestamp__c,
                 Planned_Go_Live_Date__c, Finalised_Go_Live_Date__c,
                 Latest_Stage_Date__c, Latest_SF_Stage__c, Onboarding_Trainer_Stage__c
          FROM Account
          WHERE Id = '${account.Id}'
        `

        const detailedResult = await conn.query(detailedAccountQuery)
        if (detailedResult.totalSize > 0) {
          const acc = detailedResult.records[0] as any
          accountData = {
            id: acc.Id,
            name: acc.Name,
            businessStoreName: acc.Business_Store_Name__c,
            onboardingTrainer: acc.Onboarding_Trainer__c,
            servicesBought: acc.Onboarding_Services_Bought__c,
            goLiveStageTimestamp: acc.Go_Live_Stage_Timestamp__c,
            plannedGoLiveDate: acc.Planned_Go_Live_Date__c,
            finalisedGoLiveDate: acc.Finalised_Go_Live_Date__c,
            latestStageDate: acc.Latest_Stage_Date__c,
            latestSFStage: acc.Latest_SF_Stage__c,
            onboardingTrainerStage: acc.Onboarding_Trainer_Stage__c
          }
        }
      } catch (error) {
        console.log('Detailed account query failed:', error)
      }
    }

    // Return the specific trainer data (not all trainers)
    const onboardingTrainerData = {
      totalCount: 1,
      trainers: [{
        id: trainer.Id,
        name: trainer.Name,
        firstRevisedEGLD: trainer.First_Revised_EGLD__c,
        onboardingTrainerStage: trainer.Onboarding_Trainer_Stage__c,
        installationDate: trainer.Installation_Date__c,
        trainingDate: trainer.Training_Date__c,
        phoneNumber: trainer.Phone_Number__c,
        merchantPICContactNumber: trainer.Merchant_PIC_Contact_Number__c,
        operationManagerContact: trainer.Operation_Manager_Contact__r ? {
          id: trainer.Operation_Manager_Contact__c,
          name: trainer.Operation_Manager_Contact__r.Name,
          phone: trainer.Operation_Manager_Contact__r.Phone
        } : null,
        businessOwnerContact: trainer.Business_Owner_Contact__r ? {
          id: trainer.Business_Owner_Contact__c,
          name: trainer.Business_Owner_Contact__r.Name,
          phone: trainer.Business_Owner_Contact__r.Phone
        } : null,
        createdDate: trainer.CreatedDate,
        lastModifiedDate: trainer.LastModifiedDate
      }]
    }

    return NextResponse.json({
      success: true,
      message: `Successfully loaded data for trainer: ${trainer.Name}`,
      trainerName: trainerName,
      account: accountData,
      onboardingTrainerData: onboardingTrainerData
    })

  } catch (error: any) {
    console.error('Merchant data fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Failed to fetch trainer data: ${error.message}`,
        trainerName: trainerName
      },
      { status: 500 }
    )
  }
}
