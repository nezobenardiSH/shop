import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

// Disable caching for this route - always fetch fresh data from Salesforce
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper function to fix Salesforce file URLs
async function fixSalesforceFileUrl(url: string | null, conn: any): Promise<string | null> {
  if (!url || !conn) return url

  try {
    // Check if it's the old format that needs fixing
    if (url.includes('/servlet/servlet.FileDownload?file=')) {
      // Extract ContentDocument ID from old URL
      const contentDocumentId = url.split('file=')[1]

      // Query for the latest ContentVersion for this ContentDocument
      const contentVersions = await conn.query(`
        SELECT Id FROM ContentVersion
        WHERE ContentDocumentId = '${contentDocumentId}'
        AND IsLatest = true
        LIMIT 1
      `)

      if (contentVersions.records && contentVersions.records.length > 0) {
        const contentVersionId = contentVersions.records[0].Id
        return `${conn.instanceUrl}/sfc/servlet.shepherd/version/download/${contentVersionId}`
      }
    }

    // Return original URL if it's already in the correct format or couldn't be fixed
    return url
  } catch (error) {
    console.log('Error fixing Salesforce file URL:', error)
    return url // Return original URL if there's an error
  }
}

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
    // BUT preserve trailing hyphens as they are part of the actual name in Salesforce
    let actualTrainerName = trainerName

    // Check if there's a trailing hyphen
    const hasTrailingHyphen = trainerName.endsWith('-')

    // Replace all hyphens with spaces
    actualTrainerName = trainerName.replace(/-/g, ' ')

    // If there was a trailing hyphen, restore it
    if (hasTrailingHyphen) {
      actualTrainerName = actualTrainerName.trimEnd() + '-'
    }

    // First, find the OnboardingTrainer by name
    let trainerResult: any = null

    // Query directly for the specific trainer name (much more efficient)
    console.log(`Querying for specific trainer: "${actualTrainerName}"`)

    try {
      // Escape single quotes for SOQL
      const escapedTrainerName = actualTrainerName.replace(/'/g, "\\'")

      // Try with all fields including training dates and event IDs
      let trainerQuery = `
        SELECT Id, Name, First_Revised_EGLD__c, Onboarding_Trainer_Stage__c, Installation_Date__c,
               Phone_Number__c, Merchant_PIC_Contact_Number__c,
               Operation_Manager_Contact__c, Operation_Manager_Contact__r.Phone, Operation_Manager_Contact__r.Name,
               Business_Owner_Contact__c, Business_Owner_Contact__r.Phone, Business_Owner_Contact__r.Name,
               Account_Name__c, Shipping_Street__c, Shipping_City__c, Shipping_State__c,
               Shipping_Zip_Postal_Code__c, Shipping_Country__c, Sub_Industry__c,
               Preferred_Language__c, Planned_Go_Live_Date__c, Required_Features_by_Merchant__c,
               Video_Proof_Link__c, Onboarding_Services_Bought__c,
               Synced_Quote_Total_Amount__c, Pending_Payment__c,
               Welcome_Call_Status__c, First_Call_Timestamp__c, MSM_Name__c, MSM_Name__r.Name,
               Product_Setup_Status__c, Completed_product_setup__c,
               Hardware_Delivery_Status__c, Hardware_Installation_Status__c, Actual_Installation_Date__c,
               Installation_Issues_Elaboration__c, Training_Status__c,
               Training_Date__c, POS_Training_Date__c,
               Installation_Event_Id__c, Training_Event_Id__c, POS_Training_Event_Id__c,
               Installer_Name__c, Installer_Name__r.Name,
               CSM_Name__c, CSM_Name__r.Name, CSM_Name_BO__c, CSM_Name_BO__r.Name,
               Menu_Collection_Form_Link__c, Menu_Collection_Submission_Timestamp__c, BO_Account_Name__c,
               Subscription_Activation_Date__c,
               SSM__c, Merchant_Location__c,
               CreatedDate, LastModifiedDate
        FROM Onboarding_Trainer__c
        WHERE Name = '${escapedTrainerName}'
        LIMIT 1
      `

      try {
        console.log('🔍 Attempting direct query for trainer...')
        trainerResult = await conn.query(trainerQuery)
        console.log('✅ Direct query succeeded, found:', trainerResult.totalSize, 'record(s)')
        if (trainerResult.totalSize > 0) {
          console.log('   Trainer name:', trainerResult.records[0].Name)
        }
      } catch (queryError: any) {
        // If query fails (likely due to missing fields), try without training date fields
        console.log('⚠️ Query with training dates failed, trying without them:', queryError.message)
        console.log('Note: Training date fields will not be available in this query')
        trainerQuery = `
          SELECT Id, Name, First_Revised_EGLD__c, Onboarding_Trainer_Stage__c, Installation_Date__c,
                 Phone_Number__c, Merchant_PIC_Contact_Number__c,
                 Operation_Manager_Contact__c, Operation_Manager_Contact__r.Phone, Operation_Manager_Contact__r.Name,
                 Business_Owner_Contact__c, Business_Owner_Contact__r.Phone, Business_Owner_Contact__r.Name,
                 Account_Name__c, Shipping_Street__c, Shipping_City__c, Shipping_State__c,
                 Shipping_Zip_Postal_Code__c, Shipping_Country__c, Sub_Industry__c,
                 Preferred_Language__c, Planned_Go_Live_Date__c, Required_Features_by_Merchant__c,
                 Video_Proof_Link__c, Onboarding_Services_Bought__c,
                 Synced_Quote_Total_Amount__c, Pending_Payment__c,
                 Welcome_Call_Status__c, First_Call_Timestamp__c, MSM_Name__c, MSM_Name__r.Name,
                 Product_Setup_Status__c, Completed_product_setup__c,
                 Hardware_Delivery_Status__c, Hardware_Installation_Status__c, Actual_Installation_Date__c,
                 Installation_Issues_Elaboration__c, Training_Status__c,
                 Installation_Event_Id__c, Training_Event_Id__c, POS_Training_Event_Id__c,
                 Installer_Name__c, Installer_Name__r.Name,
                 CSM_Name__c, CSM_Name__r.Name, CSM_Name_BO__c, CSM_Name_BO__r.Name,
                 Menu_Collection_Form_Link__c, Menu_Collection_Submission_Timestamp__c, BO_Account_Name__c,
                 Subscription_Activation_Date__c,
                 SSM__c,
                 CreatedDate, LastModifiedDate
          FROM Onboarding_Trainer__c
          WHERE Name = '${escapedTrainerName}'
          LIMIT 1
        `
        trainerResult = await conn.query(trainerQuery)
        console.log('✅ Fallback query succeeded, found:', trainerResult.totalSize, 'record(s)')
      }

    } catch (error: any) {
      console.log('Failed to query trainer - ERROR DETAILS:', error)
      console.log('Error message:', error?.message)
      trainerResult = { totalSize: 0, records: [] }
    }

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

    // Get OrderItems and Shipment data associated with this Account
    let orderItems: any[] = []
    let hardwareFulfillmentDate: string | null = null
    let trackingLink: string | null = null
    let orderNSStatus: string | null = null
    let orderShippingAddress: any = null
    if (account) {
      try {
        // First get Orders for this Account with Type field and Hardware Fulfillment Date
        // ShippingAddress is a compound field - query all its components
        const ordersQuery = `
          SELECT Id, Type, Hardware_Fulfillment_Date__c, NSStatus__c,
                 ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry
          FROM Order
          WHERE AccountId = '${account.Id}'
          ORDER BY CreatedDate DESC
          LIMIT 10
        `
        
        const ordersResult = await conn.query(ordersQuery)
        console.log('📦 Orders found:', ordersResult.totalSize)

        if (ordersResult.totalSize > 0) {
          // Create a map of order IDs to order types and hardware fulfillment dates
          const orderTypeMap: { [key: string]: string } = {}

          // Log all orders to see which one has the updated address
          ordersResult.records.forEach((order: any, index: number) => {
            console.log(`📦 Order ${index + 1}:`, {
              Id: order.Id,
              Type: order.Type,
              ShippingStreet: order.ShippingStreet,
              ShippingCity: order.ShippingCity,
              ShippingState: order.ShippingState,
              ShippingPostalCode: order.ShippingPostalCode,
              ShippingCountry: order.ShippingCountry
            })
          })

          ordersResult.records.forEach((order: any) => {
            orderTypeMap[order.Id] = order.Type || 'N/A'
            if (order.Hardware_Fulfillment_Date__c && !hardwareFulfillmentDate) {
              hardwareFulfillmentDate = order.Hardware_Fulfillment_Date__c
            }
            if (order.NSStatus__c && !orderNSStatus) {
              orderNSStatus = order.NSStatus__c
            }
            // Build shipping address from compound field components
            // Take the FIRST order (most recent due to ORDER BY CreatedDate DESC)
            if (!orderShippingAddress) {
              // Return as object with individual components for easier state extraction
              if (order.ShippingStreet || order.ShippingCity || order.ShippingState || order.ShippingCountry) {
                orderShippingAddress = {
                  street: order.ShippingStreet || '',
                  city: order.ShippingCity || '',
                  state: order.ShippingState || '',
                  stateCode: order.ShippingState || '',
                  postalCode: order.ShippingPostalCode || '',
                  country: order.ShippingCountry || '',
                  countryCode: order.ShippingCountry || ''
                }
                console.log('📍 Using ShippingAddress from Order:', order.Id)
                console.log('📍 ShippingAddress:', orderShippingAddress)
              }
            }
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
        
        // Get Shipment tracking link
        // TODO: Fix the Shipment__c query - Account__c field doesn't exist
        // Need to find the correct field name for the Account relationship
        try {
          // Temporarily disabled until we find the correct field name
          // const shipmentQuery = `
          //   SELECT Id, Tracking_Link__c
          //   FROM Shipment__c
          //   WHERE Account__c = '${account.Id}'
          //   ORDER BY CreatedDate DESC
          //   LIMIT 1
          // `
          //
          // const shipmentResult = await conn.query(shipmentQuery)
          // if (shipmentResult.totalSize > 0) {
          //   trackingLink = shipmentResult.records[0].Tracking_Link__c
          // }
        } catch (shipmentError) {
          console.log('Failed to fetch Shipment tracking:', shipmentError)
          // Continue without tracking link - not a critical failure
        }
      } catch (error) {
        console.log('Failed to fetch OrderItems:', error)
        // Continue without order items - not a critical failure
      }
    }

    // Fix SSM document URL if needed
    const fixedSsmDocumentUrl = await fixSalesforceFileUrl(trainer.SSM__c, conn)

    // Return the specific trainer data (not all trainers)
    const onboardingTrainerData = {
      totalCount: 1,
      trainers: [{
        id: trainer.Id,
        name: trainer.Name,
        firstRevisedEGLD: trainer.First_Revised_EGLD__c,
        onboardingTrainerStage: trainer.Onboarding_Trainer_Stage__c,
        installationDate: trainer.Installation_Date__c,
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
        onboardingServicesBought: trainer.Onboarding_Services_Bought__c,
        syncedQuoteTotalAmount: trainer.Synced_Quote_Total_Amount__c,
        pendingPayment: trainer.Pending_Payment__c,
        welcomeCallStatus: trainer.Welcome_Call_Status__c,
        firstCallTimestamp: trainer.First_Call_Timestamp__c,
        msmName: trainer.MSM_Name__r ? trainer.MSM_Name__r.Name : trainer.MSM_Name__c,
        productSetupStatus: trainer.Product_Setup_Status__c,
        completedProductSetup: trainer.Completed_product_setup__c,
        hardwareDeliveryStatus: trainer.Hardware_Delivery_Status__c,
        hardwareInstallationStatus: trainer.Hardware_Installation_Status__c,
        actualInstallationDate: trainer.Actual_Installation_Date__c,
        installationIssuesElaboration: trainer.Installation_Issues_Elaboration__c,
        trainingStatus: trainer.Training_Status__c,
        trainingDate: trainer.Training_Date__c,
        backOfficeTrainingDate: trainer.Training_Date__c, // BackOffice uses Training_Date__c field (Date only)
        posTrainingDate: trainer.POS_Training_Date__c,
        csmName: trainer.CSM_Name__r ? trainer.CSM_Name__r.Name : trainer.CSM_Name__c,
        csmNameBO: trainer.CSM_Name_BO__r ? trainer.CSM_Name_BO__r.Name : trainer.CSM_Name_BO__c,
        merchantLocation: trainer.Merchant_Location__c,
        installerName: trainer.Installer_Name__r ? trainer.Installer_Name__r.Name : trainer.Installer_Name__c,

        // Event IDs for rescheduling
        installationEventId: trainer.Installation_Event_Id__c,
        trainingEventId: trainer.Training_Event_Id__c,  // Used for both 'training' and 'backoffice-training'
        posTrainingEventId: trainer.POS_Training_Event_Id__c,

        // Debug logging for training dates
        ...(console.log('Training date fields from Salesforce:', {
          Training_Date__c: trainer.Training_Date__c,
          POS_Training_Date__c: trainer.POS_Training_Date__c
        }), {}),
        hardwareFulfillmentDate: hardwareFulfillmentDate,
        trackingLink: trackingLink,
        orderNSStatus: orderNSStatus,
        orderShippingAddress: orderShippingAddress,
        menuCollectionFormLink: trainer.Menu_Collection_Form_Link__c,
        menuCollectionSubmissionTimestamp: trainer.Menu_Collection_Submission_Timestamp__c,
        boAccountName: trainer.BO_Account_Name__c,
        subscriptionActivationDate: trainer.Subscription_Activation_Date__c,
        videoProofLink: trainer.Video_Proof_Link__c,
        ssmDocument: fixedSsmDocumentUrl,
        createdDate: trainer.CreatedDate,
        lastModifiedDate: trainer.LastModifiedDate
      }]
    }

    console.log('✅ Final orderShippingAddress being returned:', orderShippingAddress)

    return NextResponse.json({
      success: true,
      message: `Successfully loaded data for trainer: ${trainer.Name}`,
      trainerName: trainerName,
      account: accountData,
      onboardingTrainerData: onboardingTrainerData,
      orderItems: orderItems
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error: any) {
    console.error('Merchant data fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        message: `Failed to fetch trainer data: ${error.message}`,
        trainerName: trainerName
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    )
  }
}
