// API Version: 2.0 - Direct SOQL query with trailing hyphen preservation (Oct 27, 2025)
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
  const trainerId = resolvedParams.merchantId // This is now the Salesforce ID

  try {

    if (!trainerId) {
      return NextResponse.json(
        { success: false, message: 'Merchant ID is required' },
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

    // Query directly by Salesforce ID (much more efficient and reliable)
    console.log(`Querying for merchant by Salesforce ID: "${trainerId}"`)

    let trainerResult: any = null

    try {
      // Query all fields needed by the UI
      // Only include fields that exist in production Salesforce
      // Fields that DON'T exist: Days_to_Go_Live__c, First_Call__c, Installer_Name__c, POS_Training_Date__c
      let trainerQuery = `
        SELECT Id, Name,
               Phone_Number__c, Merchant_PIC_Contact_Number__c,
               Operation_Manager_Contact__c, Operation_Manager_Contact__r.Phone, Operation_Manager_Contact__r.Name,
               Business_Owner_Contact__c, Business_Owner_Contact__r.Phone, Business_Owner_Contact__r.Name,
               Account_Name__c, Account_Name__r.POS_QR_Delivery_Tnx_Count_Past_30_Days__c,
               Welcome_Call_Status__c,
               First_Call_Timestamp__c,
               MSM_Name__c, MSM_Name__r.Name,
               Planned_Go_Live_Date__c,
               Menu_Collection_Form_Link__c,
               Menu_Collection_Submission_Timestamp__c,
               Completed_product_setup__c,
               Delivery_Tracking_Number__c,
               Delivery_Tracking_Number_Timestamp__c,
               Video_Proof_Link__c,
               Installation_Date__c,
               Actual_Installation_Date__c,
               Assigned_Installer__c,
               Training_Date__c,
               CSM_Name__c, CSM_Name__r.Name,
               Merchant_Location__c,
               Subscription_Activation_Date__c,
               BO_Account_Name__c,
               Onboarding_Portal__c,
               Onboarding_Portal__r.Training_Event_ID__c,
               Onboarding_Portal__r.Installation_Event_ID__c,
               CreatedDate, LastModifiedDate
        FROM Onboarding_Trainer__c
        WHERE Id = '${trainerId}'
        LIMIT 1
      `

      console.log('🔍 Querying for merchant by ID:', trainerId)
      trainerResult = await conn.query(trainerQuery)
      console.log('✅ Query completed, found:', trainerResult.totalSize, 'record(s)')
      if (trainerResult.totalSize > 0) {
        console.log('   Merchant name:', trainerResult.records[0].Name)
        console.log('   Tracking Number:', trainerResult.records[0].Delivery_Tracking_Number__c)
        console.log('   Tracking Timestamp:', trainerResult.records[0].Delivery_Tracking_Number_Timestamp__c)
      }

    } catch (error: any) {
      console.log('Failed to query merchant - ERROR DETAILS:', error)
      console.log('Error message:', error?.message)
      trainerResult = { totalSize: 0, records: [] }
    }

    if (!trainerResult || trainerResult.totalSize === 0) {
      return NextResponse.json({
        success: false,
        message: `No merchant found with Salesforce ID: ${trainerId}`,
        searchedFor: trainerId,
        suggestion: 'Verify the Salesforce Onboarding_Trainer__c ID is correct'
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
        
        // Get Shipment tracking link if not found in Order
        if (!trackingLink && ordersResult && ordersResult.totalSize > 0) {
          try {
            // Build list of Order IDs to query Shipment
            const orderIds = ordersResult.records.map((order: any) => `'${order.Id}'`).join(',')

            // Query Shipment object using Order__c relationship
            const shipmentQuery = `
              SELECT Id, Tracking_Link__c, Order__c, CreatedDate
              FROM Shipment__c
              WHERE Order__c IN (${orderIds})
              ORDER BY CreatedDate DESC
              LIMIT 1
            `

            console.log('🚢 Querying Shipment for Orders:', orderIds)
            const shipmentResult = await conn.query(shipmentQuery)
            console.log('🚢 Shipment query result:', shipmentResult.totalSize, 'records found')

            if (shipmentResult.totalSize > 0) {
              console.log('🚢 Shipment record:', {
                Id: shipmentResult.records[0].Id,
                Order__c: shipmentResult.records[0].Order__c,
                Tracking_Link__c: shipmentResult.records[0].Tracking_Link__c
              })

              if (shipmentResult.records[0].Tracking_Link__c) {
                trackingLink = shipmentResult.records[0].Tracking_Link__c
                console.log('📦 ✅ Found Tracking Link from Shipment:', shipmentResult.records[0].Id, '→', trackingLink)
              }
            }
          } catch (shipmentError: any) {
            console.log('Failed to fetch Shipment tracking:', shipmentError?.message)
            // Continue without tracking link - not a critical failure
          }
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
        csmName: trainer.CSM_Name__r ? trainer.CSM_Name__r.Name : trainer.CSM_Name__c,
        merchantLocation: trainer.Merchant_Location__c,
        installerName: trainer.Assigned_Installer__c, // Assigned_Installer__c is a picklist, not a lookup

        // Event IDs for rescheduling (from Onboarding_Portal__c object)
        installationEventId: trainer.Onboarding_Portal__r?.Installation_Event_ID__c,
        trainingEventId: trainer.Onboarding_Portal__r?.Training_Event_ID__c,

        hardwareFulfillmentDate: hardwareFulfillmentDate,
        trackingLink: trainer.Delivery_Tracking_Number__c || trackingLink,
        trackingNumberTimestamp: trainer.Delivery_Tracking_Number_Timestamp__c,
        orderNSStatus: orderNSStatus,
        orderShippingAddress: orderShippingAddress,
        menuCollectionFormLink: trainer.Menu_Collection_Form_Link__c,
        menuCollectionSubmissionTimestamp: trainer.Menu_Collection_Submission_Timestamp__c,
        boAccountName: trainer.BO_Account_Name__c,
        subscriptionActivationDate: trainer.Subscription_Activation_Date__c,
        posQrDeliveryTnxCount: trainer.Account_Name__r?.POS_QR_Delivery_Tnx_Count_Past_30_Days__c || 0,
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
      name: trainer.Name,
      trainerName: trainer.Name,
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
        message: `Failed to fetch trainer data: ${error.message}`
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
