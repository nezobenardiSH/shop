// API Version: 2.0 - Direct SOQL query with trailing hyphen preservation (Oct 27, 2025)
import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'
import { getInstallerType } from '@/lib/installer-availability'

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
               Phone_Number__c, Merchant_PIC_Contact_Number__c, Merchant_PIC_Name__c,
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
               Installation_ST_Ticket_No__c,
               Assigned_Installer__c,
               Training_Date__c,
               CSM_Name__c, CSM_Name__r.Name, CSM_Name__r.Email,
               Subscription_Activation_Date__c,
               BO_Account_Name__c,
               Onboarding_Services_Bought__c, Service_Type__c,
               Shipping_Street__c, Shipping_City__c, Shipping_State__c,
               Shipping_Zip_Postal_Code__c, Shipping_Country__c,
               Sub_Industry__c, Preferred_Language__c,
               Required_Features_by_Merchant__c,
               Onboarding_Summary__c,
               Workaround_Elaboration__c,
               Synced_Quote_Total_Amount__c, Pending_Payment__c,
               Product_Setup_Status__c,
               Hardware_Delivery_Status__c,
               Hardware_Installation_Status__c,
               Installation_Issues_Elaboration__c,
               Training_Status__c,
               Completed_Training__c,
               First_Revised_EGLD__c,
               Onboarding_Trainer_Stage__c,
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
        // Debug shipping fields
        const record = trainerResult.records[0] as any
        console.log('📍 Shipping fields from Salesforce:', {
          street: record.Shipping_Street__c,
          city: record.Shipping_City__c,
          state: record.Shipping_State__c,
          postalCode: record.Shipping_Zip_Postal_Code__c,
          country: record.Shipping_Country__c
        })
        console.log('   Tracking Number:', trainerResult.records[0].Delivery_Tracking_Number__c)
        console.log('   Tracking Timestamp:', trainerResult.records[0].Delivery_Tracking_Number_Timestamp__c)
        console.log('   Planned_Go_Live_Date__c:', trainerResult.records[0].Planned_Go_Live_Date__c)
        console.log('   First_Revised_EGLD__c:', trainerResult.records[0].First_Revised_EGLD__c)
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

    const trainer = trainerResult.records[0] as any

    // Debug CSM_Name field
    console.log('🔍 CSM_Name__c value:', trainer.CSM_Name__c)
    console.log('🔍 CSM_Name__r value:', trainer.CSM_Name__r)
    console.log('🔍 CSM_Name__r.Name value:', trainer.CSM_Name__r?.Name)

    // Debug Go-Live Date fields
    console.log('🚨 DEBUG - Planned_Go_Live_Date__c from Salesforce:', trainer.Planned_Go_Live_Date__c)
    console.log('🚨 DEBUG - First_Revised_EGLD__c from Salesforce:', trainer.First_Revised_EGLD__c)
    console.log('🚨 DEBUG - All trainer fields:', Object.keys(trainer).filter(k => k.toLowerCase().includes('live') || k.toLowerCase().includes('egld') || k.toLowerCase().includes('go')))

    // If CSM_Name__c exists but CSM_Name__r.Name doesn't, query the User separately
    let csmName: string | null = null
    if (trainer.CSM_Name__r?.Name) {
      csmName = trainer.CSM_Name__r.Name
      console.log('✅ Got CSM name from relationship:', csmName)
    } else if (trainer.CSM_Name__c) {
      console.log('⚠️ CSM_Name__c exists but relationship not populated, querying User separately...')
      try {
        const userQuery = `SELECT Id, Name FROM User WHERE Id = '${trainer.CSM_Name__c}' LIMIT 1`
        const userResult = await conn.query(userQuery)
        if (userResult.totalSize > 0) {
          csmName = (userResult.records[0] as any).Name
          console.log('✅ Got CSM name from separate User query:', csmName)
        } else {
          console.log('❌ No User found with ID:', trainer.CSM_Name__c)
        }
      } catch (userError) {
        console.log('❌ Error querying User for CSM name:', userError)
      }
    } else {
      console.log('ℹ️ No CSM assigned yet')
    }

    // Get Event IDs and dates from Onboarding_Portal__c
    let portalData: any = {
      trainingEventId: null,
      installationEventId: null,
      installationDate: null,
      installerName: null,
      trainingDate: null
    }
    try {
      const portalQuery = `
        SELECT Id, Training_Event_ID__c, Installation_Event_ID__c,
               Installation_Date__c, Installer_Name__c,
               Training_Date__c
        FROM Onboarding_Portal__c
        WHERE Onboarding_Trainer_Record__c = '${trainerId}'
        LIMIT 1
      `
      const portalResult = await conn.query(portalQuery)
      if (portalResult.totalSize > 0) {
        const portal = portalResult.records[0] as any
        portalData.trainingEventId = portal.Training_Event_ID__c
        portalData.installationEventId = portal.Installation_Event_ID__c
        portalData.installationDate = portal.Installation_Date__c
        portalData.trainingDate = portal.Training_Date__c

        // Installer_Name__c is now a text field, not a lookup
        portalData.installerName = portal.Installer_Name__c || null
        console.log('🔍 Installer_Name__c value:', portal.Installer_Name__c)

        console.log('✅ Found Onboarding_Portal__c record with data:', portalData)
      } else {
        console.log('⚠️ No Onboarding_Portal__c record found for this merchant')
      }
    } catch (portalError) {
      console.log('Failed to query Onboarding_Portal__c:', portalError)
    }

    // Get the Account by ID (Account_Name__c actually contains the Account ID)
    let account: any = null
    console.log('🔍 Account_Name__c value:', trainer.Account_Name__c)
    if (trainer.Account_Name__c) {
      try {
        // Account_Name__c contains the Account ID, not the name
        console.log(`📊 Fetching Account with ID: ${trainer.Account_Name__c}`)
        const accountResult = await conn.query(`SELECT Id, Name, Business_Store_Name__c, Planned_Go_Live_Date__c FROM Account WHERE Id = '${trainer.Account_Name__c}'`)
        console.log(`✅ Account query result: found ${accountResult.totalSize} records`)
        if (accountResult.totalSize > 0) {
          account = accountResult.records[0]
          console.log(`✅ Account found: ${account.Name}`)
        }
      } catch (error) {
        console.log('Failed to get account by ID:', error)
      }
    } else {
      console.log('⚠️ No Account_Name__c value in trainer record')
    }

    // Get detailed account data with custom fields (if account exists)
    let accountData = null
    if (account) {
      try {
        const detailedAccountQuery = `
          SELECT Id, Name, Business_Store_Name__c, Planned_Go_Live_Date__c
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
            plannedGoLiveDate: acc.Planned_Go_Live_Date__c
          }
          console.log('📊 Account data fetched:', accountData)
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
    let orderNSOrderNumber: string | null = null
    let orderShippingAddress: any = null
    if (account) {
      try {
        // First get Orders for this Account with Type field and Hardware Fulfillment Date
        // ShippingAddress is a compound field - query all its components
        const ordersQuery = `
          SELECT Id, Type, Hardware_Fulfillment_Date__c, NSStatus__c, NSOrderNumber__c,
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
            if (order.NSOrderNumber__c && !orderNSOrderNumber) {
              orderNSOrderNumber = order.NSOrderNumber__c
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

    // SSM__c field no longer exists in Salesforce

    // Return the specific trainer data (not all trainers)
    const onboardingTrainerData = {
      totalCount: 1,
      trainers: [{
        id: trainer.Id,
        name: trainer.Name,
        firstRevisedEGLD: trainer.First_Revised_EGLD__c,
        onboardingTrainerStage: trainer.Onboarding_Trainer_Stage__c,
        installationDate: portalData.installationDate || trainer.Installation_Date__c, // Use Portal date if available
        phoneNumber: trainer.Phone_Number__c,
        merchantPICContactNumber: trainer.Merchant_PIC_Contact_Number__c,
        merchantPICName: trainer.Merchant_PIC_Name__c,
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
        plannedGoLiveDate: (() => {
          const goLiveDate = accountData?.plannedGoLiveDate || trainer.Planned_Go_Live_Date__c || trainer.First_Revised_EGLD__c;
          console.log('🔍 GO-LIVE DATE DEBUG:', {
            fromAccount: accountData?.plannedGoLiveDate,
            fromTrainer: trainer.Planned_Go_Live_Date__c,
            fromEGLD: trainer.First_Revised_EGLD__c,
            final: goLiveDate
          });
          return goLiveDate;
        })(),
        requiredFeaturesByMerchant: trainer.Required_Features_by_Merchant__c,
        onboardingSummary: trainer.Onboarding_Summary__c,
        workaroundElaboration: trainer.Workaround_Elaboration__c,
        onboardingServicesBought: trainer.Onboarding_Services_Bought__c,
        serviceType: trainer.Service_Type__c,
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
        installationSTTicketNo: trainer.Installation_ST_Ticket_No__c,
        installationIssuesElaboration: trainer.Installation_Issues_Elaboration__c,
        trainingStatus: trainer.Training_Status__c,
        completedTraining: trainer.Completed_Training__c,
        trainingDate: portalData.trainingDate || trainer.Training_Date__c, // Use Portal date if available
        csmName: csmName, // Use the CSM name we resolved earlier
        csmEmail: trainer.CSM_Name__r?.Email || null, // CSM email for rescheduling
        assignedInstaller: trainer.Assigned_Installer__c, // For checking if external vendor (e.g., "Surfstek")
        installerName: portalData.installerName || null, // Only use Portal installer name

        // Event IDs for rescheduling (from Onboarding_Portal__c object)
        installationEventId: portalData.installationEventId,
        trainingEventId: portalData.trainingEventId,

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
        createdDate: trainer.CreatedDate,
        lastModifiedDate: trainer.LastModifiedDate
      }]
    }

    console.log('✅ Final orderShippingAddress being returned:', orderShippingAddress)

    // Get installer type for this merchant
    const installerType = await getInstallerType(trainerId)
    console.log('🔧 Installer type for merchant:', { trainerId, installerType })

    return NextResponse.json({
      success: true,
      message: `Successfully loaded data for trainer: ${trainer.Name}`,
      name: trainer.Name,
      trainerName: trainer.Name,
      account: accountData,
      onboardingTrainerData: onboardingTrainerData,
      orderItems: orderItems,
      orderNSOrderNumber: orderNSOrderNumber,
      installerType: installerType // Add installer type to response
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
