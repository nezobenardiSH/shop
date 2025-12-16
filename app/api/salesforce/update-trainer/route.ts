import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trainerId, updates } = body

    if (!trainerId) {
      return NextResponse.json(
        { success: false, error: 'Trainer ID is required' },
        { status: 400 }
      )
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }

    // Extract special flags before processing
    let clearInstallation = false
    let clearTraining = false
    let notifyAddressChange: {
      eventId: string
      assigneeEmail: string
      assigneeName: string
      bookingType: string
      bookingDate: string
      oldAddress: string
      newAddress: string
      merchantName: string
    } | null = null
    let notifySurftekCancel: {
      merchantName: string
      merchantId: string
      surftekCaseNum?: string
    } | null = null

    if (updates.clearInstallation) {
      clearInstallation = true
      delete updates.clearInstallation
    }
    if (updates.clearTraining) {
      clearTraining = true
      delete updates.clearTraining
    }
    if (updates.notifyAddressChange) {
      notifyAddressChange = updates.notifyAddressChange
      delete updates.notifyAddressChange
    }
    if (updates.notifySurftekCancel) {
      notifySurftekCancel = updates.notifySurftekCancel
      delete updates.notifySurftekCancel
    }

    // Get Salesforce connection
    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Salesforce' },
        { status: 500 }
      )
    }

    // Validate that the trainer exists
    try {
      const trainerCheck = await conn.query(`SELECT Id FROM Onboarding_Trainer__c WHERE Id = '${trainerId}' LIMIT 1`)
      if (trainerCheck.totalSize === 0) {
        return NextResponse.json(
          { success: false, error: 'Onboarding Trainer not found' },
          { status: 404 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `Trainer validation failed: ${error}` },
        { status: 400 }
      )
    }

    // Map frontend field names to Salesforce field names
    const fieldMapping: { [key: string]: string } = {
      name: 'Name',
      firstRevisedEGLD: 'First_Revised_EGLD__c',
      onboardingTrainerStage: 'Onboarding_Trainer_Stage__c',
      installationDate: 'Installation_Date__c',
      trainingDate: 'Training_Date__c',
      phoneNumber: 'Phone_Number__c',
      merchantPICContactNumber: 'Merchant_PIC_Contact_Number__c',
      // Shipping address fields
      shippingStreet: 'Shipping_Street__c',
      shippingCity: 'Shipping_City__c',
      shippingState: 'Shipping_State__c',
      shippingZipPostalCode: 'Shipping_Zip_Postal_Code__c',
      shippingCountry: 'Shipping_Country__c'
    }

    // Test each field individually to see which ones are writable
    const writableFields: string[] = []
    const nonWritableFields: string[] = []
    const finalUpdateData: any = { Id: trainerId }

    for (const [frontendField, value] of Object.entries(updates)) {
      const salesforceField = fieldMapping[frontendField]
      if (salesforceField) {
        try {
          // Test if we can update this single field
          const testUpdate = { Id: trainerId, [salesforceField]: value }
          await conn.sobject('Onboarding_Trainer__c').update(testUpdate)
          writableFields.push(salesforceField)
          finalUpdateData[salesforceField] = value
        } catch (fieldError: any) {
          nonWritableFields.push(salesforceField)
          console.log(`Field ${salesforceField} is not writable:`, fieldError.message)
        }
      }
    }

    // If no fields are writable, return error
    if (writableFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No fields are writable with current permissions',
        nonWritableFields,
        details: 'Check field-level security settings in Salesforce'
      }, { status: 403 })
    }

    // Perform the update with only writable fields
    try {
      const result = await conn.sobject('Onboarding_Trainer__c').update(finalUpdateData)
      
      if (result.success) {
        // Clear booking in Portal if requested (region change scenario)
        if (clearInstallation || clearTraining) {
          try {
            // Find the Portal record
            const portalQuery = await conn.query(`
              SELECT Id FROM Onboarding_Portal__c
              WHERE Onboarding_Trainer_Record__c = '${trainerId}'
              LIMIT 1
            `)

            if (portalQuery.totalSize > 0) {
              const portalId = (portalQuery.records[0] as any).Id
              const portalUpdate: any = { Id: portalId }

              if (clearInstallation) {
                portalUpdate.Installation_Date__c = null
                portalUpdate.Installer_Name__c = null
                portalUpdate.Installation_Event_ID__c = null
                console.log('🗑️ Clearing installation booking from Portal')
              }
              if (clearTraining) {
                portalUpdate.Training_Date__c = null
                portalUpdate.Trainer_Name__c = null
                portalUpdate.Training_Event_ID__c = null
                console.log('🗑️ Clearing training booking from Portal')
              }

              await conn.sobject('Onboarding_Portal__c').update(portalUpdate)
              console.log('✅ Portal booking cleared successfully')
            }
          } catch (portalError) {
            console.error('⚠️ Failed to clear Portal booking:', portalError)
            // Don't fail the whole request if portal update fails
          }
        }

        // Send address change notifications if requested
        if (notifyAddressChange && notifyAddressChange.eventId && notifyAddressChange.assigneeEmail) {
          try {
            const { larkService } = await import('@/lib/lark')
            const { sendAddressChangeNotification } = await import('@/lib/lark-notifications')

            // 1. Update calendar event location
            try {
              await larkService.updateCalendarEvent(
                'primary', // Will be resolved by the method
                notifyAddressChange.eventId,
                { location: notifyAddressChange.newAddress },
                notifyAddressChange.assigneeEmail
              )
              console.log('✅ Calendar event location updated')
            } catch (calError) {
              console.error('⚠️ Failed to update calendar event:', calError)
              // Don't fail the whole request
            }

            // 2. Send Lark notification
            await sendAddressChangeNotification(
              notifyAddressChange.assigneeEmail,
              notifyAddressChange.merchantName,
              notifyAddressChange.bookingType,
              notifyAddressChange.bookingDate,
              notifyAddressChange.oldAddress,
              notifyAddressChange.newAddress
            )
            console.log('✅ Address change notification sent')
          } catch (notifyError) {
            console.error('⚠️ Failed to send address change notification:', notifyError)
            // Don't fail the whole request
          }
        }

        // Send Surftek cancel notification if switching from external to internal
        if (notifySurftekCancel) {
          try {
            const { sendSurftekCancelNotification } = await import('@/lib/lark-notifications')

            // Get the CSM email (onboarding manager) to notify
            const trainerRecord = await conn.query(`
              SELECT CSM_Email__c FROM Onboarding_Trainer__c
              WHERE Id = '${trainerId}'
              LIMIT 1
            `)

            const csmEmail = (trainerRecord.records[0] as any)?.CSM_Email__c
            if (csmEmail) {
              await sendSurftekCancelNotification(
                csmEmail,
                notifySurftekCancel.merchantName,
                notifySurftekCancel.merchantId,
                notifySurftekCancel.surftekCaseNum
              )
              console.log('✅ Surftek cancel notification sent to:', csmEmail)
            } else {
              console.warn('⚠️ No CSM email found for Surftek cancel notification')
            }
          } catch (notifyError) {
            console.error('⚠️ Failed to send Surftek cancel notification:', notifyError)
            // Don't fail the whole request
          }
        }

        // Fetch the updated record to return current values
        const updatedRecord = await conn.query(`
          SELECT Id, Name, First_Revised_EGLD__c, Onboarding_Trainer_Stage__c, Installation_Date__c,
                 Training_Date__c, Phone_Number__c, Merchant_PIC_Contact_Number__c,
                 Shipping_Street__c, Shipping_City__c, Shipping_State__c,
                 Shipping_Zip_Postal_Code__c, Shipping_Country__c,
                 CreatedDate, LastModifiedDate
          FROM Onboarding_Trainer__c
          WHERE Id = '${trainerId}'
        `)

        const trainer = updatedRecord.records[0] as any
        const updatedData: any = {
          id: trainer.Id,
          name: trainer.Name,
          firstRevisedEGLD: trainer.First_Revised_EGLD__c,
          onboardingTrainerStage: trainer.Onboarding_Trainer_Stage__c,
          installationDate: trainer.Installation_Date__c,
          trainingDate: trainer.Training_Date__c,
          phoneNumber: trainer.Phone_Number__c,
          merchantPICContactNumber: trainer.Merchant_PIC_Contact_Number__c,
          // Shipping address fields
          shippingStreet: trainer.Shipping_Street__c,
          shippingCity: trainer.Shipping_City__c,
          shippingState: trainer.Shipping_State__c,
          shippingZipPostalCode: trainer.Shipping_Zip_Postal_Code__c,
          shippingCountry: trainer.Shipping_Country__c,
          createdDate: trainer.CreatedDate,
          lastModifiedDate: trainer.LastModifiedDate
        }

        return NextResponse.json({
          success: true,
          message: `Onboarding Trainer updated successfully! ${writableFields.length} field(s) updated.`,
          updatedData,
          salesforceResult: result,
          writableFields,
          nonWritableFields: nonWritableFields.length > 0 ? nonWritableFields : undefined,
          permissionWarning: nonWritableFields.length > 0 ?
            `Some fields couldn't be updated due to permissions: ${nonWritableFields.join(', ')}` : undefined,
          bookingCleared: clearInstallation ? 'installation' : (clearTraining ? 'training' : undefined),
          addressNotificationSent: !!notifyAddressChange
        })
      } else {
        return NextResponse.json(
          { success: false, error: 'Salesforce update failed', details: result },
          { status: 400 }
        )
      }
    } catch (updateError: any) {
      return NextResponse.json(
        { success: false, error: `Update failed: ${updateError.message}` },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('Salesforce trainer update error:', error)
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    )
  }
}
