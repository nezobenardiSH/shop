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
    // "Nasi-Lemak-" should become "Nasi Lemak" (without trailing hyphen)
    // "Nasi-Lemak" should become "Nasi Lemak"
    // Replace hyphens with spaces
    let actualTrainerName = trainerName
    
    // Remove trailing hyphen if present
    if (trainerName.endsWith('-')) {
      actualTrainerName = trainerName.slice(0, -1)
    }
    
    // Replace hyphens with spaces
    if (actualTrainerName.includes('-')) {
      actualTrainerName = actualTrainerName.replace(/-/g, ' ')
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
               Account_Name__c, Shipping_Street__c, Shipping_City__c, Shipping_State__c, 
               Shipping_Zip_Postal_Code__c, Shipping_Country__c, Sub_Industry__c, 
               Preferred_Language__c, Planned_Go_Live_Date__c, Required_Features_by_Merchant__c,
               Synced_Quote_Total_Amount__c, Pending_Payment__c,
               CreatedDate, LastModifiedDate
        FROM Onboarding_Trainer__c
        ORDER BY Name LIMIT 50
      `
      const allTrainersResult = await conn.query(allTrainersQuery)

      console.log('All trainers found:', allTrainersResult.records.map((t: any) => `"${t.Name}"`))
      console.log('Looking for:', `"${actualTrainerName}"`)

      // Filter in JavaScript for exact match
      const matchingTrainer = allTrainersResult.records.find((trainer: any) => {
        console.log(`Comparing "${trainer.Name}" with "${actualTrainerName}" and original "${trainerName}"`)
        
        // Try multiple matching strategies
        const trainerNameLower = trainer.Name.toLowerCase()
        const actualNameLower = actualTrainerName.toLowerCase()
        const originalNameLower = trainerName.toLowerCase()
        
        // Remove trailing hyphens for comparison
        const trainerNameClean = trainer.Name.replace(/-$/, '').toLowerCase()
        const actualNameClean = actualTrainerName.replace(/-$/, '').toLowerCase()
        const originalNameClean = trainerName.replace(/-$/, '').toLowerCase()
        
        return trainer.Name === actualTrainerName ||
               trainer.Name === trainerName ||
               trainerNameLower === actualNameLower ||
               trainerNameLower === originalNameLower ||
               trainerNameClean === actualNameClean ||
               trainerNameClean === originalNameClean ||
               // Also try without any hyphens at all
               trainer.Name.replace(/-/g, ' ').toLowerCase() === actualTrainerName.replace(/-/g, ' ').toLowerCase()
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

    // Get the Account by ID (Account_Name__c actually contains the Account ID)
    let account: any = null
    if (trainer.Account_Name__c) {
      try {
        // Account_Name__c contains the Account ID, not the name
        const accountResult = await conn.query(`SELECT Id, Name, Business_Store_Name__c FROM Account WHERE Id = '${trainer.Account_Name__c}'`)
        if (accountResult.totalSize > 0) {
          account = accountResult.records[0]
        }
      } catch (error) {
        console.log('Failed to get account by ID:', error)
      }
    }

    // Get detailed account data with custom fields (if account exists)
    let accountData = null
    if (account) {
      try {
        const detailedAccountQuery = `
          SELECT Id, Name, Business_Store_Name__c
          FROM Account
          WHERE Id = '${account.Id}'
        `

        const detailedResult = await conn.query(detailedAccountQuery)
        if (detailedResult.totalSize > 0) {
          const acc = detailedResult.records[0] as any
          accountData = {
            id: acc.Id,
            name: acc.Name,
            businessStoreName: acc.Business_Store_Name__c
          }
        }
      } catch (error) {
        console.log('Detailed account query failed:', error)
      }
    }

    // Get OrderItems associated with this Account
    let orderItems = []
    if (account) {
      try {
        // First get Orders for this Account with Type field
        const ordersQuery = `
          SELECT Id, Type
          FROM Order
          WHERE AccountId = '${account.Id}'
          LIMIT 10
        `
        
        const ordersResult = await conn.query(ordersQuery)
        
        if (ordersResult.totalSize > 0) {
          // Create a map of order IDs to order types
          const orderTypeMap: { [key: string]: string } = {}
          ordersResult.records.forEach((order: any) => {
            orderTypeMap[order.Id] = order.Type || 'N/A'
          })
          
          const orderIds = ordersResult.records.map((order: any) => `'${order.Id}'`).join(',')
          
          // Now get OrderItems for these Orders
          const orderItemsQuery = `
            SELECT Id, Product2Id, Product2.Name, TotalPrice, UnitPrice, Quantity, OrderId
            FROM OrderItem
            WHERE OrderId IN (${orderIds})
            LIMIT 50
          `
          
          const orderItemsResult = await conn.query(orderItemsQuery)
          
          if (orderItemsResult.totalSize > 0) {
            orderItems = orderItemsResult.records.map((item: any) => ({
              id: item.Id,
              product2Id: item.Product2Id,
              productName: item.Product2?.Name || 'Unknown Product',
              totalPrice: item.TotalPrice,
              unitPrice: item.UnitPrice,
              quantity: item.Quantity,
              orderId: item.OrderId,
              orderType: orderTypeMap[item.OrderId] || 'N/A'
            }))
          }
        }
      } catch (error) {
        console.log('Failed to fetch OrderItems:', error)
        // Continue without order items - not a critical failure
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
        accountId: trainer.Account_Name__c,  // This field contains the Account ID
        accountName: account?.Name || trainer.Account_Name__c,  // Use fetched Account name or fallback to ID
        shippingStreet: trainer.Shipping_Street__c,
        shippingCity: trainer.Shipping_City__c,
        shippingState: trainer.Shipping_State__c,
        shippingZipPostalCode: trainer.Shipping_Zip_Postal_Code__c,
        shippingCountry: trainer.Shipping_Country__c,
        subIndustry: trainer.Sub_Industry__c,
        preferredLanguage: trainer.Preferred_Language__c,
        plannedGoLiveDate: trainer.Planned_Go_Live_Date__c,
        requiredFeaturesByMerchant: trainer.Required_Features_by_Merchant__c,
        syncedQuoteTotalAmount: trainer.Synced_Quote_Total_Amount__c,
        pendingPayment: trainer.Pending_Payment__c,
        createdDate: trainer.CreatedDate,
        lastModifiedDate: trainer.LastModifiedDate
      }]
    }

    return NextResponse.json({
      success: true,
      message: `Successfully loaded data for trainer: ${trainer.Name}`,
      trainerName: trainerName,
      account: accountData,
      onboardingTrainerData: onboardingTrainerData,
      orderItems: orderItems
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
