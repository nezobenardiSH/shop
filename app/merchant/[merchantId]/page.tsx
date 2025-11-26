'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DatePickerModal from '@/components/DatePickerModal'
import OnboardingTimeline from '@/components/OnboardingTimeline'
import WhatsAppButton from '@/components/WhatsAppButton'
import MerchantHeader from '@/components/MerchantHeader'
import PageHeader from '@/components/PageHeader'
import { usePageTracking } from '@/lib/useAnalytics'

// Helper function to get currency based on country
const getCurrencyInfo = (country: string) => {
  const countryUpper = (country || '').toUpperCase()
  
  // Common country to currency mapping
  const currencyMap: { [key: string]: { symbol: string, code: string } } = {
    'MALAYSIA': { symbol: 'RM', code: 'MYR' },
    'MY': { symbol: 'RM', code: 'MYR' },
    'PHILIPPINES': { symbol: '₱', code: 'PHP' },
    'PH': { symbol: '₱', code: 'PHP' },
    'SINGAPORE': { symbol: 'S$', code: 'SGD' },
    'SG': { symbol: 'S$', code: 'SGD' },
    'INDONESIA': { symbol: 'Rp', code: 'IDR' },
    'ID': { symbol: 'Rp', code: 'IDR' },
    'THAILAND': { symbol: '฿', code: 'THB' },
    'TH': { symbol: '฿', code: 'THB' },
    'VIETNAM': { symbol: '₫', code: 'VND' },
    'VN': { symbol: '₫', code: 'VND' },
    'UNITED STATES': { symbol: '$', code: 'USD' },
    'USA': { symbol: '$', code: 'USD' },
    'US': { symbol: '$', code: 'USD' },
    'CHINA': { symbol: '¥', code: 'CNY' },
    'CN': { symbol: '¥', code: 'CNY' },
    'JAPAN': { symbol: '¥', code: 'JPY' },
    'JP': { symbol: '¥', code: 'JPY' },
    'INDIA': { symbol: '₹', code: 'INR' },
    'IN': { symbol: '₹', code: 'INR' },
    'AUSTRALIA': { symbol: 'A$', code: 'AUD' },
    'AU': { symbol: 'A$', code: 'AUD' },
    'UNITED KINGDOM': { symbol: '£', code: 'GBP' },
    'UK': { symbol: '£', code: 'GBP' },
    'GB': { symbol: '£', code: 'GBP' },
  }
  
  // Check for exact match or partial match
  for (const [key, value] of Object.entries(currencyMap)) {
    if (countryUpper.includes(key) || key.includes(countryUpper)) {
      return value
    }
  }
  
  // Default to USD if country not found
  return { symbol: '$', code: 'USD' }
}

// Helper function to format currency
const formatCurrency = (amount: number | null | undefined, currencyInfo: { symbol: string, code: string }) => {
  if (amount === null || amount === undefined) return 'N/A'

  // For currencies that typically don't use decimals (like IDR, VND, JPY)
  const noDecimalCurrencies = ['IDR', 'VND', 'JPY']
  const decimals = noDecimalCurrencies.includes(currencyInfo.code) ? 0 : 2

  // Format based on currency
  if (currencyInfo.code === 'IDR' || currencyInfo.code === 'VND') {
    // For large number currencies, use different formatting
    return `${currencyInfo.symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
  } else {
    return `${currencyInfo.symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
  }
}

// Helper function to determine current stage based on onboarding data
const getCurrentStage = (trainerData: any): string => {
  if (!trainerData?.success) return 'welcome'

  // Check completion status for each stage
  const hasFirstCall = !!trainerData.firstCallTimestamp
  const hasMenuSubmission = !!trainerData.menuCollectionSubmissionTimestamp
  const hasCompletedProductSetup = trainerData.completedProductSetup === 'Yes'
  const hasVideoProof = !!trainerData.videoProofLink
  const hasHardwareDelivery = !!trainerData.hardwareFulfillmentDate
  const hasActualInstallation = !!trainerData.actualInstallationDate
  const hasPOSTraining = !!trainerData.posTrainingDate
  const hasBOTraining = !!trainerData.backOfficeTrainingDate
  const posQrCount = trainerData.posQrDeliveryCount || 0
  const isLive = posQrCount > 30

  // Determine current stage (most advanced incomplete stage)
  if (isLive) return 'go-live'
  if (hasPOSTraining || hasBOTraining) return 'go-live' // After training, focus on go-live
  if (hasActualInstallation) return 'training' // After installation, focus on training
  if (hasHardwareDelivery) return 'installation' // After hardware delivery, focus on installation

  // Check preparation completion (3 items: menu, product setup, video)
  const preparationComplete = hasMenuSubmission && hasCompletedProductSetup && hasVideoProof
  if (preparationComplete) return 'hardware' // After preparation, focus on hardware

  if (hasFirstCall) return 'preparation' // After welcome call, focus on preparation

  return 'welcome' // Default to welcome stage
}

function TrainerPortalContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const merchantId = params.merchantId as string // This is now the Salesforce ID

  const [trainerData, setTrainerData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editingTrainer, setEditingTrainer] = useState<any>(null)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [availableStages, setAvailableStages] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [editingFields, setEditingFields] = useState<{ [key: string]: boolean }>({})
  const [tempFieldValues, setTempFieldValues] = useState<{ [key: string]: string }>({})
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [currentBookingInfo, setCurrentBookingInfo] = useState<any>(null)
  const [hasProcessedUrlParam, setHasProcessedUrlParam] = useState(false)
  const [isInternalUser, setIsInternalUser] = useState(false)
  const [currentStage, setCurrentStage] = useState<string>('welcome')

  const checkUserType = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()
      if (data.success && data.user) {
        setIsInternalUser(data.user.isInternalUser || false)
      }
    } catch (error) {
      console.error('Failed to check user type:', error)
    }
  }

  const loadTrainerData = async () => {
    setLoading(true)
    setSuccessMessage('')
    try {
      // Add timestamp to force fresh data
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/salesforce/merchant/${merchantId}?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await response.json()

      // Debug: Log training and installation dates from API response
      console.log('📅 Dates from API response:', {
        installationDate: data.onboardingTrainerData?.trainers?.[0]?.installationDate,
        installationEventId: data.onboardingTrainerData?.trainers?.[0]?.installationEventId,
        posTrainingDate: data.onboardingTrainerData?.trainers?.[0]?.posTrainingDate,
        backOfficeTrainingDate: data.onboardingTrainerData?.trainers?.[0]?.backOfficeTrainingDate,
        trainingDate: data.onboardingTrainerData?.trainers?.[0]?.trainingDate,
        plannedGoLiveDate: data.onboardingTrainerData?.trainers?.[0]?.plannedGoLiveDate,
        firstRevisedEGLD: data.onboardingTrainerData?.trainers?.[0]?.firstRevisedEGLD
      })

      // Debug: Log all keys in trainer object to see what's available
      console.log('🔍 All trainer object keys:', Object.keys(data.onboardingTrainerData?.trainers?.[0] || {}))

      setTrainerData(data)

      // Update page title with merchant name
      if (data.success && data.name) {
        document.title = `${data.name} - Onboarding Portal`
      }

      // Set active tab to current stage if trainer data is loaded
      if (data.success && data.onboardingTrainerData?.trainers?.[0]?.onboardingTrainerStage) {
        setActiveTab(data.onboardingTrainerData.trainers[0].onboardingTrainerStage)
      }
    } catch (error) {
      setTrainerData({ success: false, message: `Error: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableStages = async () => {
    try {
      const response = await fetch('/api/salesforce/trainer-stages')
      const data = await response.json()
      if (data.success) {
        setAvailableStages(data.stages)
        // Set first stage as active tab if no current stage
        if (data.stages.length > 0 && !activeTab) {
          setActiveTab(data.stages[0].value)
        }
      }
    } catch (error) {
      console.error('Failed to load stages:', error)
    }
  }

  const handleEditField = (fieldName: string, currentValue: string) => {
    setEditingFields({ ...editingFields, [fieldName]: true })
    setTempFieldValues({ ...tempFieldValues, [fieldName]: currentValue || '' })
  }

  const handleSaveField = async (fieldName: string, trainerId: string) => {
    setSaving(true)
    try {
      const response = await fetch('/api/salesforce/update-trainer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId,
          updates: { [fieldName]: tempFieldValues[fieldName] }
        })
      })
      const result = await response.json()
      if (result.success) {
        setSuccessMessage(`${fieldName} updated successfully!`)
        setEditingFields({ ...editingFields, [fieldName]: false })
        await loadTrainerData()
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        alert(`Failed to update: ${result.error}`)
      }
    } catch (error) {
      alert(`Error updating: ${error}`)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelField = (fieldName: string) => {
    setEditingFields({ ...editingFields, [fieldName]: false })
    delete tempFieldValues[fieldName]
  }


  useEffect(() => {
    if (merchantId) {
      checkUserType()
      loadTrainerData()
      loadAvailableStages()
    }
  }, [merchantId])

  // Handle stage URL parameter and auto-redirect
  useEffect(() => {
    if (!trainerData?.success) return

    const urlStage = searchParams.get('stage')
    const bookingParam = searchParams.get('booking')
    const calculatedStage = getCurrentStage(trainerData)

    if (!urlStage) {
      // No stage in URL - redirect to current stage
      // Preserve booking parameter if it exists
      let redirectUrl = `/merchant/${merchantId}?stage=${calculatedStage}`
      if (bookingParam && ['training', 'installation'].includes(bookingParam)) {
        redirectUrl += `&booking=${bookingParam}`
      }
      router.replace(redirectUrl, { scroll: false })
      setCurrentStage(calculatedStage)
    } else {
      // Stage in URL - use it
      setCurrentStage(urlStage)
    }
  }, [trainerData, searchParams, merchantId, router])



  // Handle URL parameters to auto-open booking modal
  useEffect(() => {
    if (!trainerData || hasProcessedUrlParam) return // Wait for trainer data to load and only process once

    const bookingType = searchParams.get('booking')

    // Valid booking types: training, installation
    if (bookingType && ['training', 'installation'].includes(bookingType)) {
      console.log('Auto-opening booking modal from URL parameter:', bookingType)

      // Get the first trainer from the loaded data
      const trainer = trainerData?.onboardingTrainerData?.trainers?.[0]

      if (trainer) {
        // Determine which actual trainer to use - use CSM name (the assigned trainer)
        let actualTrainerName = trainer.csmName || 'Nezo' // Use CSM name, fallback to default
        console.log('🎯 Using trainer name for availability:', {
          csmName: trainer.csmName,
          operationManagerName: trainer.operationManagerContact?.name,
          selectedTrainerName: actualTrainerName
        })

        // Prioritize Salesforce shipping fields (most accurate) over order address
        // Construct full address from Salesforce shipping fields
        const merchantAddress = [
          trainer.shippingStreet,
          trainer.shippingCity,
          trainer.shippingState,
          trainer.shippingZipPostalCode,
          trainer.shippingCountry
        ].filter(Boolean).join(', ')

        // Use Salesforce shipping state for location filtering
        const merchantState = trainer.shippingCity && trainer.shippingState
          ? `${trainer.shippingCity}, ${trainer.shippingState}`
          : trainer.shippingState || trainer.shippingCity || ''

        // Get the existing event ID and date based on booking type
        let existingEventId = null
        let existingBookingDate = null

        if (bookingType === 'installation' && trainer.installationEventId) {
          existingEventId = trainer.installationEventId
          existingBookingDate = trainer.installationDate
        } else if (bookingType === 'training' && trainer.trainingEventId) {
          existingEventId = trainer.trainingEventId
          existingBookingDate = trainer.trainingDate
        }

        // If we have an existing event, prepare the booking info
        let existingBooking = null
        if (existingEventId) {
          existingBooking = {
            eventId: existingEventId,
            date: existingBookingDate || '',
            time: ''
          }
          console.log(`🔍 URL PARAM - RESCHEDULE MODE for ${bookingType}:`, {
            eventId: existingEventId,
            currentDate: existingBookingDate,
            existingBooking: existingBooking
          })
        } else {
          console.log(`📝 URL PARAM - NEW BOOKING MODE for ${bookingType}`)
        }

        // Determine dependent date based on booking type
        let dependentDate = null
        if (bookingType === 'installation') {
          // Installation depends on Hardware Fulfillment date
          dependentDate = trainer.hardwareFulfillmentDate || null
          console.log('🔍 URL PARAM - Hardware Fulfillment Date for Installation:', {
            hardwareFulfillmentDate: trainer.hardwareFulfillmentDate,
            dependentDate: dependentDate
          })
        } else if (bookingType === 'training') {
          // Training depends on Installation date
          dependentDate = trainer.installationDate || null
        }

        // Get installation date for training bookings (lower bound)
        const installationDate = trainer.installationDate || null

        // Get earliest training date for installation bookings (upper bound)
        let trainingDate = null
        if (bookingType === 'installation') {
          const posDate = trainer.posTrainingDate ? new Date(trainer.posTrainingDate) : null
          const boDate = trainer.backOfficeTrainingDate || trainer.trainingDate ? new Date(trainer.backOfficeTrainingDate || trainer.trainingDate) : null

          if (posDate && boDate) {
            trainingDate = posDate < boDate ? trainer.posTrainingDate : (trainer.backOfficeTrainingDate || trainer.trainingDate)
          } else if (posDate) {
            trainingDate = trainer.posTrainingDate
          } else if (boDate) {
            trainingDate = trainer.backOfficeTrainingDate || trainer.trainingDate
          }
        }

        // Get go-live date for training bookings
        const goLiveDate = trainer.plannedGoLiveDate ||
                          trainerData?.account?.plannedGoLiveDate ||
                          trainer.firstRevisedEGLD ||
                          null
        
        console.log('🎯 URL Param - Go-Live Date Resolution:', {
          source: 'useEffect URL param handler',
          goLiveDate,
          bookingType
        })

        // For training bookings, check if go-live date exists before proceeding
        if (bookingType === 'training' && !goLiveDate) {
          console.error('❌ URL param: Cannot open training modal without go-live date')
          alert('Unable to open training scheduler: Go-live date not found. Please ensure the go-live date is set in Salesforce.')
          setHasProcessedUrlParam(true)
          return
        }

        const bookingInfo = {
          trainerId: trainer.id,
          trainerName: actualTrainerName,
          trainerEmail: trainer.csmEmail,
          assignedTrainerEmail: trainer.assignedTrainerEmail,
          merchantName: trainerData?.account?.businessStoreName || trainerData?.account?.name || trainer.name || 'Unknown Merchant',
          merchantAddress: merchantAddress,
          merchantState: merchantState,
          merchantPhone: trainer.phoneNumber || trainer.merchantPICContactNumber || '',
          merchantContactPerson: trainer.operationManagerContact?.name || trainer.businessOwnerContact?.name || '',
          displayName: trainer.name,
          bookingType: bookingType,
          onboardingServicesBought: trainer.onboardingServicesBought,
          requiredFeatures: trainer.requiredFeaturesByMerchant, // Pass required features for training bookings
          dependentDate: dependentDate,
          goLiveDate: goLiveDate,
          installationDate: installationDate,
          trainingDate: trainingDate,
          existingBooking: existingBooking
        }

        console.log('📋 Setting booking info from URL param:', {
          merchantState: bookingInfo.merchantState,
          bookingType: bookingInfo.bookingType,
          dependentDate: bookingInfo.dependentDate,
          goLiveDate: bookingInfo.goLiveDate,
          requiredFeatures: bookingInfo.requiredFeatures
        })

        setCurrentBookingInfo(bookingInfo)
        setBookingModalOpen(true)
        setHasProcessedUrlParam(true)
      }
    }
  }, [trainerData, searchParams, hasProcessedUrlParam, router, merchantId])

  const handleOpenBookingModal = (trainer: any) => {
    console.log('🎯 Opening booking modal with trainer object:', {
      bookingType: trainer.bookingType,
      hasShippingState: !!trainer.shippingState,
      hasShippingCity: !!trainer.shippingCity,
      shippingState: trainer.shippingState,
      shippingCity: trainer.shippingCity,
      hasOrderShippingAddress: !!trainer.orderShippingAddress,
      trainerEventData: {
        trainingEventId: trainer.trainingEventId,
        trainingDate: trainer.trainingDate,
        backOfficeTrainingDate: trainer.backOfficeTrainingDate,
        posTrainingEventId: trainer.posTrainingEventId,
        posTrainingDate: trainer.posTrainingDate,
        installationEventId: trainer.installationEventId,
        installationDate: trainer.installationDate
      }
    });
    
    // Determine which actual trainer to use based on Salesforce data
    // Use CSM name (the assigned trainer from Salesforce)
    let actualTrainerName = trainer.csmName || 'Nezo'; // Use CSM name, fallback to default
    console.log('🎯 handleOpenBookingModal - Using trainer name:', {
      csmName: trainer.csmName,
      operationManagerName: trainer.operationManagerContact?.name,
      selectedTrainerName: actualTrainerName
    })
    
    // For future use: Determine which date to use based on bookingType
    // let existingDate = null;
    // if (trainer.bookingType === 'installation') {
    //   existingDate = trainer.installationDate;
    // } else if (trainer.bookingType === 'hardware-fulfillment') {
    //   existingDate = trainer.hardwareFulfillmentDate;
    // } else if (trainer.bookingType === 'go-live') {
    //   existingDate = trainer.firstRevisedEGLD;
    // } else {
    //   // Default to training
    //   existingDate = trainer.trainingDate;
    // }
    
    const bookingType = trainer.bookingType || 'training'

    // Prioritize Salesforce shipping fields (most accurate) over order address
    // Construct full address from Salesforce shipping fields
    const merchantAddress = [
      trainer.shippingStreet,
      trainer.shippingCity,
      trainer.shippingState,
      trainer.shippingZipPostalCode,
      trainer.shippingCountry
    ].filter(Boolean).join(', ')

    // Use Salesforce shipping state for location filtering
    const merchantState = trainer.shippingCity && trainer.shippingState
      ? `${trainer.shippingCity}, ${trainer.shippingState}`
      : trainer.shippingState || trainer.shippingCity || ''

    console.log('🔍 DEBUG - Setting merchantState:', {
      shippingStreet: trainer.shippingStreet,
      shippingCity: trainer.shippingCity,
      shippingState: trainer.shippingState,
      merchantAddress,
      merchantState,
      trainerKeys: Object.keys(trainer).filter(k => k.includes('shipping') || k.includes('Shipping'))
    })

    // Determine dependent date based on booking type
    let dependentDate = null
    if (bookingType === 'installation') {
      // Installation depends on Hardware Fulfillment date
      dependentDate = trainer.hardwareFulfillmentDate || null
      console.log('🔍 DEBUG - Hardware Fulfillment Date for Installation:', {
        hardwareFulfillmentDate: trainer.hardwareFulfillmentDate,
        dependentDate: dependentDate,
        trainerKeys: Object.keys(trainer).filter(k => k.toLowerCase().includes('hardware') || k.toLowerCase().includes('fulfillment'))
      })
    } else if (bookingType === 'training') {
      // Training depends on Installation date
      dependentDate = trainer.installationDate || null
    }

    // Get the go-live date - check multiple possible fields
    // Priority: Planned_Go_Live_Date__c on trainer, then account, then First_Revised_EGLD__c
    const goLiveDate = trainer.plannedGoLiveDate ||
                      trainerData?.account?.plannedGoLiveDate ||
                      trainer.firstRevisedEGLD ||
                      null

    console.log('🚨 DEBUG - Go-Live Date Resolution:', {
      bookingType,
      trainerPlannedGoLive: trainer.plannedGoLiveDate,
      accountPlannedGoLive: trainerData?.account?.plannedGoLiveDate,
      firstRevisedEGLD: trainer.firstRevisedEGLD,
      resolved: goLiveDate,
      trainerKeys: Object.keys(trainer).filter(k => k.toLowerCase().includes('live') || k.toLowerCase().includes('egld') || k.toLowerCase().includes('go')),
      trainerObject: JSON.stringify(trainer, null, 2).substring(0, 500)
    })

    // Get installation date for training bookings (lower bound)
    const installationDate = trainer.installationDate || null

    // Get training date for installation bookings (upper bound)
    let trainingDate = null
    if (bookingType === 'installation') {
      trainingDate = trainer.trainingDate || null
    }

    // Get the existing event ID and date based on booking type
    let existingEventId = null
    let existingBookingDate = null

    if (bookingType === 'installation' && trainer.installationEventId) {
      existingEventId = trainer.installationEventId
      existingBookingDate = trainer.installationDate
    } else if (bookingType === 'training' && trainer.trainingEventId) {
      existingEventId = trainer.trainingEventId
      existingBookingDate = trainer.trainingDate
    }

    // If we have an existing event, prepare the booking info
    let existingBooking = null
    if (existingEventId) {
      existingBooking = {
        eventId: existingEventId,
        date: existingBookingDate || '', // Use the actual booking date, not dependent date
        time: '' // Time will be handled by the booking modal
      }
      console.log(`🔍 RESCHEDULE MODE - Found existing event for ${bookingType}:`, {
        eventId: existingEventId,
        currentDate: existingBookingDate,
        existingBooking: existingBooking
      })
    } else {
      console.log(`📝 NEW BOOKING MODE - No existing event for ${bookingType}`)
    }

    // Log the merchant address for debugging
    console.log('🏪 Merchant booking details:', {
      bookingType: bookingType,
      merchantAddress: merchantAddress,
      merchantState: merchantState,
      orderShippingAddress: trainer.orderShippingAddress,
      trainerShippingState: trainer.shippingState,
      trainerShippingCity: trainer.shippingCity,
      merchantName: trainerData?.account?.businessStoreName || trainerData?.account?.name || trainer.name || 'Unknown Merchant'
    })

    console.log('🔍 DEBUG - trainer.requiredFeaturesByMerchant:', trainer.requiredFeaturesByMerchant);
    const bookingInfo = {
      trainerId: trainer.id,
      trainerName: actualTrainerName, // Use the actual trainer name for Lark
      trainerEmail: trainer.csmEmail, // Current CSM assigned to merchant (Onboarding_Trainer__c.CSM_Name__c)
      assignedTrainerEmail: trainer.assignedTrainerEmail, // CRITICAL: Trainer assigned to the event (Onboarding_Portal__c.Trainer_Name__c) - use for deletion during rescheduling
      merchantName: trainerData?.account?.businessStoreName || trainerData?.account?.name || trainer.name || 'Unknown Merchant',
      merchantAddress: merchantAddress,
      merchantState: merchantState,
      merchantPhone: trainer.phoneNumber || trainer.merchantPICContactNumber || '',
      merchantContactPerson: trainer.operationManagerContact?.name || trainer.businessOwnerContact?.name || '',
      displayName: trainer.name, // Keep the Salesforce trainer name for display
      bookingType: bookingType, // Pass the booking type
      onboardingServicesBought: trainer.onboardingServicesBought,
      requiredFeatures: trainer.requiredFeaturesByMerchant, // Pass required features for training bookings
      dependentDate: dependentDate, // Pass the dependent date
      goLiveDate: goLiveDate, // Pass the go-live date
      installationDate: installationDate, // Pass installation date for training bookings
      trainingDate: trainingDate, // Pass earliest training date for installation bookings
      existingBooking: existingBooking // Pass existing booking info if rescheduling
    }

    console.log('📦 About to set currentBookingInfo with existingBooking:', existingBooking)
    console.log('🔍 DEBUG - assignedTrainerEmail from trainer object:', trainer.assignedTrainerEmail)
    console.log('🔍 Modal data ready:', {
      hasGoLiveDate: !!goLiveDate,
      goLiveDate,
      bookingType,
      installationDate,
      trainingDate
    })

    // For training bookings, only open modal if go-live date exists
    if (bookingType === 'training' && !goLiveDate) {
      console.error('❌ Cannot open training modal without go-live date')
      alert('Unable to open training scheduler: Go-live date not found. Please ensure the go-live date is set in Salesforce.')
      return
    }

    // Set the booking info and open modal
    setCurrentBookingInfo(bookingInfo)
    setBookingModalOpen(true)

    // Update URL to include both stage and booking parameters
    const currentStageParam = searchParams.get('stage') || currentStage
    router.push(`/merchant/${merchantId}?stage=${currentStageParam}&booking=${bookingType}`, { scroll: false })
  }

  const handleBookingComplete = async (selectedDate?: string) => {
    console.log('Booking completed for date:', selectedDate)
    console.log('Booking type:', currentBookingInfo?.bookingType)
    setSuccessMessage('Booking confirmed! Refreshing data...')

    // Add a delay to ensure Salesforce has processed the update
    // This is especially important for installation bookings
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Refresh the trainer data to show the new training date
    console.log('Refreshing trainer data from Salesforce...')
    await loadTrainerData()

    // Clear booking modal state
    setBookingModalOpen(false)
    setCurrentBookingInfo(null)

    // Remove booking parameter from URL but keep stage
    const currentStageParam = searchParams.get('stage') || currentStage
    router.push(`/merchant/${merchantId}?stage=${currentStageParam}`, { scroll: false })

    // Show success message for a few seconds
    const bookingType = currentBookingInfo?.bookingType
    const successMsg = bookingType === 'installation'
      ? 'Installation date updated successfully!'
      : 'Training date updated successfully!'
    setSuccessMessage(successMsg)
    setTimeout(() => setSuccessMessage(''), 5000)
  }

  const handleCloseBookingModal = () => {
    setBookingModalOpen(false)
    setCurrentBookingInfo(null)

    // Remove booking parameter from URL but keep stage
    const currentStageParam = searchParams.get('stage') || currentStage
    router.push(`/merchant/${merchantId}?stage=${currentStageParam}`, { scroll: false })
  }

  const startEditing = (trainer: any) => {
    setEditingTrainer(trainer)
    setEditData(trainer)
    setSuccessMessage('')
  }

  const cancelEditing = () => {
    setEditingTrainer(null)
    setEditData({})
    setSuccessMessage('')
  }

  const saveTrainer = async () => {
    if (!editingTrainer?.id) {
      alert('No trainer selected for editing')
      return
    }

    setSaving(true)
    setSuccessMessage('')
    
    try {
      const response = await fetch('/api/salesforce/update-trainer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trainerId: editingTrainer.id,
          updates: editData
        })
      })

      const updateResult = await response.json()
      
      if (updateResult.success) {
        let message = 'Successfully updated Onboarding Trainer!'
        if (updateResult.permissionWarning) {
          message += `\n${updateResult.permissionWarning}`
        }
        if (updateResult.writableFields) {
          message += `\nUpdated fields: ${updateResult.writableFields.join(', ')}`
        }
        setSuccessMessage(message)
        
        // Update the data with new values
        if (updateResult.updatedData) {
          setTrainerData((prev: any) => ({
            ...prev,
            onboardingTrainerData: {
              ...prev.onboardingTrainerData,
              trainers: prev.onboardingTrainerData.trainers.map((trainer: any) =>
                trainer.id === editingTrainer.id ? updateResult.updatedData : trainer
              )
            }
          }))
          setEditingTrainer(null)
          setEditData({})
        }
      } else {
        alert(`Update failed: ${updateResult.error}`)
      }
    } catch (error) {
      alert(`Error updating: ${error}`)
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: string, value: string) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: value
    }))
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    try {
      return new Date(dateString).toISOString().split('T')[0]
    } catch {
      return dateString
    }
  }

  // Get merchant name from API response
  const merchantName = trainerData?.success && trainerData?.name ? trainerData.name : 'Loading...'

  // Track page view with all URL parameters
  usePageTracking(
    merchantId,
    merchantName !== 'Loading...' ? merchantName : undefined,
    (() => {
      const params = new URLSearchParams()
      if (currentStage) params.append('stage', currentStage)
      const bookingParam = searchParams.get('booking')
      if (bookingParam) params.append('booking', bookingParam)
      // Add any other parameters from the URL
      searchParams.forEach((value, key) => {
        if (key !== 'stage' && key !== 'booking') {
          params.append(key, value)
        }
      })
      const queryString = params.toString()
      return queryString ? `progress?${queryString}` : 'progress'
    })()
  )

  return (
    <div className="min-h-screen bg-[#faf9f6] py-4">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <MerchantHeader
            onRefresh={loadTrainerData}
            loading={loading}
            merchantId={merchantId}
          />
        </div>

        <PageHeader
          merchantId={merchantId}
          merchantName={merchantName}
          lastModifiedDate={trainerData?.success ? trainerData?.onboardingTrainerData?.trainers?.[0]?.lastModifiedDate : undefined}
          currentPage="progress"
          isInternalUser={isInternalUser}
        />
        
        {/* Expected Go Live Date - Highlighted at the top */}
        {trainerData?.success && trainerData?.onboardingTrainerData?.trainers?.[0] && (
          <div className="mb-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-lg p-3 sm:p-4">
            {/* Mobile Layout: Title-Value pairs */}
            <div className="block sm:hidden space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-orange-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                    <span>Expected Go Live Date</span>
                    <div className="relative group">
                      <svg
                        className="w-3.5 h-3.5 text-orange-400 cursor-help"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {/* Tooltip */}
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded py-2 px-3 z-10 normal-case">
                        Expected Go Live Date can only be changed by StoreHub Onboarding Manager
                        <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-sm font-bold text-gray-900">
                  {trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate
                    ? new Date(trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'Not Set'}
                </div>
              </div>
              {trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate && (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600">Days until go-live</div>
                  <div className={`text-lg font-bold ${(() => {
                    const today = new Date();
                    const goLive = new Date(trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate);
                    const diffTime = goLive.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isLive = (trainerData.onboardingTrainerData.trainers[0].posQrDeliveryTnxCount ?? 0) > 30;

                    // Green if Live, orange otherwise
                    return (diffDays < 0 && isLive) ? 'text-green-600' : 'text-orange-600';
                  })()}`}>
                    {(() => {
                      const today = new Date();
                      const goLive = new Date(trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate);
                      const diffTime = goLive.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      const isLive = (trainerData.onboardingTrainerData.trainers[0].posQrDeliveryTnxCount ?? 0) > 30;

                      if (diffDays > 0) return diffDays;
                      // If days < 0 and merchant is Live, show "Live"
                      if (isLive) return 'Live';
                      // If days < 0 and merchant is NOT Live, show "Overdue"
                      return 'Overdue';
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Layout: Original horizontal layout */}
            <div className="hidden sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="text-orange-600 flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                    <span>Expected Go Live Date</span>
                    <div className="relative group">
                      <svg
                        className="w-3.5 h-3.5 text-orange-400 cursor-help"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {/* Tooltip */}
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded py-2 px-3 z-10 normal-case">
                        Expected Go Live Date can only be changed by StoreHub Onboarding Manager
                        <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 truncate">
                    {trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate
                      ? new Date(trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'Not Set'}
                  </div>
                </div>
              </div>
              {trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate && (
                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-gray-600">Days until go-live</div>
                  <div className={`text-3xl font-bold ${(() => {
                    const today = new Date();
                    const goLive = new Date(trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate);
                    const diffTime = goLive.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isLive = (trainerData.onboardingTrainerData.trainers[0].posQrDeliveryTnxCount ?? 0) > 30;

                    // Green if Live, orange otherwise
                    return (diffDays < 0 && isLive) ? 'text-green-600' : 'text-orange-600';
                  })()}`}>
                    {(() => {
                      const today = new Date();
                      const goLive = new Date(trainerData.onboardingTrainerData.trainers[0].plannedGoLiveDate);
                      const diffTime = goLive.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      const isLive = (trainerData.onboardingTrainerData.trainers[0].posQrDeliveryTnxCount ?? 0) > 30;

                      if (diffDays > 0) return diffDays;
                      // If days < 0 and merchant is Live, show "Live"
                      if (isLive) return 'Live';
                      // If days < 0 and merchant is NOT Live, show "Overdue"
                      return 'Overdue';
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div>
          {successMessage && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-green-700 font-medium whitespace-pre-line">{successMessage}</div>
            </div>
          )}

          {editingTrainer && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-blue-900 font-semibold mb-3">Editing: {editingTrainer.name}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Trainer Name
                  </label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-full focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    First Revised EGLD
                  </label>
                  <input
                    type="date"
                    value={formatDate(editData.firstRevisedEGLD)}
                    onChange={(e) => handleFieldChange('firstRevisedEGLD', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-full focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Onboarding Trainer Stage
                  </label>
                  <select
                    value={editData.onboardingTrainerStage || ''}
                    onChange={(e) => handleFieldChange('onboardingTrainerStage', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-full focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent transition-all"
                  >
                    <option value="">Select a stage...</option>
                    {availableStages.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editData.phoneNumber || ''}
                    onChange={(e) => handleFieldChange('phoneNumber', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-full focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent transition-all"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Merchant PIC Contact Number
                  </label>
                  <input
                    type="tel"
                    value={editData.merchantPICContactNumber || ''}
                    onChange={(e) => handleFieldChange('merchantPICContactNumber', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-full focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent transition-all"
                    placeholder="Enter merchant PIC contact number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Installation Date
                  </label>
                  <input
                    type="date"
                    value={formatDate(editData.installationDate)}
                    onChange={(e) => handleFieldChange('installationDate', e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-full focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Training Date
                  </label>
                  <div className="flex gap-2">
                    {editData.trainingDate ? (
                      <>
                        <div className="flex-1 px-4 py-2.5 border border-[#e5e7eb] rounded-full bg-[#faf9f6]">
                          {formatDate(editData.trainingDate)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenBookingModal(editData)}
                          className="bg-[#ff630f] hover:bg-[#fe5b25] text-white font-medium rounded-full px-4 py-2 transition-all duration-200 transform hover:scale-105"
                        >
                          Reschedule
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenBookingModal(editData)}
                        className="w-full bg-[#ff630f] hover:bg-[#fe5b25] text-white font-medium rounded-full px-6 py-2.5 transition-all duration-200 transform hover:scale-105"
                      >
                        Book Training via Lark
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={saveTrainer}
                  disabled={saving}
                  className="bg-[#ff630f] hover:bg-[#fe5b25] text-white font-medium rounded-full px-6 py-2.5 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save to Salesforce'}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  className="bg-white hover:bg-gray-50 text-[#0b0707] font-medium rounded-full px-6 py-2.5 border border-[#e5e7eb] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {trainerData && !trainerData.success && (
            <div className="mt-6">
              <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
                <p className="font-medium">{trainerData.message}</p>

                {trainerData.availableTrainers && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">Debug Information:</p>
                    <p className="text-xs mt-1">Searched for: {trainerData.searchedFor}</p>
                    {trainerData.searchedVariations && (
                      <p className="text-xs">Tried variations: {trainerData.searchedVariations.join(', ')}</p>
                    )}
                    <p className="text-xs mt-2">Total trainers in system: {trainerData.totalTrainersInSystem}</p>
                    {trainerData.availableTrainers.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium">Available trainer names:</p>
                        <div className="text-xs bg-gray-100 p-2 rounded mt-1 max-h-32 overflow-y-auto">
                          {trainerData.availableTrainers.map((name: string, index: number) => (
                            <div key={index} className="font-mono">"{name}"</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Onboarding Timeline Section */}
          {trainerData && trainerData.success && trainerData.onboardingTrainerData && trainerData.onboardingTrainerData.trainers && trainerData.onboardingTrainerData.trainers[0] && (
            <div className="mt-4">
              <OnboardingTimeline
                currentStage={trainerData.onboardingTrainerData.trainers[0].onboardingTrainerStage}
                currentStageFromUrl={currentStage}
                stageData={trainerData.onboardingTrainerData.trainers[0]}
                trainerData={{
                  ...trainerData.onboardingTrainerData.trainers[0],
                  installerType: trainerData.installerType // Pass installer type from top-level response
                }}
                onBookingComplete={handleBookingComplete}
                onOpenBookingModal={handleOpenBookingModal}
                onStageChange={(stage) => setCurrentStage(stage)}
              />
            </div>
          )}


        </div>
        
        {/* Booking Modal */}
        {bookingModalOpen && currentBookingInfo && (
          <>
            {console.log('🎯 About to render DatePickerModal with:', {
              merchantState: currentBookingInfo.merchantState,
              merchantAddress: currentBookingInfo.merchantAddress,
              merchantName: currentBookingInfo.merchantName,
              dependentDate: currentBookingInfo.dependentDate,
              bookingType: currentBookingInfo.bookingType
            })}
            <DatePickerModal
              isOpen={bookingModalOpen}
              onClose={handleCloseBookingModal}
              merchantId={currentBookingInfo.trainerId || currentBookingInfo.id}
              merchantName={currentBookingInfo.merchantName || currentBookingInfo.name}
              merchantAddress={currentBookingInfo.merchantAddress}
              merchantState={currentBookingInfo.merchantState}
            merchantPhone={currentBookingInfo.merchantPhone || currentBookingInfo.phoneNumber}
            merchantContactPerson={currentBookingInfo.merchantContactPerson}
            trainerName={currentBookingInfo.trainerName}
            trainerEmail={currentBookingInfo.trainerEmail}
            assignedTrainerEmail={currentBookingInfo.assignedTrainerEmail}
            onboardingTrainerName={currentBookingInfo.displayName}
            bookingType={currentBookingInfo.bookingType}
            onboardingServicesBought={currentBookingInfo.onboardingServicesBought}
            requiredFeatures={currentBookingInfo.requiredFeatures}
            currentBooking={currentBookingInfo.existingBooking}
            dependentDate={currentBookingInfo.dependentDate}
            goLiveDate={currentBookingInfo.goLiveDate}
            installationDate={currentBookingInfo.installationDate}
            trainingDate={currentBookingInfo.trainingDate}
            onBookingComplete={handleBookingComplete}
          />
            </>
        )}

        {/* WhatsApp Floating Button */}
        <WhatsAppButton />
      </div>
    </div>
  )
}

// Wrapper component with Suspense for useSearchParams
export default function TrainerPortal() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#faf9f6] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff630f]"></div>
    </div>}>
      <TrainerPortalContent />
    </Suspense>
  )
}