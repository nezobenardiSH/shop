'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Calendar, Clock, Globe, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { detectServiceType, getServiceTypeMessage, shouldFilterByLocation, type ServiceType } from '@/lib/service-type-detector'
import { calculateInstallationDateLowerBound, getRegionType, getDaysToAddForRegion, MALAYSIAN_STATE_OPTIONS, getLocationCategoryFromStateName } from '@/lib/location-matcher'
import { requiresExtendedTrainingSlot, EXTENDED_TRAINING_SLOT } from '@/lib/time-slot-config'

interface DatePickerModalProps {
  isOpen: boolean
  onClose: () => void
  merchantId: string
  merchantName: string
  merchantAddress?: string
  merchantState?: string
  merchantPhone?: string
  merchantContactPerson?: string
  trainerName: string
  trainerEmail?: string  // CSM email for rescheduling (to delete from correct calendar)
  assignedTrainerEmail?: string  // CRITICAL: Email of trainer assigned to current event (for deletion during rescheduling)
  onboardingTrainerName?: string  // The Salesforce Onboarding_Trainer__c.Name field (e.g., "Nasi Lemak")
  bookingType?: string
  onboardingServicesBought?: string | null
  requiredFeatures?: string  // Required features by merchant
  onboardingSummary?: string  // Onboarding summary
  workaroundElaboration?: string  // Workaround elaboration
  currentBooking?: {
    eventId: string
    date: string
    time: string
  }
  dependentDate?: string  // Date that this booking depends on (e.g., Hardware Fulfillment date for Installation)
  goLiveDate?: string  // Expected go-live date - no dates can be scheduled after this
  installationDate?: string  // Scheduled installation date - used as lower bound for training bookings
  trainingDate?: string  // Earliest scheduled training date (POS or BackOffice) - used as upper bound for installation bookings
  isInternalUser?: boolean  // Internal team has relaxed scheduling rules
  onBookingComplete: (selectedDate?: string) => void
  onAddressUpdated?: () => void  // Callback when address is updated (to refresh parent data)

  // For region change - info about OTHER booking (to clear if region changes)
  otherBookingType?: 'installation' | 'training'
  otherBookingDate?: string
  otherBookingAssignee?: string

  // For address change notification - info about CURRENT booking (to notify assignee)
  currentBookingEventId?: string  // Event ID for calendar update
  currentBookingAssigneeEmail?: string  // Email to send notification
  currentBookingAssigneeName?: string  // Name of assigned person
}

interface TimeSlot {
  start: string
  end: string
  available: boolean
  availableTrainers?: string[]
  availableLanguages?: string[]
  // Added for "All Trainers" expanded slots
  trainerName?: string
  trainerEmail?: string
  // Added for "All Installers" expanded slots
  installerName?: string
  installerEmail?: string
  displayLabel?: string
}

interface DayAvailability {
  date: string
  slots: TimeSlot[]
}

// Month/weekday keys for translation lookup
const MONTH_KEYS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKDAY_FULL_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] // Sunday = 0
const MONTH_SHORT_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export default function DatePickerModal({
  isOpen,
  onClose,
  merchantId,
  merchantName,
  merchantAddress,
  merchantState,
  merchantPhone,
  merchantContactPerson,
  trainerName,
  trainerEmail,
  assignedTrainerEmail,
  onboardingTrainerName,
  bookingType = 'training',
  onboardingServicesBought,
  requiredFeatures,
  onboardingSummary,
  workaroundElaboration,
  currentBooking,
  dependentDate,
  goLiveDate,
  installationDate,
  trainingDate,
  isInternalUser = false,
  onBookingComplete,
  onAddressUpdated,
  // For region change - OTHER booking
  otherBookingType,
  otherBookingDate,
  otherBookingAssignee,
  // For address change notification - CURRENT booking
  currentBookingEventId,
  currentBookingAssigneeEmail,
  currentBookingAssigneeName
}: DatePickerModalProps) {
  // Debug props
  console.log('📋 DatePickerModal Props:', {
    merchantState,
    merchantStateType: typeof merchantState,
    merchantStateLength: merchantState?.length,
    merchantStateEmpty: !merchantState || merchantState.trim() === '',
    merchantAddress,
    onboardingServicesBought,
    bookingType,
    dependentDate,
    trainingDate,
    installationDate,
    goLiveDate
  })
  
  const [availability, setAvailability] = useState<DayAvailability[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [isFilteringSlots, setIsFilteringSlots] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isExternalVendor, setIsExternalVendor] = useState(false)
  const [bookingDetails, setBookingDetails] = useState<{
    assignedTrainer: string
    date: string
    startTime: string
    endTime: string
  } | null>(null)
  const [completedBookingDate, setCompletedBookingDate] = useState<string | undefined>(undefined)
  const t = useTranslations('booking')

  // Internal user manual selection states
  const [availableTrainersList, setAvailableTrainersList] = useState<Array<{ name: string; email: string; languages?: string[] }>>([])
  const [availableInstallersList, setAvailableInstallersList] = useState<Array<{ name: string; email: string }>>([])
  const [selectedTrainerEmail, setSelectedTrainerEmail] = useState<string>('')
  const [selectedInstallerEmail, setSelectedInstallerEmail] = useState<string>('')

  // Address editing state (internal users only)
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [addressFormData, setAddressFormData] = useState({
    shippingStreet: '',
    shippingCity: '',
    shippingState: '',
    shippingZipPostalCode: '',
    shippingCountry: ''
  })
  const [savedAddressDisplay, setSavedAddressDisplay] = useState<{state: string, full: string} | null>(null) // Track saved address for display
  const [originalState, setOriginalState] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [addressSuccess, setAddressSuccess] = useState('')

  // Region change confirmation dialog state
  const [showRegionChangeConfirm, setShowRegionChangeConfirm] = useState(false)
  const [pendingAddressChange, setPendingAddressChange] = useState<{
    formData: typeof addressFormData
    oldRegion: string
    newRegion: string
    affectedBookingType: string
    affectedBookingDate: string
    affectedBookingAssignee: string
    // For installer type change scenarios
    installerTypeChange?: 'internal-to-external' | 'external-to-internal'
    clearCurrentInstallation?: boolean
  } | null>(null)

  // Store original full address for notification (when editing starts)
  const [originalFullAddress, setOriginalFullAddress] = useState('')

  // Track effective merchant state (can be updated after address change)
  // This is used for installer type decisions and availability fetching
  const [effectiveMerchantState, setEffectiveMerchantState] = useState(merchantState)

  // Update effectiveMerchantState when prop changes (modal re-opens)
  useEffect(() => {
    setEffectiveMerchantState(merchantState)
  }, [merchantState])

  // Helper to detect if a state is an internal installer region
  const INTERNAL_INSTALLER_REGIONS = ['Within Klang Valley', 'Penang', 'Johor']

  const isInternalInstallerRegion = (state: string | undefined): boolean => {
    if (!state) return false
    const region = getLocationCategoryFromStateName(state)
    return INTERNAL_INSTALLER_REGIONS.includes(region)
  }

  // Log when modal opens with currentBooking data
  useEffect(() => {
    if (isOpen) {
      console.log('📅 DatePickerModal opened with:', {
        bookingType,
        currentBooking,
        isRescheduling: !!currentBooking?.eventId,
        hasEventId: !!currentBooking?.eventId,
        hasDate: !!currentBooking?.date,
        willShowBanner: !!(currentBooking?.eventId && currentBooking?.date)
      })
    }
  }, [isOpen, bookingType, currentBooking])

  // Detect service type for training bookings
  const serviceType: ServiceType = useMemo(() => {
    const isTraining = bookingType === 'training'

    if (!isTraining) {
      return 'none' // Not a training booking, service type doesn't apply
    }

    const detected = detectServiceType(onboardingServicesBought)
    console.log('🔍 Service Type Detection:', {
      bookingType,
      onboardingServicesBought,
      detectedServiceType: detected
    })
    return detected
  }, [bookingType, onboardingServicesBought])

  // Determine if location filtering should be applied
  // Internal users bypass location restrictions entirely
  const filterByLocation = useMemo(() => {
    const baseFilter = shouldFilterByLocation(serviceType, bookingType)
    // Internal users should NOT have location filtering applied
    const shouldFilter = isInternalUser ? false : baseFilter
    console.log('🔍 Location Filtering:', {
      serviceType,
      bookingType,
      merchantAddress,
      baseFilter,
      isInternalUser,
      shouldFilter
    })
    return shouldFilter
  }, [serviceType, bookingType, merchantAddress, isInternalUser])

  // Calculate available languages from the availability data
  const availableLanguages = useMemo(() => {
    const languagesSet = new Set<string>()

    // Ensure availability is an array before processing
    if (!Array.isArray(availability)) {
      console.warn('Availability is not an array:', availability)
      return []
    }

    // Collect all languages from all available slots
    availability.forEach(day => {
      day.slots.forEach(slot => {
        if (slot.available && slot.availableLanguages) {
          slot.availableLanguages.forEach(lang => languagesSet.add(lang))
        }
      })
    })

    const languages = Array.from(languagesSet)
    console.log('Available languages from trainers:', languages)
    return languages
  }, [availability])

  // Auto-select first available language when languages become available
  useEffect(() => {
    if (availableLanguages.length > 0 && selectedLanguages.length === 0 && bookingType === 'training') {
      // Auto-select English if available, otherwise first available language
      const defaultLang = availableLanguages.includes('English') ? 'English' : availableLanguages[0]
      console.log('Auto-selecting language:', defaultLang)
      setSelectedLanguages([defaultLang])
    }
  }, [availableLanguages, bookingType])

  useEffect(() => {
    if (isOpen) {
      console.log('📅 DatePickerModal opened with props:', {
        bookingType,
        installationDate,
        goLiveDate,
        dependentDate,
        trainingDate,
        merchantAddress,
        filterByLocation,
        isInternalUser
      })
      setCurrentMonth(new Date())
      setSelectedDate(null)
      setSelectedSlot(null)
      setSelectedTrainerEmail('')
      setSelectedInstallerEmail('')
      setSavedAddressDisplay(null) // Reset saved address display when modal opens

      // Fetch trainers/installers list for internal users
      if (isInternalUser) {
        fetchTrainersAndInstallersList()
        // For internal users, don't fetch availability yet
        // Wait for them to select a trainer/installer first
        if (bookingType === 'training' || bookingType === 'installation') {
          console.log('🔄 Internal user - waiting for trainer/installer selection before fetching availability')
          setAvailability([])
          return
        }
      }

      // Fetch availability (for non-internal users only)
      fetchAvailability()
    }
  }, [isOpen, trainerName, filterByLocation, merchantAddress, isInternalUser])

  // Fetch availability when internal user selects a trainer (or "all")
  useEffect(() => {
    if (isOpen && isInternalUser && bookingType === 'training' && selectedTrainerEmail) {
      console.log('🔄 Internal user selected trainer, fetching availability:', selectedTrainerEmail === 'all' ? 'ALL TRAINERS' : selectedTrainerEmail)
      fetchAvailability()
    }
  }, [selectedTrainerEmail])

  // Fetch availability when internal user selects an installer (or "all")
  useEffect(() => {
    if (isOpen && isInternalUser && bookingType === 'installation' && selectedInstallerEmail) {
      console.log('🔄 Internal user selected installer, fetching availability:', selectedInstallerEmail === 'all' ? 'ALL INSTALLERS' : selectedInstallerEmail)
      fetchAvailability()
    }
  }, [selectedInstallerEmail])

  // Fetch trainers and installers list for internal user manual selection
  const fetchTrainersAndInstallersList = async () => {
    try {
      if (bookingType === 'training') {
        const response = await fetch('/api/trainers/list')
        const data = await response.json()
        if (data.success) {
          setAvailableTrainersList(data.trainers)
          console.log('📋 Fetched trainers list for internal user:', data.trainers)
        }
      } else if (bookingType === 'installation') {
        const response = await fetch('/api/installers/list')
        const data = await response.json()
        if (data.success) {
          setAvailableInstallersList(data.installers)
          console.log('📋 Fetched installers list for internal user:', data.installers)
        }
      }
    } catch (error) {
      console.error('Error fetching trainers/installers list:', error)
    }
  }

  // Address editing handlers (internal users only)
  const handleStartEditAddress = async () => {
    // Fetch current address from Salesforce
    try {
      const response = await fetch(`/api/salesforce/merchant/${merchantId}`)
      const data = await response.json()
      if (data.success && data.onboardingTrainerData?.trainers?.[0]) {
        const trainer = data.onboardingTrainerData.trainers[0]
        setAddressFormData({
          shippingStreet: trainer.shippingStreet || '',
          shippingCity: trainer.shippingCity || '',
          shippingState: trainer.shippingState || '',
          shippingZipPostalCode: trainer.shippingZipPostalCode || '',
          shippingCountry: trainer.shippingCountry || ''
        })
        setOriginalState(trainer.shippingState || '')

        // Store original full address for notification
        const fullAddr = [
          trainer.shippingStreet,
          trainer.shippingCity,
          trainer.shippingState,
          trainer.shippingZipPostalCode,
          trainer.shippingCountry
        ].filter(Boolean).join(', ')
        setOriginalFullAddress(fullAddr)
      }
    } catch (error) {
      console.error('Error fetching address:', error)
    }
    setAddressError('')
    setAddressSuccess('')
    setIsEditingAddress(true)
  }

  const handleCancelEditAddress = () => {
    setIsEditingAddress(false)
    setAddressError('')
    setAddressSuccess('')
  }

  const handleSaveAddress = async () => {
    // Check if region changed AND other booking exists
    const oldRegion = getLocationCategoryFromStateName(originalState)
    const newRegion = getLocationCategoryFromStateName(addressFormData.shippingState)

    // Check if installer type changed (for installation bookings)
    const wasInternal = isInternalInstallerRegion(originalState)
    const nowInternal = isInternalInstallerRegion(addressFormData.shippingState)
    const installerTypeChanged = bookingType === 'installation' && wasInternal !== nowInternal

    // Determine current booking date for installation
    const currentInstallationDate = bookingType === 'installation' ? installationDate : null

    // Priority 1: Installer type change for CURRENT installation booking
    if (installerTypeChanged && currentInstallationDate && currentBookingEventId) {
      const installerTypeChange = wasInternal ? 'internal-to-external' : 'external-to-internal'
      setPendingAddressChange({
        formData: { ...addressFormData },
        oldRegion,
        newRegion,
        affectedBookingType: 'installation',
        affectedBookingDate: currentInstallationDate,
        affectedBookingAssignee: currentBookingAssigneeName || '',
        installerTypeChange,
        clearCurrentInstallation: true
      })
      setShowRegionChangeConfirm(true)
      return
    }

    // Priority 2: Region change affects OTHER booking
    if (oldRegion !== newRegion && otherBookingDate) {
      // Show confirmation dialog instead of saving immediately
      setPendingAddressChange({
        formData: { ...addressFormData },
        oldRegion,
        newRegion,
        affectedBookingType: otherBookingType || '',
        affectedBookingDate: otherBookingDate,
        affectedBookingAssignee: otherBookingAssignee || ''
      })
      setShowRegionChangeConfirm(true)
      return
    }

    // No significant change - save normally
    await saveAddressToSalesforce(addressFormData, false, false)
  }

  // Handler for confirming region change (clears other booking or current installation)
  const handleConfirmRegionChange = async () => {
    if (!pendingAddressChange) return

    if (pendingAddressChange.clearCurrentInstallation) {
      // Clear CURRENT installation booking (installer type changed)
      await saveAddressToSalesforce(
        pendingAddressChange.formData,
        false, // Don't clear other booking
        true,  // Clear current installation
        pendingAddressChange.installerTypeChange
      )
    } else {
      // Clear OTHER booking (region change affects other booking type)
      await saveAddressToSalesforce(pendingAddressChange.formData, true, false)
    }

    setShowRegionChangeConfirm(false)
    setPendingAddressChange(null)
  }

  // Actual save logic
  const saveAddressToSalesforce = async (
    formData: typeof addressFormData,
    clearOtherBooking: boolean,
    clearCurrentInstallation: boolean = false,
    installerTypeChange?: 'internal-to-external' | 'external-to-internal'
  ) => {
    setSavingAddress(true)
    setAddressError('')
    setAddressSuccess('')

    try {
      // Build the new full address
      const newFullAddress = [
        formData.shippingStreet,
        formData.shippingCity,
        formData.shippingState,
        formData.shippingZipPostalCode,
        formData.shippingCountry
      ].filter(Boolean).join(', ')

      // Build updates object
      const updates: any = { ...formData }

      // If clearing other booking, add the flag
      if (clearOtherBooking && otherBookingType) {
        if (otherBookingType === 'installation') {
          updates.clearInstallation = true
        } else {
          updates.clearTraining = true
        }
      }

      // If clearing current installation (installer type changed)
      if (clearCurrentInstallation) {
        updates.clearInstallation = true

        // If switching from external (Surftek) to internal, notify manager
        if (installerTypeChange === 'external-to-internal') {
          updates.notifySurftekCancel = {
            merchantName: merchantName,
            merchantId: merchantId
            // Note: Surftek case number would need to be passed from parent
          }
        }
      }

      // If current booking exists AND we're NOT clearing it, add notification data
      // (Only notify if keeping the booking but updating address)
      const currentBookingDate = bookingType === 'installation' ? installationDate : trainingDate
      const shouldNotifyCurrentBooking = currentBookingEventId &&
        currentBookingAssigneeEmail &&
        currentBookingDate &&
        !clearCurrentInstallation // Don't notify if we're clearing the booking

      if (shouldNotifyCurrentBooking) {
        updates.notifyAddressChange = {
          eventId: currentBookingEventId,
          assigneeEmail: currentBookingAssigneeEmail,
          assigneeName: currentBookingAssigneeName || '',
          bookingType: bookingType,
          bookingDate: currentBookingDate,
          oldAddress: originalFullAddress,
          newAddress: newFullAddress,
          merchantName: merchantName
        }
      }

      const response = await fetch('/api/salesforce/update-trainer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId: merchantId,
          updates
        })
      })
      const result = await response.json()

      if (result.success) {
        // Update effective state for UI refresh (enables installer type switch)
        setEffectiveMerchantState(formData.shippingState)

        // Check if installer type changed (only relevant for installation bookings)
        const wasInternal = isInternalInstallerRegion(originalState)
        const nowInternal = isInternalInstallerRegion(formData.shippingState)
        const installerTypeChanged = bookingType === 'installation' && wasInternal !== nowInternal

        // Build success message based on what was done
        let successMsg = 'Address updated!'
        if (clearOtherBooking) {
          const clearedType = otherBookingType === 'installation' ? 'Installation' : 'Training'
          successMsg += ` ${clearedType} booking has been cleared. Please rebook.`
        } else if (installerTypeChanged) {
          if (nowInternal) {
            successMsg += ' Switched to internal installer region. Please select a new booking.'
          } else {
            successMsg += ' Switched to external vendor region. Please select a new booking.'
          }
        } else {
          successMsg += ' Refreshing availability...'
        }
        setAddressSuccess(successMsg)
        setIsEditingAddress(false)

        // Save the new address for display (since props won't update immediately)
        setSavedAddressDisplay({
          state: formData.shippingState,
          full: newFullAddress
        })

        // Notify parent to refresh data
        if (onAddressUpdated) {
          onAddressUpdated()
        }

        // Reset selections since availability will change
        setSelectedDate(null)
        setSelectedSlot(null)
        setAvailability([])

        // Re-fetch availability with new address (this will update isExternalVendor based on API response)
        setTimeout(() => {
          fetchAvailability()
          setAddressSuccess('')
        }, 1000)
      } else {
        setAddressError(result.error || 'Failed to update address')
      }
    } catch (error) {
      setAddressError(`Error updating address: ${error}`)
    } finally {
      setSavingAddress(false)
    }
  }

  const fetchAvailability = async () => {
    console.log('🔄 fetchAvailability called with isInternalUser:', isInternalUser)

    // Check if we should block fetching for onsite training without state
    if (bookingType === 'training' && serviceType === 'onsite' && !merchantState) {
      console.warn('⚠️ Cannot fetch availability for onsite training without merchant state')
      setLoading(false)
      setAvailability([]) // Set to empty array, not empty object
      // availableLanguages is computed from availability, so it will automatically be empty
      // Don't set a message here since we already show the warning at the top
      return // Exit early but modal remains open
    }
    
    setLoading(true)
    setMessage('')
    try {
      let url: string
      let response: Response
      
      // Use different endpoints for installation vs training bookings
      if (bookingType === 'installation') {
        // For installations, use the installer availability endpoint
        // Installation bookings can be scheduled up to 30 WORKING days in advance
        // (weekends don't count toward the 30-day limit, but can still be booked by internal users)
        const today = getSingaporeNow()
        const startDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

        // Calculate end date: 30 working days from today
        let endDate = new Date(today)
        let workingDaysAdded = 0
        const startDayOfWeek = today.getDay()
        if (startDayOfWeek >= 1 && startDayOfWeek <= 5) {
          workingDaysAdded = 1 // First day counts if it's a working day
        }
        while (workingDaysAdded < 30) {
          endDate.setDate(endDate.getDate() + 1)
          const dayOfWeek = endDate.getDay()
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            workingDaysAdded++
          }
        }
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

        // Use merchantId directly (it's the Salesforce record ID)
        const installParams = new URLSearchParams({
          merchantId: merchantId,
          startDate: startDateStr,
          endDate: endDateStr
        })

        // Internal users can see weekends
        if (isInternalUser) {
          installParams.append('includeWeekends', 'true')
          console.log('🗓️ Internal user - including weekends in installation availability')

          // Handle external installer selection - skip API call and generate slots directly
          if (selectedInstallerEmail === 'external') {
            console.log('🔧 Internal user selected external installer - generating external slots')
            setIsExternalVendor(true)

            // Generate external vendor availability (weekdays 9am-6pm, 2-day advance)
            const externalAvailability = []
            const extStartDate = new Date()
            extStartDate.setDate(extStartDate.getDate() + 2) // 2 days advance booking

            for (let i = 0; i < 14; i++) {
              const currentDate = new Date(extStartDate)
              currentDate.setDate(currentDate.getDate() + i)

              // Skip weekends
              if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
                continue
              }

              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`

              externalAvailability.push({
                date: dateStr,
                slots: [
                  { start: '09:00', end: '11:00', available: true, availableTrainers: ['External Vendor'] },
                  { start: '11:00', end: '13:00', available: true, availableTrainers: ['External Vendor'] },
                  { start: '14:00', end: '16:00', available: true, availableTrainers: ['External Vendor'] },
                  { start: '16:00', end: '18:00', available: true, availableTrainers: ['External Vendor'] }
                ]
              })
            }

            console.log('🔧 External vendor availability generated:', externalAvailability.length, 'days')
            setAvailability(externalAvailability)
            setLoading(false)
            return // Skip API call
          }

          // If internal user selected a specific installer (not "all"), fetch only their availability
          if (selectedInstallerEmail && selectedInstallerEmail !== 'all') {
            const selectedInstaller = availableInstallersList.find(i => i.email === selectedInstallerEmail)
            if (selectedInstaller) {
              installParams.append('installerName', selectedInstaller.name)
              console.log('🎯 Fetching availability for selected installer:', selectedInstaller.name)
            }
          } else if (selectedInstallerEmail === 'all') {
            console.log('🎯 Fetching combined availability for ALL installers')
          }
        }

        url = `/api/installation/availability?${installParams.toString()}`
        console.log('🔧 Fetching installer availability:', {
          merchantId,
          url,
          isInternalUser,
          selectedInstaller: selectedInstallerEmail
        })
        
        response = await fetch(url)
        const data = await response.json()

        console.log('🔧 Installation availability API response:', {
          status: response.status,
          ok: response.ok,
          type: data.type,
          availabilityCount: data.availability?.length,
          rawData: data
        })

        if (response.ok) {
          if (data.type === 'internal') {
            setIsExternalVendor(false)
            // Transform installer availability to match the expected format
            const transformedAvailability = data.availability.map((day: any) => ({
              date: day.date,
              slots: day.slots.map((slot: any) => ({
                start: slot.time.start,
                end: slot.time.end,
                available: slot.isAvailable,
                availableTrainers: slot.availableInstallers || []
              }))
            }))
            console.log('🔧 Transformed availability:', transformedAvailability.length, 'days')
            console.log('🔧 First 3 days:', transformedAvailability.slice(0, 3))
            setAvailability(transformedAvailability)
          } else {
            // External vendor - set flag and generate availability
            setIsExternalVendor(true)
            // Generate availability for external vendor (weekdays 9am-6pm)
            // External vendors require 2 days advance booking (start from day after tomorrow)
            const externalAvailability = []
            const startDate = new Date()
            startDate.setDate(startDate.getDate() + 2) // Start from day after tomorrow (2 days advance)

            for (let i = 0; i < 14; i++) {
              const currentDate = new Date(startDate)
              currentDate.setDate(currentDate.getDate() + i)

              // Skip weekends (0 = Sunday, 6 = Saturday)
              if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
                continue
              }

              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`

              // Add time slots for 9am-6pm
              externalAvailability.push({
                date: dateStr,
                slots: [
                  { start: '09:00', end: '11:00', available: true, availableTrainers: ['External Vendor'] },
                  { start: '11:00', end: '13:00', available: true, availableTrainers: ['External Vendor'] },
                  { start: '14:00', end: '16:00', available: true, availableTrainers: ['External Vendor'] },
                  { start: '16:00', end: '18:00', available: true, availableTrainers: ['External Vendor'] }
                ]
              })
            }

            console.log('🔧 External vendor availability generated:', externalAvailability.length, 'days')
            console.log('🔧 First 3 days:', externalAvailability.slice(0, 3))
            setAvailability(externalAvailability)
          }
        } else {
          console.error('❌ Installation availability API error:', data)
          setMessage(data.error || 'Failed to fetch installer availability')
        }
      } else {
        // For training bookings, get combined availability from all trainers
        // Don't pass trainerName - we want all trainers' availability
        url = `/api/lark/availability`

        // Build query params
        const params = new URLSearchParams()
        // Use effectiveMerchantState for location filtering (can be updated after address change)
        const stateForFiltering = effectiveMerchantState || merchantState
        if (filterByLocation && stateForFiltering) {
          params.append('merchantState', stateForFiltering)
          console.log('🌍 Fetching availability WITH location filter:', stateForFiltering)
        } else {
          console.log('🌍 Fetching availability WITHOUT location filter')
        }

        // Internal users can see weekends
        if (isInternalUser) {
          params.append('includeWeekends', 'true')
          console.log('🗓️ Internal user - including weekends in availability')

          // If internal user selected a specific trainer (not "all"), fetch that trainer's availability
          if (selectedTrainerEmail && selectedTrainerEmail !== 'all') {
            const selectedTrainer = availableTrainersList.find(t => t.email === selectedTrainerEmail)
            if (selectedTrainer) {
              params.append('trainerName', selectedTrainer.name)
              console.log('🎯 Fetching availability for selected trainer:', selectedTrainer.name)
            }
          } else if (selectedTrainerEmail === 'all') {
            console.log('🎯 Fetching combined availability for ALL trainers')
          }
        }

        // For training bookings, start from day after installation date if set
        // This ensures we fetch availability for the valid date range
        // Internal users bypass these date restrictions
        if (bookingType === 'training' && installationDate && !isInternalUser) {
          const instDate = new Date(installationDate)
          instDate.setDate(instDate.getDate() + 1) // Day after installation
          const startDateStr = `${instDate.getFullYear()}-${String(instDate.getMonth() + 1).padStart(2, '0')}-${String(instDate.getDate()).padStart(2, '0')}`
          params.append('startDate', startDateStr)
          console.log('📅 Training availability starting from day after installation:', startDateStr)

          // Also set end date based on go-live if available
          if (goLiveDate) {
            params.append('endDate', goLiveDate)
            console.log('📅 Training availability ending at go-live:', goLiveDate)
          }
        } else if (bookingType === 'training' && isInternalUser) {
          console.log('📅 Internal user - fetching training availability without date restrictions')
        }

        if (params.toString()) {
          url += `?${params.toString()}`
        }

        console.log('📡 API URL:', url)

        response = await fetch(url)
        const data = await response.json()

        console.log('📊 Availability API Response:', {
          status: response.status,
          ok: response.ok,
          dataKeys: Object.keys(data),
          availabilityLength: data.availability?.length,
          firstSlot: data.availability?.[0],
          fullData: JSON.stringify(data).substring(0, 500)
        })

        if (response.ok) {
          const avail = data.availability || []
          setAvailability(avail)
          console.log('📅 Setting availability with', avail.length, 'days')
          if (avail.length > 0) {
            console.log('📅 First day:', avail[0].date, 'with', avail[0].slots?.length, 'slots')
            console.log('📅 Last day:', avail[avail.length - 1].date)
          }
          if (!data.availability || data.availability.length === 0) {
            setMessage('No availability data returned - check console for details')
          }
        } else {
          setMessage(data.error || 'Failed to fetch availability')
        }
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
      setMessage(`Failed to fetch availability: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleBooking = async () => {
    if (!selectedDate || !selectedSlot) return

    setBookingStatus('loading')
    try {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`

      // Log rescheduling info
      if (currentBooking?.eventId) {
        console.log('🔄 Rescheduling booking:', {
          existingEventId: currentBooking.eventId,
          oldDate: currentBooking.date,
          newDate: dateStr
        })
      }

      let response: Response

      if (bookingType === 'installation') {
        // For installations, use the installation booking endpoint
        const installationRequestBody: any = {
          merchantId: merchantId,  // Use merchantId directly - it's the Salesforce record ID
          merchantName,
          onboardingTrainerName,  // Pass the Salesforce Onboarding_Trainer__c.Name
          date: dateStr,
          timeSlot: {
            start: selectedSlot.start,
            end: selectedSlot.end,
            label: `${selectedSlot.start} - ${selectedSlot.end}`
          },
          availableInstallers: selectedSlot.availableTrainers || [],
          contactPhone: merchantPhone,
          existingEventId: currentBooking?.eventId  // Pass for rescheduling
        }

        // Internal user: pass selected installer if manually chosen
        if (isInternalUser && selectedInstallerEmail) {
          if (selectedInstallerEmail === 'external') {
            // External installer selected - signal API to use Surftek flow
            installationRequestBody.useExternalVendor = true
            console.log('🔧 Internal user selected external installer - using Surftek flow')
          } else if (selectedInstallerEmail === 'all' && selectedSlot?.installerEmail) {
            // "All Internal Installers" selected - use the installer from the selected slot
            installationRequestBody.selectedInstallerEmail = selectedSlot.installerEmail
            console.log('🔧 Internal user selected "All Internal Installers", using installer from slot:', selectedSlot.installerName, selectedSlot.installerEmail)
          } else if (selectedInstallerEmail !== 'all') {
            // Specific internal installer selected
            installationRequestBody.selectedInstallerEmail = selectedInstallerEmail
            console.log('🔧 Internal user selected specific installer:', selectedInstallerEmail)
          }
        }

        response = await fetch('/api/installation/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(installationRequestBody)
        })
      } else {
        // For training bookings, use the existing training booking endpoint
        // Build the request body without trainerName for training bookings
        // Use saved/edited address if available, otherwise fall back to original props
        const effectiveAddress = savedAddressDisplay?.full || merchantAddress
        const effectiveState = savedAddressDisplay?.state || merchantState

        console.log('📍 Address for booking:', {
          savedAddressDisplay,
          merchantAddress,
          merchantState,
          effectiveAddress,
          effectiveState,
          usingEditedAddress: !!savedAddressDisplay
        })

        const trainingRequestBody: any = {
          merchantId,
          merchantName,
          merchantAddress: effectiveAddress,
          merchantState: effectiveState,  // Include state for location detection
          merchantPhone,
          merchantContactPerson,
          onboardingTrainerName,  // Pass the Salesforce Onboarding_Trainer__c.Name
          date: dateStr,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          bookingType: bookingType,
          onboardingServicesBought,  // Pass to determine onsite vs remote
        }
        
        // Add optional fields
        if (currentBooking?.eventId) {
          trainingRequestBody.existingEventId = currentBooking.eventId
          // CRITICAL: Pass the trainer's email for deletion
          // Priority:
          // 1. assignedTrainerEmail (from Onboarding_Portal__c.Trainer_Name__c) - trainer who has the event
          // 2. trainerEmail (from Onboarding_Trainer__c.CSM_Name__c) - current CSM
          trainingRequestBody.currentTrainerEmail = assignedTrainerEmail || trainerEmail
          console.log('🔍 Rescheduling - Using trainer email for deletion:', {
            assignedTrainerEmail: assignedTrainerEmail,
            trainerEmail: trainerEmail,
            usingEmail: assignedTrainerEmail || trainerEmail,
            source: assignedTrainerEmail ? 'Portal.Trainer_Name__c' : 'Onboarding_Trainer__c.CSM_Name__c'
          })
        }

        if (bookingType === 'training') {
          trainingRequestBody.trainerLanguages = selectedLanguages
          if (requiredFeatures) trainingRequestBody.requiredFeatures = requiredFeatures
          if (onboardingSummary) trainingRequestBody.onboardingSummary = onboardingSummary
          if (workaroundElaboration) trainingRequestBody.workaroundElaboration = workaroundElaboration

          // Internal user: pass selected trainer
          if (isInternalUser && selectedTrainerEmail) {
            if (selectedTrainerEmail === 'all' && selectedSlot?.trainerEmail) {
              // "All Trainers" selected - use the trainer from the selected slot
              trainingRequestBody.selectedTrainerEmail = selectedSlot.trainerEmail
              console.log('🎓 Internal user selected "All Trainers", using trainer from slot:', selectedSlot.trainerName, selectedSlot.trainerEmail)
            } else if (selectedTrainerEmail !== 'all') {
              // Specific trainer selected
              trainingRequestBody.selectedTrainerEmail = selectedTrainerEmail
              console.log('🎓 Internal user selected specific trainer:', selectedTrainerEmail)
            }
          }
        }

        response = await fetch('/api/lark/book-training', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trainingRequestBody)
        })
      }

      const data = await response.json()

      if (response.ok) {
        setBookingStatus('success')
        setMessage('Booking confirmed successfully!')

        // Store booking details for confirmation popup
        setBookingDetails({
          assignedTrainer: data.type === 'external' ? 'External' : (data.assignedTrainer || data.assignedInstaller || trainerName),
          date: dateStr,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end
        })
        setCompletedBookingDate(dateStr) // Store the date to pass to onBookingComplete later
        setShowConfirmation(true)

        // Don't call onBookingComplete here - wait for user to click OK
        // onBookingComplete will be called in handleConfirmationClose
      } else {
        setBookingStatus('error')
        const errorMsg = data.error || data.message || 'Failed to book'
        const errorDetails = data.details ? ` - ${data.details}` : ''
        setMessage(errorMsg + errorDetails)
        console.error('Booking failed:', data)
      }
    } catch (error) {
      setBookingStatus('error')
      const errorMsg = error instanceof Error ? error.message : 'Failed to book'
      setMessage(`Booking error: ${errorMsg}`)
      console.error('Booking error:', error)
    }
  }

  const handleConfirmationClose = () => {
    setShowConfirmation(false)
    setBookingDetails(null)

    // Call onBookingComplete to refresh data and close modal
    onBookingComplete(completedBookingDate)
    setCompletedBookingDate(undefined)

    // onClose will be called by parent's handleBookingComplete
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${String(displayHour).padStart(2, '0')}:${minutes} ${ampm}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Helper function to create a date in Singapore timezone
  const createSingaporeDate = (year: number, month: number, day: number): Date => {
    // Create date string in YYYY-MM-DD format
    const monthStr = String(month + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    // Create date at midnight Singapore time (GMT+8)
    return new Date(`${year}-${monthStr}-${dayStr}T00:00:00+08:00`)
  }

  // Helper function to get current date in Singapore timezone
  const getSingaporeNow = (): Date => {
    const now = new Date()
    // Convert to Singapore timezone
    const singaporeNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Singapore"}))
    return singaporeNow
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

    const days: (Date | null)[] = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      // Create dates in Singapore timezone to match backend availability data
      days.push(createSingaporeDate(year, month, i))
    }
    while (days.length % 7 !== 0) {
      days.push(null)
    }
    return days
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1)
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1)
      }
      return newMonth
    })
  }

  const isDateAvailable = (date: Date | null) => {
    if (!date) return false

    console.log(`\n🔍 Checking date availability for: ${date.toDateString()}`)
    console.log('  -> Booking type:', bookingType)
    console.log('  -> Availability array length:', availability?.length || 0)

    // If onsite training without state, no dates are available
    if (bookingType === 'training' && serviceType === 'onsite' && !merchantState) {
      console.log('  -> ❌ BLOCKED: Onsite training requires merchant state')
      return false
    }

    // Get day of week in Singapore timezone
    // We need to check the day in Singapore time, not browser's local time
    const singaporeDay = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Singapore"})).getDay()
    console.log('Checking date:', date.toDateString(), 'Day of week (SGT):', singaporeDay, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][singaporeDay])
    console.log('  Constraints:', { bookingType, installationDate, goLiveDate })

    // Only block Saturday (6) and Sunday (0) for non-internal users
    // Internal users can schedule on weekends
    // Friday is 5, so it should NOT be blocked
    if (!isInternalUser && (singaporeDay === 0 || singaporeDay === 6)) {
      console.log('  -> Blocked (weekend in Singapore timezone)')
      return false
    }
    if (isInternalUser && (singaporeDay === 0 || singaporeDay === 6)) {
      console.log('  -> ✅ Weekend allowed for internal user')
    }

    // Calculate minimum date based on dependencies
    // Use Singapore timezone for all date calculations
    const singaporeNow = getSingaporeNow()
    const year = singaporeNow.getFullYear()
    const month = singaporeNow.getMonth()
    const day = singaporeNow.getDate()
    let minDate = createSingaporeDate(year, month, day)

    // For training bookings, the soonest they can book is day after tomorrow (D+2)
    // ALSO: Training cannot be booked if installation is not scheduled yet
    // Internal users can reschedule to tomorrow (no minimum buffer)
    if (bookingType === 'training') {
      // Check if installation is booked (required for training) - internal users bypass this
      if (!installationDate && !isInternalUser) {
        console.log('  -> ❌ BLOCKED: Training cannot be booked without installation date')
        return false // Block all dates if installation not booked
      }

      if (isInternalUser) {
        // Internal users can book from today (no minimum buffer)
        console.log('  -> Internal user training - can book from today:', minDate.toDateString())
      } else {
        const dayAfterTomorrow = new Date(minDate)
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
        minDate = dayAfterTomorrow
        console.log('  -> Training initial booking requires 2 days advance. Earliest date:', minDate.toDateString())
      }
    }

    // For installation bookings with external vendor, require 2 days advance booking
    // For internal installers, initial booking requires 2 days advance
    // For rescheduling, require 1 business day buffer (weekdays only) - UNLESS internal user
    // Internal users can book/reschedule from tomorrow
    if (bookingType === 'installation') {
      if (isInternalUser) {
        // Internal users can book/reschedule from today (no minimum buffer)
        console.log('🔄 Internal user installation - can book from today:', minDate.toDateString())
      } else if (currentBooking?.eventId) {
        // This is a rescheduling for regular users
        // Regular users require 1 business day buffer (weekdays only)
        // The buffer day itself cannot be selected, so earliest selectable is the day after the buffer
        console.log('🔄 RESCHEDULING DETECTED - Applying 1 business day buffer')
        console.log('   Current minDate:', minDate.toDateString())

        let businessDaysAdded = 0
        let bufferDate = new Date(minDate)

        // Add days until we have 1 business day buffer
        while (businessDaysAdded < 1) {
          bufferDate.setDate(bufferDate.getDate() + 1)
          const dayOfWeek = bufferDate.getDay()
          console.log('   Checking day:', bufferDate.toDateString(), 'Day of week:', dayOfWeek, 'Is weekday:', dayOfWeek >= 1 && dayOfWeek <= 5)
          // Count only weekdays (Monday=1 to Friday=5)
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            businessDaysAdded++
          }
        }

        // Move to the day after the buffer day
        bufferDate.setDate(bufferDate.getDate() + 1)
        minDate = bufferDate
        console.log('  -> Rescheduling requires 1 business day buffer. Buffer day:', new Date(bufferDate.getTime() - 24*60*60*1000).toDateString(), 'Earliest selectable date:', minDate.toDateString())
      } else if (isExternalVendor) {
        const dayAfterTomorrow = new Date(minDate)
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
        minDate = dayAfterTomorrow
        console.log('  -> External vendor installation requires 2 days advance. Earliest date:', minDate.toDateString())
      } else {
        const dayAfterTomorrow = new Date(minDate)
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
        minDate = dayAfterTomorrow
        console.log('  -> Internal installation initial booking requires 2 days advance. Earliest date:', minDate.toDateString())
      }
    }

    // For training bookings, installation date is the lower bound
    // Internal users bypass this constraint
    if (bookingType === 'training' && installationDate && !isInternalUser) {
      // Parse installation date in Singapore timezone
      const instDateParts = installationDate.split('-')
      const instDate = createSingaporeDate(
        parseInt(instDateParts[0]),
        parseInt(instDateParts[1]) - 1,
        parseInt(instDateParts[2])
      )
      // Training must be at least 1 day after installation
      const dayAfterInstallation = new Date(instDate)
      dayAfterInstallation.setDate(dayAfterInstallation.getDate() + 1)

      // Use the later of tomorrow or installation date + 1
      if (dayAfterInstallation > minDate) {
        minDate = dayAfterInstallation
      }

      console.log('  -> Training must be after installation date:', installationDate, 'Min date:', minDate.toDateString())
    } else if (bookingType === 'training' && installationDate && isInternalUser) {
      console.log('  -> ✅ Internal user - installation date lower bound constraint BYPASSED for training')
    }
    // For installation bookings, use dependent date (hardware fulfillment) if provided
    // Internal users bypass this constraint
    else if (bookingType === 'installation' && dependentDate && !isInternalUser) {
      // Use location-based calculation for installation date lower bound
      const calculatedLowerBound = calculateInstallationDateLowerBound(
        dependentDate,
        merchantAddress
      )

      if (calculatedLowerBound) {
        // Get region info for logging
        const regionType = getRegionType(merchantAddress)
        const daysToAdd = getDaysToAddForRegion(regionType)

        console.log('  -> Location-based installation scheduling:', {
          merchantAddress,
          regionType,
          daysToAdd,
          hardwareFulfillmentDate: dependentDate,
          calculatedLowerBound: calculatedLowerBound.toDateString()
        })

        // Use the later of initial minDate or calculated lower bound
        if (calculatedLowerBound > minDate) {
          minDate = calculatedLowerBound
        }

        console.log('  -> Installation must be after hardware fulfillment:', dependentDate, 'Min date:', minDate.toDateString())
      } else {
        // Fallback to old logic if calculation fails
        console.warn('  -> Failed to calculate location-based lower bound, using fallback (D+1)')
        const depDateParts = dependentDate.split('-')
        const depDate = createSingaporeDate(
          parseInt(depDateParts[0]),
          parseInt(depDateParts[1]) - 1,
          parseInt(depDateParts[2])
        )
        const dayAfterDep = new Date(depDate)
        dayAfterDep.setDate(dayAfterDep.getDate() + 1)

        if (dayAfterDep > minDate) {
          minDate = dayAfterDep
        }

        console.log('  -> Installation must be after hardware fulfillment (fallback):', dependentDate, 'Min date:', minDate.toDateString())
      }
    } else if (bookingType === 'installation' && dependentDate && isInternalUser) {
      console.log('  -> ✅ Internal user - hardware fulfillment lower bound constraint BYPASSED for installation')
    }

    // Maximum date is 30 days from the minimum eligible date
    let maxDate = new Date(minDate)
    maxDate.setDate(maxDate.getDate() + 30)

    // For installation bookings, training date is the upper bound
    // Internal users bypass this constraint
    if (bookingType === 'installation' && !isInternalUser) {
      console.log('  -> Checking training date constraint for installation:', {
        trainingDate: trainingDate,
        hasTrainingDate: !!trainingDate
      })

      if (trainingDate) {
        // Parse training date in Singapore timezone
        const trainDateParts = trainingDate.split('-')
        const trainDate = createSingaporeDate(
          parseInt(trainDateParts[0]),
          parseInt(trainDateParts[1]) - 1,
          parseInt(trainDateParts[2])
        )
        // Installation must be before training (at least 1 day before)
        const dayBeforeTraining = new Date(trainDate)
        dayBeforeTraining.setDate(dayBeforeTraining.getDate() - 1)

        console.log('  -> Training date constraint:', {
          trainingDate: trainDate.toDateString(),
          dayBeforeTraining: dayBeforeTraining.toDateString(),
          currentMaxDate: maxDate.toDateString(),
          willApplyConstraint: dayBeforeTraining < maxDate
        })

        // Use the earlier of 14-day window or training date - 1
        if (dayBeforeTraining < maxDate) {
          maxDate = dayBeforeTraining
          console.log('  -> ✅ Installation LIMITED by training date. Max date:', maxDate.toDateString())
        } else {
          console.log('  -> Training date is far enough, not limiting installation window')
        }
      } else {
        console.log('  -> ⚠️ WARNING: No training date set for installation booking. Installation can be scheduled without upper bound constraint.')
      }
    } else if (bookingType === 'installation' && isInternalUser) {
      console.log('  -> ✅ Internal user - training date upper bound constraint BYPASSED for installation')
    }

    // For training bookings, check against go-live date if provided
    // Internal users bypass this constraint
    if (bookingType === 'training' && !isInternalUser) {
      console.log('  -> Checking go-live constraint. goLiveDate value:', goLiveDate)

      if (goLiveDate) {
        // Parse go-live date in Singapore timezone
        const goLiveParts = goLiveDate.split('-')
        const goLive = createSingaporeDate(
          parseInt(goLiveParts[0]),
          parseInt(goLiveParts[1]) - 1,
          parseInt(goLiveParts[2])
        )

        // Training can be on the same date as go-live date
        // So if go-live is Nov 19, the last possible training date is Nov 19
        const lastTrainingDate = new Date(goLive)
        // No longer subtracting 1 day - training can be same day as go-live

        console.log('  -> Go-live date parsed:', goLive.toDateString())
        console.log('  -> Last allowed training date (same as go-live):', lastTrainingDate.toDateString())
        console.log('  -> Current maxDate:', maxDate.toDateString())

        // Use the earlier of 14-day window or go-live date
        if (lastTrainingDate < maxDate) {
          maxDate = lastTrainingDate
          console.log('  -> Training LIMITED by go-live date. New max:', maxDate.toDateString())
        } else {
          console.log('  -> Training NOT limited by go-live (go-live is far enough)')
        }
      } else {
        console.log('  -> No go-live date provided - no constraint applied')
      }
    } else if (bookingType === 'training' && isInternalUser) {
      console.log('  -> ✅ Internal user - go-live date constraint BYPASSED')
    }

    // Normalize the date for comparison (set to midnight)
    const normalizedDate = new Date(date)
    normalizedDate.setHours(0, 0, 0, 0)

    if (normalizedDate < minDate || normalizedDate > maxDate) {
      console.log('  -> Date out of range. Date:', normalizedDate.toDateString(), 'Min:', minDate.toDateString(), 'Max:', maxDate.toDateString())
      return false
    }

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayAvailability = availability.find(day => day.date === dateStr)
    const hasAvailableSlots = dayAvailability && dayAvailability.slots.some(slot => slot.available)

    console.log('  -> Date string:', dateStr, 'Found in availability:', !!dayAvailability, 'Has available slots:', hasAvailableSlots)
    if (dayAvailability) {
      console.log('     Slots:', dayAvailability.slots.map(s => `${s.start}-${s.end}:${s.available}`).join(', '))
    } else {
      console.log('     ❌ No availability data for this date')
    }

    console.log('  -> Final result:', hasAvailableSlots ? '✅ AVAILABLE' : '❌ NOT AVAILABLE')

    return hasAvailableSlots
  }

  const getDateSlots = (date: Date | null) => {
    if (!date) return []
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayAvailability = availability.find(day => day.date === dateStr)
    return dayAvailability?.slots || []
  }

  // Filter slots based on selected languages for training bookings
  // Also restricts to 4-6pm slot if merchant has Membership, Engage, Composite Inventory, or Superbundle
  // For internal users with "all" selected, expand slots to show individual trainers
  const filteredSlots = useMemo(() => {
    if (!selectedDate) return []

    const allSlots = getDateSlots(selectedDate)
    console.log('All slots for date:', selectedDate.toISOString().split('T')[0], allSlots)
    console.log('Selected languages:', selectedLanguages)
    console.log('Booking type:', bookingType)
    console.log('Required features:', requiredFeatures)
    console.log('Selected trainer (internal):', selectedTrainerEmail)

    // For installation bookings
    if (bookingType === 'installation') {
      const availableSlots = allSlots.filter(slot => slot.available)
      console.log('Installation booking - available slots:', availableSlots)

      // For internal users with "all installers" selected, expand slots to show individual installers
      if (isInternalUser && selectedInstallerEmail === 'all') {
        const expandedSlots: any[] = []

        availableSlots.forEach(slot => {
          // Get installers available for this slot (stored in availableTrainers from transform)
          const installersForSlot = slot.availableTrainers || []
          console.log(`Slot ${slot.start}: available installers=${installersForSlot.join(',')}`)

          if (installersForSlot.length === 0) {
            // No specific installer info, show generic slot
            expandedSlots.push(slot)
          } else {
            // Create individual slot for each installer
            installersForSlot.forEach((installerName: string) => {
              const installerInfo = availableInstallersList.find(i => i.name === installerName)
              expandedSlots.push({
                ...slot,
                installerName: installerName,
                installerEmail: installerInfo?.email,
                displayLabel: `${slot.start} - ${installerName}`
              })
            })
          }
        })

        // Sort by time, then by installer name
        expandedSlots.sort((a, b) => {
          if (a.start !== b.start) return a.start.localeCompare(b.start)
          return (a.installerName || '').localeCompare(b.installerName || '')
        })

        console.log('Expanded slots for all installers:', expandedSlots)
        return expandedSlots
      }

      return availableSlots
    }

    // Only filter for training bookings (other booking types)
    if (bookingType !== 'training') {
      const availableSlots = allSlots.filter(slot => slot.available)
      console.log('Non-training booking - available slots:', availableSlots)
      return availableSlots
    }

    // Check if merchant requires extended training slot (4-6pm only)
    // This only applies to Dec 1, 2025 onwards (new time slots)
    const cutoffDate = new Date('2025-12-01T00:00:00+08:00')
    const isAfterCutoff = selectedDate >= cutoffDate
    const needsExtendedSlot = requiresExtendedTrainingSlot(requiredFeatures) && isAfterCutoff
    console.log('Needs extended training slot (4-6pm only):', needsExtendedSlot, '| isAfterCutoff:', isAfterCutoff)

    // Filter by available and language match
    let filtered = allSlots.filter(slot => {
      if (!slot.available) return false

      // If no languages selected, show no slots
      if (selectedLanguages.length === 0) return false

      // Special merchants (Dec 2025+): only show 4pm slot
      if (needsExtendedSlot) {
        // Only keep the 4pm slot (16:00)
        if (slot.start !== '16:00') {
          console.log(`Slot ${slot.start}-${slot.end} filtered out - special merchant can only book 4pm slot`)
          return false
        }
      }

      // If slot has no language info, show it
      if (!slot.availableLanguages || slot.availableLanguages.length === 0) return true

      // Check if any selected language matches available languages
      const matches = selectedLanguages.some(lang => slot.availableLanguages?.includes(lang))
      console.log(`Slot ${slot.start}: languages=${slot.availableLanguages?.join(',')}, matches=${matches}`)
      return matches
    })

    // For special merchants (Dec 2025+), extend the 4pm slot to 6pm (instead of 5:30pm)
    if (needsExtendedSlot) {
      filtered = filtered.map(slot => {
        if (slot.start === '16:00') {
          console.log('Extending 4pm slot to 6pm for special merchant')
          return { ...slot, end: EXTENDED_TRAINING_SLOT.end }
        }
        return slot
      })
    }

    // For internal users with "all trainers" selected, expand slots to show individual trainers
    if (isInternalUser && selectedTrainerEmail === 'all' && selectedLanguages.length > 0) {
      const expandedSlots: any[] = []

      filtered.forEach(slot => {
        // Get trainers available for this slot
        const trainersForSlot = slot.availableTrainers || []

        // Filter trainers by selected language
        const trainersWithLanguage = trainersForSlot.filter((trainerName: string) => {
          const trainerInfo = availableTrainersList.find(t => t.name === trainerName)
          if (!trainerInfo || !trainerInfo.languages) return false
          return selectedLanguages.some(lang => trainerInfo.languages?.includes(lang))
        })

        console.log(`Slot ${slot.start}: trainers=${trainersForSlot.join(',')}, filtered by language=${trainersWithLanguage.join(',')}`)

        // Create individual slot for each trainer
        trainersWithLanguage.forEach((trainerName: string) => {
          const trainerInfo = availableTrainersList.find(t => t.name === trainerName)
          expandedSlots.push({
            ...slot,
            trainerName: trainerName,
            trainerEmail: trainerInfo?.email,
            displayLabel: `${slot.start} - ${trainerName}`
          })
        })
      })

      // Sort by time, then by trainer name
      expandedSlots.sort((a, b) => {
        if (a.start !== b.start) return a.start.localeCompare(b.start)
        return a.trainerName.localeCompare(b.trainerName)
      })

      console.log('Expanded slots for all trainers:', expandedSlots)
      return expandedSlots
    }

    console.log('Filtered slots:', filtered)
    return filtered
  }, [selectedDate, selectedLanguages, availability, bookingType, requiredFeatures, isInternalUser, selectedTrainerEmail, availableTrainersList, selectedInstallerEmail, availableInstallersList])

  const isSelectedDate = (date: Date | null) => {
    if (!date || !selectedDate) return false
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear()
  }

  const getBookingTypeTitle = () => {
    switch(bookingType) {
      case 'hardware-fulfillment':
        return t('hardwareFulfillmentTitle')
      case 'installation':
        return t('installationTitle')
      case 'training':
        return t('trainingTitle')
      case 'go-live':
        return t('goLiveTitle')
      default:
        return t('scheduleTitle')
    }
  }


  if (!isOpen) return null

  const days = getDaysInMonth(currentMonth)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[calc(100vh-2rem)] flex flex-col relative">
        {/* Loading Overlay - covers entire modal, blocks all interaction */}
        {bookingStatus === 'loading' && (
          <div className="absolute inset-0 bg-white bg-opacity-95 rounded-2xl flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
              <div className="text-lg font-semibold text-gray-700">{t('bookingInProgress')}</div>
              <div className="text-sm text-gray-500">{t('pleaseWait')}</div>
            </div>
          </div>
        )}

        {/* Fixed header */}
        <div className="p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">{getBookingTypeTitle()}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Success/Error Message - Fixed at top for visibility */}
        {message && (
          <div className={`mx-4 md:mx-6 mt-4 p-4 rounded-lg font-medium ${
            bookingStatus === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
            bookingStatus === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
            'bg-blue-100 text-blue-800 border border-blue-300'
          }`}>
            {message}
          </div>
        )}

        {/* Scrollable content container */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">

          {/* Combined Info Box */}
          {((bookingType === 'installation' && !isExternalVendor) || (isExternalVendor && bookingType === 'installation') || currentBooking?.eventId || (bookingType === 'training' && (installationDate || goLiveDate))) ? (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <ul className="space-y-1.5 text-sm text-blue-800">
                {/* External Vendor Message */}
                {isExternalVendor && bookingType === 'installation' && (
                  <>
                    <li className="font-medium text-blue-900">
                      • {t('externalVendorNotice')}
                    </li>
                    <li className="text-blue-700">
                      • {t('externalVendorAdvance')}
                    </li>
                  </>
                )}

                {/* Rescheduling Info */}
                {currentBooking?.eventId && currentBooking?.date && (
                  <li className="font-medium text-blue-900">
                    📅 {t('currentBookingWillCancel', { date: formatDate(currentBooking.date) })}
                  </li>
                )}

                {/* Installation Scheduling Info */}
                {bookingType === 'installation' && !isExternalVendor && !isInternalUser && (() => {
                  const regionType = getRegionType(merchantAddress)
                  const daysToAdd = getDaysToAddForRegion(regionType)

                  return (
                    <>
                      {dependentDate ? (
                        <li className="font-medium text-blue-900">
                          📍 {(() => {
                            const calculated = calculateInstallationDateLowerBound(dependentDate, merchantAddress)
                            const fromDate = calculated ? formatDate(calculated.toISOString().split('T')[0]) : t('calculating')
                            if (trainingDate) {
                              return t('availableFromTo', { fromDate, days: daysToAdd, toDate: formatDate(trainingDate) })
                            }
                            return daysToAdd > 1
                              ? t('availableFromDays', { fromDate, days: daysToAdd })
                              : t('availableFromDay', { fromDate, days: daysToAdd })
                          })()}
                        </li>
                      ) : (
                        <li className="text-amber-700">
                          ⚠️ {t('setHardwareFirst')}
                        </li>
                      )}
                    </>
                  )
                })()}
                {bookingType === 'installation' && !isExternalVendor && isInternalUser && (
                  <li className="text-green-700">• {t('internalNoRestrictions')}</li>
                )}

                {bookingType === 'training' && !isInternalUser && (
                  <>
                    {installationDate && goLiveDate && (
                      <li>• {t('trainingAfterInstallation', { installDate: formatDate(installationDate), goLiveDate: formatDate(goLiveDate) })}</li>
                    )}
                    {installationDate && !goLiveDate && (
                      <li>• {t('trainingAfterInstallationOnly', { installDate: formatDate(installationDate) })}</li>
                    )}
                    {!installationDate && goLiveDate && (
                      <li>• {t('trainingBeforeGoLive', { goLiveDate: formatDate(goLiveDate) })}</li>
                    )}
                    {!installationDate && !goLiveDate && (
                      <li>• {t('noGoLiveSet')}</li>
                    )}
                  </>
                )}
                {bookingType === 'training' && isInternalUser && (
                  <li className="text-green-700">• {t('internalNoRestrictions')}</li>
                )}

                {(dependentDate || goLiveDate || installationDate || trainingDate) && (
                  <li>• {t('dateRange14Days')}</li>
                )}
              </ul>
            </div>
          ) : null}
          
          {/* Show error when training is attempted without installation - internal users bypass this */}
          {bookingType === 'training' && !installationDate && !isInternalUser && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-base font-medium text-red-800">
                ⚠️ {t('installationFirst')}
              </div>
              <div className="text-sm text-red-700 mt-1">
                {t('installationFirstDesc')}
              </div>
            </div>
          )}

          {/* Show warning for missing service type configuration */}
          {bookingType === 'training' && serviceType === 'none' && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-base font-medium text-red-800">
                ⚠️ {t('trainingConfigIncomplete')}
              </div>
              <div className="text-sm text-red-700 mt-1">
                {t('trainingConfigIncompleteDesc')}
              </div>
            </div>
          )}
          
          {/* Show warning for missing state (only for onsite training) */}
          {bookingType === 'training' && serviceType === 'onsite' && !merchantState && !isInternalUser && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-base font-medium text-amber-800">
                ⚠️ {t('noStoreState')}
              </div>
              <div className="text-sm text-amber-700 mt-1">
                  {t('noStoreStateDesc')}
                </div>
              </div>
            )}

          {/* Internal User: Address Editing Section */}
          {isInternalUser && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-700">
                  {t('storeAddress') || 'Store Address'}
                </div>
                {!isEditingAddress && (
                  <button
                    onClick={handleStartEditAddress}
                    className="text-[#ff630f] hover:text-[#fe5b25] text-sm font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                  </button>
                )}
              </div>

              {!isEditingAddress ? (
                <div className="text-sm text-gray-600">
                  {/* Use saved address if available, otherwise fall back to props */}
                  {savedAddressDisplay ? (
                    <>
                      {savedAddressDisplay.state || 'No address set'}
                      {savedAddressDisplay.full && savedAddressDisplay.full !== savedAddressDisplay.state && (
                        <span className="text-gray-400 ml-1">({savedAddressDisplay.full})</span>
                      )}
                    </>
                  ) : (
                    <>
                      {merchantState ? `${merchantState}` : 'No address set'}
                      {merchantAddress && merchantAddress !== merchantState && (
                        <span className="text-gray-400 ml-1">({merchantAddress})</span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Street</label>
                    <input
                      type="text"
                      value={addressFormData.shippingStreet}
                      onChange={(e) => setAddressFormData({ ...addressFormData, shippingStreet: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent"
                      placeholder="Enter street address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={addressFormData.shippingCity}
                        onChange={(e) => setAddressFormData({ ...addressFormData, shippingCity: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                      <select
                        value={addressFormData.shippingState}
                        onChange={(e) => setAddressFormData({ ...addressFormData, shippingState: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent bg-white"
                      >
                        <option value="">Select state</option>
                        {MALAYSIAN_STATE_OPTIONS.map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={addressFormData.shippingZipPostalCode}
                        onChange={(e) => setAddressFormData({ ...addressFormData, shippingZipPostalCode: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent"
                        placeholder="Postal code"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                      <input
                        type="text"
                        value={addressFormData.shippingCountry}
                        onChange={(e) => setAddressFormData({ ...addressFormData, shippingCountry: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:border-transparent"
                        placeholder="Country"
                      />
                    </div>
                  </div>

                  {addressError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {addressError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAddress}
                      disabled={savingAddress}
                      className="px-3 py-1.5 bg-[#ff630f] hover:bg-[#fe5b25] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingAddress ? 'Saving...' : 'Save & Refresh'}
                    </button>
                    <button
                      onClick={handleCancelEditAddress}
                      disabled={savingAddress}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {addressSuccess && (
                <div className="mt-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                  {addressSuccess}
                </div>
              )}
            </div>
          )}

            {/* Internal User: Trainer Selection Dropdown - shown BEFORE language selection */}
            {bookingType === 'training' && isInternalUser && availableTrainersList.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('selectTrainer')}
                </label>
                <select
                  value={selectedTrainerEmail}
                  onChange={(e) => setSelectedTrainerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">{t('selectATrainer')}</option>
                  <option value="all">{t('allTrainers')}</option>
                  {availableTrainersList.map((trainer) => (
                    <option key={trainer.email} value={trainer.email}>
                      {trainer.name} {trainer.languages ? `(${trainer.languages.join(', ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Internal User: Installer Selection Dropdown */}
            {bookingType === 'installation' && isInternalUser && availableInstallersList.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('selectInstaller')}
                </label>
                <select
                  value={selectedInstallerEmail}
                  onChange={(e) => setSelectedInstallerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">{t('selectAnInstaller')}</option>
                  <optgroup label={t('internalInstallers')}>
                    <option value="all">{t('allInternalInstallers')}</option>
                    {availableInstallersList.map((installer) => (
                      <option key={installer.email} value={installer.email}>
                        {installer.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t('external')}>
                    <option value="external">{t('externalInstaller')}</option>
                  </optgroup>
                </select>
              </div>
            )}

            {bookingType === 'training' && (
              <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="inline h-4 w-4 mr-1" />
                {t('trainingLanguage')}
              </label>
              <div className={`flex gap-3 ${(bookingStatus === 'loading' || bookingStatus === 'success') || (bookingType === 'training' && ((serviceType === 'onsite' && !merchantState) || serviceType === 'none' || (!installationDate && !isInternalUser))) ? 'opacity-50 pointer-events-none' : ''}`}>
                {['Chinese', 'Bahasa Malaysia', 'English'].map((lang) => {
                  const isAvailable = availableLanguages.includes(lang)
                  const isDisabled = (serviceType === 'onsite' && !merchantState) || serviceType === 'none' || !isAvailable
                  const isSelected = selectedLanguages.length === 1 && selectedLanguages[0] === lang
                  
                  return (
                    <label
                      key={lang}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        isDisabled
                          ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-300 text-gray-400'
                          : isSelected
                            ? 'border-blue-500 bg-blue-50 cursor-pointer'
                            : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                      }`}
                      title={isDisabled ? (serviceType === 'none' ? 'Service type must be configured in Salesforce' : serviceType === 'onsite' && !merchantState ? 'Location required for language selection' : `No trainers available for ${lang} at this location`) : ''}
                    >
                      <input
                        type="radio"
                        name="trainingLanguage"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => {
                          setIsFilteringSlots(true)
                          setTimeout(() => setIsFilteringSlots(false), 300) // Brief loading state

                          console.log('Selecting language:', lang)
                          setSelectedLanguages([lang]) // Set single language
                          
                          // Deselect slot if it doesn't match the new language selection
                          if (selectedSlot && selectedSlot.availableLanguages && !selectedSlot.availableLanguages.includes(lang)) {
                            console.log('Deselecting slot - language mismatch')
                            setSelectedSlot(null)
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className={`text-sm ${isAvailable ? 'text-gray-700' : 'text-gray-400'}`}>
                        {lang}
                      </span>
                    </label>
                  )
                })}
              </div>

              {/* Service Type Label */}
              <div className="mt-3">
                {serviceType !== 'none' && (
                  <label className="block text-sm font-medium text-gray-700">
                    {(() => {
                      // Only use merchantState from Onboarding_Trainer__c.Shipping_State__c - no fallback
                      const message = serviceType === 'onsite' && merchantState
                        ? `Training: Onsite, ${merchantState}`
                        : serviceType === 'onsite'
                        ? 'Training: Onsite'
                        : getServiceTypeMessage(serviceType, merchantState)
                      console.log('🏷️ Service Type Display:', {
                        serviceType,
                        merchantState,
                        message
                      })
                      return message
                    })()}
                  </label>
                )}
                {serviceType === 'none' && (
                  <div className="text-xs text-amber-600">
                    {getServiceTypeMessage(serviceType)}
                  </div>
                )}
              </div>

              {/* Show warning if no trainers available - but NOT when state is missing or internal user hasn't selected trainer yet */}
              {availableLanguages.length === 0 && !loading && !(bookingType === 'training' && serviceType === 'onsite' && !merchantState) && !(isInternalUser && !selectedTrainerEmail) && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-sm text-amber-800 font-medium">
                    ⚠️ {t('noTrainersAtLocation')}
                  </div>
                  <div className="text-xs text-amber-700 mt-1">
                    {serviceType === 'onsite' && merchantState && !['Selangor', 'Kuala Lumpur', 'Putrajaya', 'Penang', 'Johor'].some(s => merchantState.toLowerCase().includes(s.toLowerCase()))
                      ? t('noTrainersAtLocationDesc', { state: merchantState })
                      : t('contactSupportTraining')}
                  </div>
                </div>
                )}

              </div>
            )}

          </div>

          {/* Calendar and Time Slots Section */}
          <div className="flex flex-col md:flex-row">
            {/* Calendar Section - Full width on mobile - Disabled when state is missing or service type not configured */}
            <div className={`md:flex-1 p-4 md:p-6 md:border-r border-gray-200 ${(bookingStatus === 'loading' || bookingStatus === 'success') || (bookingType === 'training' && ((serviceType === 'onsite' && !merchantState) || serviceType === 'none' || (!installationDate && !isInternalUser))) ? 'opacity-30 pointer-events-none' : ''}`}>
            {/* Desktop: Traditional calendar grid */}
            <div className="hidden md:block">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h3 className="text-lg font-semibold text-gray-900">
                  {currentMonth.getFullYear()} {t(`monthsShort.${MONTH_SHORT_KEYS[currentMonth.getMonth()]}`).toUpperCase()}
                </h3>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAY_KEYS.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {t(`weekdays.${day}`)}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => {
                const available = isDateAvailable(date)
                const selected = isSelectedDate(date)
                const today = date && new Date().toDateString() === date.toDateString()

                return (
                  <button
                    key={index}
                    onClick={() => date && available && setSelectedDate(date)}
                    disabled={!date || !available}
                    className={`
                      h-10 rounded-lg text-sm font-medium transition-all
                      ${!date ? 'invisible' : ''}
                      ${selected ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2 cursor-pointer' : ''}
                      ${!selected && available ? 'hover:bg-gray-100 text-gray-900 cursor-pointer' : ''}
                      ${!selected && !available ? 'text-gray-300 cursor-not-allowed bg-gray-50' : ''}
                      ${today && !selected && available ? 'ring-1 ring-gray-300' : ''}
                    `}
                  >
                    {date?.getDate()}
                  </button>
                )
              })}
              </div>
            </div>

            {/* Mobile: Horizontal scrollable date row */}
            <div className="block md:hidden">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('selectDate')}</h3>
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
                  {/* Show dates from eligible start to max allowed date */}
                  {(() => {
                    // Calculate minimum date based on dependencies (in Singapore timezone)
                    const singaporeNow = getSingaporeNow()
                    const year = singaporeNow.getFullYear()
                    const month = singaporeNow.getMonth()
                    const day = singaporeNow.getDate()
                    let startDate = createSingaporeDate(year, month, day)

                    if (dependentDate) {
                      const depDateParts = dependentDate.split('-')
                      const depDate = createSingaporeDate(
                        parseInt(depDateParts[0]),
                        parseInt(depDateParts[1]) - 1,
                        parseInt(depDateParts[2])
                      )
                      const dayAfterDep = new Date(depDate)
                      dayAfterDep.setDate(dayAfterDep.getDate() + 1)
                      if (dayAfterDep > startDate) {
                        startDate = dayAfterDep
                      }
                    }

                    // Calculate max date (30 days or go-live date, whichever is earlier)
                    let endDate = new Date(startDate)
                    endDate.setDate(endDate.getDate() + 30)

                    if (bookingType === 'training' && goLiveDate) {
                      const goLiveParts = goLiveDate.split('-')
                      const goLive = createSingaporeDate(
                        parseInt(goLiveParts[0]),
                        parseInt(goLiveParts[1]) - 1,
                        parseInt(goLiveParts[2])
                      )
                      // Training can be on the same date as go-live date
                      const lastTrainingDate = new Date(goLive)
                      // No longer subtracting 1 day - training can be same day as go-live

                      if (lastTrainingDate < endDate) {
                        endDate = lastTrainingDate
                      }
                    }

                    // Calculate number of days to show
                    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
                    const daysToShow = Math.max(1, Math.min(15, daysDiff))

                    return Array.from({ length: daysToShow }, (_, i) => {
                      const date = new Date(startDate)
                      date.setDate(date.getDate() + i)
                      const available = isDateAvailable(date)
                      const selected = isSelectedDate(date)
                      // Compare in Singapore timezone
                      const singaporeToday = getSingaporeNow()
                      const isToday = date.getDate() === singaporeToday.getDate() &&
                                     date.getMonth() === singaporeToday.getMonth() &&
                                     date.getFullYear() === singaporeToday.getFullYear()
                      
                      return (
                        <button
                          key={i}
                        onClick={() => available && setSelectedDate(date)}
                        disabled={!available}
                        className={`
                          flex flex-col items-center justify-center px-4 py-3 rounded-lg min-w-[70px]
                          ${selected ? 'bg-blue-600 text-white' : ''}
                          ${!selected && available ? 'bg-gray-50 hover:bg-gray-100 text-gray-900' : ''}
                          ${!selected && !available ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : ''}
                          ${isToday && !selected ? 'ring-2 ring-blue-400' : ''}
                        `}
                      >
                        <div className="text-xs font-medium">
                          {t(`weekdaysFull.${WEEKDAY_FULL_KEYS[date.getDay()]}`)}
                        </div>
                        <div className="text-lg font-bold">
                          {date.getDate()}
                        </div>
                        <div className="text-xs">
                          {t(`monthsShort.${MONTH_SHORT_KEYS[date.getMonth()]}`)}
                        </div>
                      </button>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          </div>

            {/* Time Slots Section - Full width on mobile, sidebar on desktop - Disabled when state is missing or service type not configured */}
            <div className={`w-full md:w-96 bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 ${(bookingStatus === 'loading' || bookingStatus === 'success') || (bookingType === 'training' && ((serviceType === 'onsite' && !merchantState) || serviceType === 'none' || (!installationDate && !isInternalUser))) ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="p-4 md:p-6">
            {loading || isFilteringSlots ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : selectedDate ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 md:sticky md:top-0 bg-gray-50 pb-2">{t('availableTimeSlots')}</h3>
                {/* Notice for merchants requiring extended training slot - only for Dec 2025+ */}
                {bookingType === 'training' && requiresExtendedTrainingSlot(requiredFeatures) && selectedDate && selectedDate >= new Date('2025-12-01T00:00:00+08:00') && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                    <p className="text-amber-800">
                      {t('noteFeatureSlot', { feature: requiredFeatures || '' })}
                    </p>
                  </div>
                )}
                {filteredSlots.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                    {filteredSlots.map((slot, index) => (
                      <button
                        key={`${slot.start}-${slot.trainerName || slot.installerName || index}`}
                        onClick={() => setSelectedSlot(slot)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selectedSlot === slot
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span className="font-medium text-gray-900">
                                {formatTime(slot.start)} - {formatTime(slot.end)}
                                {/* Show trainer name when "All Trainers" is selected */}
                                {slot.trainerName && (
                                  <span className="ml-2 text-blue-600">({slot.trainerName})</span>
                                )}
                                {/* Show installer name when "All Installers" is selected */}
                                {slot.installerName && (
                                  <span className="ml-2 text-blue-600">({slot.installerName})</span>
                                )}
                              </span>
                            </div>
                          </div>
                          {selectedSlot === slot && (
                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {bookingType === 'training' && selectedLanguages.length === 0
                      ? t('selectLanguageFirst')
                      : t('noSlotsForDate')}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-3" />
                  <p>{t('selectDateToViewSlots')}</p>
                </div>
              </div>
            )}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed bottom buttons */}
        <div className="p-4 md:p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3 bg-white flex-shrink-0">
          <button
            onClick={onClose}
            disabled={bookingStatus === 'loading' || bookingStatus === 'success'}
            className="w-full sm:w-auto px-6 py-2.5 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed order-2 sm:order-1"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleBooking}
            disabled={!selectedDate || !selectedSlot || bookingStatus === 'loading' || bookingStatus === 'success' || (bookingType === 'training' && ((serviceType === 'onsite' && !merchantState) || serviceType === 'none' || (!installationDate && !isInternalUser)))}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed order-1 sm:order-2"
          >
            {bookingStatus === 'loading' ? t('booking') : t('confirmBooking')}
          </button>
        </div>
      </div>

      {/* Booking Confirmation Popup */}
      {/* Region Change Confirmation Dialog */}
      {showRegionChangeConfirm && pendingAddressChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8">
            {/* Warning Icon */}
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-semibold text-lg">
                {pendingAddressChange.installerTypeChange === 'internal-to-external'
                  ? 'External Vendor Required'
                  : pendingAddressChange.installerTypeChange === 'external-to-internal'
                    ? 'Internal Installer Available'
                    : 'Region Change Warning'}
              </h3>
            </div>

            {pendingAddressChange.installerTypeChange ? (
              // Installer type change message
              <>
                <p className="text-gray-700 mb-4">
                  Changing to &quot;{pendingAddressChange.formData.shippingState}&quot;
                  {pendingAddressChange.installerTypeChange === 'internal-to-external'
                    ? ' requires an external vendor (Surftek) for installation.'
                    : ' allows booking with an internal installer.'}
                </p>

                {pendingAddressChange.affectedBookingDate && (
                  <p className="text-gray-700 mb-4">
                    Your current installation is scheduled for <strong>{formatDate(pendingAddressChange.affectedBookingDate)}</strong>
                    {pendingAddressChange.affectedBookingAssignee && (
                      <> with <strong>{pendingAddressChange.affectedBookingAssignee}</strong></>
                    )}.
                  </p>
                )}

                <p className="text-amber-600 font-medium mb-6">
                  {pendingAddressChange.installerTypeChange === 'external-to-internal'
                    ? 'This booking will be cleared. Your onboarding manager will be notified to cancel the Surftek request.'
                    : 'This booking will be cleared and you\'ll need to request installation through the external vendor process.'}
                </p>
              </>
            ) : (
              // Regular region change message
              <>
                <p className="text-gray-700 mb-4">
                  Changing to &quot;{pendingAddressChange.formData.shippingState}&quot; will move from
                  &quot;{pendingAddressChange.oldRegion}&quot; to &quot;{pendingAddressChange.newRegion}&quot;.
                </p>

                <p className="text-gray-700 mb-4">
                  <strong>{pendingAddressChange.affectedBookingType === 'installation' ? 'Installation' : 'Training'}</strong> is
                  currently scheduled for <strong>{formatDate(pendingAddressChange.affectedBookingDate)}</strong>
                  {pendingAddressChange.affectedBookingAssignee && (
                    <> with <strong>{pendingAddressChange.affectedBookingAssignee}</strong></>
                  )}.
                </p>

                <p className="text-amber-600 font-medium mb-6">
                  This booking will be cleared and you&apos;ll need to rebook.
                </p>
              </>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowRegionChangeConfirm(false); setPendingAddressChange(null) }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRegionChange}
                disabled={savingAddress}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {savingAddress ? 'Saving...' : 'Confirm & Clear Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmation && bookingDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 animate-fade-in">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
              {isExternalVendor ? t('installationRequested') : t('bookingConfirmedTitle')}
            </h3>
            <p className="text-gray-600 text-center mb-6">
              {isExternalVendor
                ? t('installationRequestedDesc')
                : bookingType === 'installation' ? t('installationScheduledDesc') : t('trainingScheduledDesc')
              }
            </p>

            {/* Booking Details */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-500">{bookingType === 'installation' ? t('installer') : t('trainer')}</div>
                  <div className="text-base font-semibold text-gray-900">{bookingDetails.assignedTrainer}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-500">{t('date')}</div>
                  <div className="text-base font-semibold text-gray-900">{formatDate(bookingDetails.date)}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-500">{t('time')}</div>
                  <div className="text-base font-semibold text-gray-900">
                    {formatTime(bookingDetails.startTime)} - {formatTime(bookingDetails.endTime)}
                  </div>
                </div>
              </div>
            </div>

            {/* OK Button */}
            <button
              onClick={handleConfirmationClose}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}