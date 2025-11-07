'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Calendar, Clock, Globe } from 'lucide-react'
import { detectServiceType, getServiceTypeMessage, shouldFilterByLocation, type ServiceType } from '@/lib/service-type-detector'

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
  onBookingComplete: (selectedDate?: string) => void
}

interface TimeSlot {
  start: string
  end: string
  available: boolean
  availableTrainers?: string[]
  availableLanguages?: string[]
}

interface DayAvailability {
  date: string
  slots: TimeSlot[]
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

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
  onBookingComplete
}: DatePickerModalProps) {
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
  const filterByLocation = useMemo(() => {
    const shouldFilter = shouldFilterByLocation(serviceType, bookingType)
    console.log('🔍 Location Filtering:', {
      serviceType,
      bookingType,
      merchantAddress,
      shouldFilter
    })
    return shouldFilter
  }, [serviceType, bookingType, merchantAddress])

  // Calculate available languages from the availability data
  const availableLanguages = useMemo(() => {
    const languagesSet = new Set<string>()

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

  useEffect(() => {
    if (isOpen) {
      console.log('📅 DatePickerModal opened with props:', {
        bookingType,
        installationDate,
        goLiveDate,
        dependentDate,
        trainingDate,
        merchantAddress,
        filterByLocation
      })
      fetchAvailability()
      setCurrentMonth(new Date())
      setSelectedDate(null)
      setSelectedSlot(null)
    }
  }, [isOpen, trainerName, filterByLocation, merchantAddress])

  const fetchAvailability = async () => {
    setLoading(true)
    setMessage('')
    try {
      let url: string
      let response: Response
      
      // Use different endpoints for installation vs training bookings
      if (bookingType === 'installation') {
        // For installations, use the installer availability endpoint
        // Installation bookings can be scheduled up to 14 days in advance
        const today = new Date()
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + 14)
        
        // Use merchantId directly (it's the Salesforce record ID)
        url = `/api/installation/availability?merchantId=${encodeURIComponent(merchantId)}&startDate=${today.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
        console.log('🔧 Fetching installer availability:', {
          merchantId,
          url
        })
        
        response = await fetch(url)
        const data = await response.json()
        
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

            setAvailability(externalAvailability)
          }
        } else {
          setMessage(data.error || 'Failed to fetch installer availability')
        }
      } else {
        // For training bookings, use the existing trainer availability endpoint
        url = `/api/lark/availability?trainerName=${encodeURIComponent(trainerName)}`

        if (filterByLocation && merchantAddress) {
          url += `&merchantAddress=${encodeURIComponent(merchantAddress)}`
          console.log('🌍 Fetching availability WITH location filter:', merchantAddress)
        } else {
          console.log('🌍 Fetching availability WITHOUT location filter')
        }

        console.log('📡 API URL:', url)

        response = await fetch(url)
        const data = await response.json()
        
        if (response.ok) {
          setAvailability(data.availability || [])
          if (!data.availability || data.availability.length === 0) {
            setMessage('No availability data returned')
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
        response = await fetch('/api/installation/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
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
          })
        })
      } else {
        // For training bookings, use the existing training booking endpoint
        response = await fetch('/api/lark/book-training', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId,
            merchantName,
            merchantAddress,
            merchantPhone,
            merchantContactPerson,
            trainerName,
            onboardingTrainerName,  // Pass the Salesforce Onboarding_Trainer__c.Name
            date: dateStr,
            startTime: selectedSlot.start,
            endTime: selectedSlot.end,
            bookingType: bookingType,
            onboardingServicesBought,  // Pass to determine onsite vs remote
            existingEventId: currentBooking?.eventId,  // Pass existing event ID for rescheduling
            ...(bookingType === 'training' && {
              trainerLanguages: selectedLanguages,
              requiredFeatures: requiredFeatures,  // Pass required features for training bookings
              onboardingSummary: onboardingSummary,  // Pass onboarding summary
              workaroundElaboration: workaroundElaboration  // Pass workaround elaboration
            })
          })
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

    // Get day of week in Singapore timezone
    // We need to check the day in Singapore time, not browser's local time
    const singaporeDay = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Singapore"})).getDay()
    console.log('Checking date:', date.toDateString(), 'Day of week (SGT):', singaporeDay, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][singaporeDay])
    console.log('  Constraints:', { bookingType, installationDate, goLiveDate })

    // Only block Saturday (6) and Sunday (0)
    // Friday is 5, so it should NOT be blocked
    if (singaporeDay === 0 || singaporeDay === 6) {
      console.log('  -> Blocked (weekend in Singapore timezone)')
      return false
    }

    // Calculate minimum date based on dependencies
    // Use Singapore timezone for all date calculations
    const singaporeNow = getSingaporeNow()
    const year = singaporeNow.getFullYear()
    const month = singaporeNow.getMonth()
    const day = singaporeNow.getDate()
    let minDate = createSingaporeDate(year, month, day)

    // For training bookings, the soonest they can book is tomorrow (not today)
    if (bookingType === 'training') {
      const tomorrow = new Date(minDate)
      tomorrow.setDate(tomorrow.getDate() + 1)
      minDate = tomorrow
      console.log('  -> Training cannot be booked today. Earliest date:', minDate.toDateString())
    }

    // For installation bookings with external vendor, require 2 days advance booking
    // For internal installers, earliest is tomorrow
    // For rescheduling, require 1 business day buffer (weekdays only)
    if (bookingType === 'installation') {
      if (currentBooking?.eventId) {
        // This is a rescheduling - require 1 business day buffer (weekdays only)
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
        const tomorrow = new Date(minDate)
        tomorrow.setDate(tomorrow.getDate() + 1)
        minDate = tomorrow
        console.log('  -> Internal installation cannot be booked today. Earliest date:', minDate.toDateString())
      }
    }

    // For training bookings, installation date is the lower bound
    if (bookingType === 'training' && installationDate) {
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
    }
    // For installation bookings, use dependent date (hardware fulfillment) if provided
    else if (bookingType === 'installation' && dependentDate) {
      // Parse dependent date in Singapore timezone
      const depDateParts = dependentDate.split('-')
      const depDate = createSingaporeDate(
        parseInt(depDateParts[0]),
        parseInt(depDateParts[1]) - 1,
        parseInt(depDateParts[2])
      )
      // Add one day to dependent date (must be at least 1 day after)
      const dayAfterDep = new Date(depDate)
      dayAfterDep.setDate(dayAfterDep.getDate() + 1)

      // Use the later of tomorrow or dependent date + 1
      if (dayAfterDep > minDate) {
        minDate = dayAfterDep
      }

      console.log('  -> Installation must be after hardware fulfillment:', dependentDate, 'Min date:', minDate.toDateString())
    }

    // Maximum date is 14 days from the minimum eligible date
    let maxDate = new Date(minDate)
    maxDate.setDate(maxDate.getDate() + 14)

    // For installation bookings, training date is the upper bound
    if (bookingType === 'installation' && trainingDate) {
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

      // Use the earlier of 14-day window or training date - 1
      if (dayBeforeTraining < maxDate) {
        maxDate = dayBeforeTraining
        console.log('  -> Installation limited by training date:', trainingDate, 'Max date:', maxDate.toDateString())
      }
    }

    // For training bookings, check against go-live date if provided
    if (bookingType === 'training') {
      console.log('  -> Checking go-live constraint. goLiveDate value:', goLiveDate)
      
      if (goLiveDate) {
        // Parse go-live date in Singapore timezone
        const goLiveParts = goLiveDate.split('-')
        const goLive = createSingaporeDate(
          parseInt(goLiveParts[0]),
          parseInt(goLiveParts[1]) - 1,
          parseInt(goLiveParts[2])
        )

        // Training must be BEFORE the go-live date (at least 1 day before)
        // So if go-live is Nov 19, the last possible training date is Nov 18
        const lastTrainingDate = new Date(goLive)
        lastTrainingDate.setDate(lastTrainingDate.getDate() - 1)

        console.log('  -> Go-live date parsed:', goLive.toDateString())
        console.log('  -> Last allowed training date:', lastTrainingDate.toDateString())
        console.log('  -> Current maxDate:', maxDate.toDateString())

        // Use the earlier of 14-day window or day before go-live
        if (lastTrainingDate < maxDate) {
          maxDate = lastTrainingDate
          console.log('  -> Training LIMITED by go-live date. New max:', maxDate.toDateString())
        } else {
          console.log('  -> Training NOT limited by go-live (go-live is far enough)')
        }
      } else {
        console.log('  -> No go-live date provided - no constraint applied')
      }
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
    }

    return hasAvailableSlots
  }

  const getDateSlots = (date: Date | null) => {
    if (!date) return []
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayAvailability = availability.find(day => day.date === dateStr)
    return dayAvailability?.slots || []
  }

  // Filter slots based on selected languages for training bookings
  const filteredSlots = useMemo(() => {
    if (!selectedDate) return []
    
    const allSlots = getDateSlots(selectedDate)
    console.log('All slots for date:', selectedDate.toISOString().split('T')[0], allSlots)
    console.log('Selected languages:', selectedLanguages)
    console.log('Booking type:', bookingType)
    
    // Only filter for training bookings
    if (bookingType !== 'training') {
      const availableSlots = allSlots.filter(slot => slot.available)
      console.log('Non-training booking - available slots:', availableSlots)
      return availableSlots
    }
    
    // Filter by available and language match
    const filtered = allSlots.filter(slot => {
      if (!slot.available) return false
      
      // If no languages selected, show no slots
      if (selectedLanguages.length === 0) return false
      
      // If slot has no language info, show it
      if (!slot.availableLanguages || slot.availableLanguages.length === 0) return true
      
      // Check if any selected language matches available languages
      const matches = selectedLanguages.some(lang => slot.availableLanguages?.includes(lang))
      console.log(`Slot ${slot.start}: languages=${slot.availableLanguages?.join(',')}, matches=${matches}`)
      return matches
    })
    
    console.log('Filtered slots:', filtered)
    return filtered
  }, [selectedDate, selectedLanguages, availability, bookingType])

  const isSelectedDate = (date: Date | null) => {
    if (!date || !selectedDate) return false
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear()
  }

  const getBookingTypeTitle = () => {
    switch(bookingType) {
      case 'hardware-fulfillment':
        return 'Schedule Hardware Fulfillment'
      case 'installation':
        return 'Schedule Installation'
      case 'training':
        return 'Schedule Training'
      case 'go-live':
        return 'Schedule Go-Live'
      default:
        return 'Schedule Appointment'
    }
  }


  if (!isOpen) return null

  const days = getDaysInMonth(currentMonth)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[calc(100vh-2rem)] flex flex-col">
        <div className="p-4 md:p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">{getBookingTypeTitle()}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Combined Info Box */}
          {(isExternalVendor && bookingType === 'installation') || currentBooking?.eventId || dependentDate || goLiveDate || installationDate || trainingDate ? (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <ul className="space-y-1.5 text-sm text-blue-800">
                {/* External Vendor Message */}
                {isExternalVendor && bookingType === 'installation' && (
                  <>
                    <li className="font-medium text-blue-900">
                      • Choose preferred date and vendor will call to finalise
                    </li>
                    <li className="text-blue-700">
                      • External vendor requires 2 days advance booking (earliest: day after tomorrow)
                    </li>
                  </>
                )}

                {/* Rescheduling Info */}
                {currentBooking?.eventId && currentBooking?.date && (
                  <>
                    <li className="font-semibold text-blue-900">
                      • Rescheduling Existing Booking
                    </li>
                    <li className="ml-4">
                      Current Date: <span className="font-medium">{formatDate(currentBooking.date)}</span>
                    </li>
                    <li className="ml-4 text-xs text-blue-700">
                      Select a new date below. The old booking will be automatically cancelled.
                    </li>
                  </>
                )}

                {/* Dependency Message */}
                {bookingType === 'installation' && (
                  <>
                    {dependentDate && trainingDate && (
                      <li>• Installation must be scheduled after Hardware Fulfillment date ({formatDate(dependentDate)}) and before Training date ({formatDate(trainingDate)})</li>
                    )}
                    {dependentDate && !trainingDate && (
                      <li>• Installation must be scheduled after Hardware Fulfillment date ({formatDate(dependentDate)})</li>
                    )}
                    {!dependentDate && trainingDate && (
                      <li>• Installation must be scheduled before Training date ({formatDate(trainingDate)})</li>
                    )}
                  </>
                )}
                {bookingType === 'training' && (
                  <>
                    {installationDate && goLiveDate && (
                      <li>• Training must be scheduled after Installation date ({formatDate(installationDate)}) and before Go-Live date ({formatDate(goLiveDate)})</li>
                    )}
                    {installationDate && !goLiveDate && (
                      <li>• Training must be scheduled after Installation date ({formatDate(installationDate)})</li>
                    )}
                    {!installationDate && goLiveDate && (
                      <li>• Training must be scheduled before Go-Live date ({formatDate(goLiveDate)})</li>
                    )}
                    {!installationDate && !goLiveDate && (
                      <li>• No go-live date set - please check with your onboarding manager</li>
                    )}
                  </>
                )}

                {(dependentDate || goLiveDate || installationDate || trainingDate) && (
                  <li>• You can select dates up to 14 days from the earliest eligible date</li>
                )}
              </ul>
            </div>
          ) : null}
          {bookingType === 'training' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="inline h-4 w-4 mr-1" />
                Training Language (Select all that apply)
              </label>
              <div className="flex gap-3">
                {['Chinese', 'Bahasa Malaysia', 'English'].map((lang) => {
                  const isAvailable = availableLanguages.includes(lang)
                  return (
                    <label
                      key={lang}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        !isAvailable
                          ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-300 text-gray-400'
                          : selectedLanguages.includes(lang)
                            ? 'border-blue-500 bg-blue-50 cursor-pointer'
                            : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                      }`}
                      title={!isAvailable ? `No trainers available for ${lang} at this location` : ''}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLanguages.includes(lang)}
                        disabled={!isAvailable}
                        onChange={(e) => {
                          setIsFilteringSlots(true)
                          setTimeout(() => setIsFilteringSlots(false), 300) // Brief loading state

                          if (e.target.checked) {
                            const newLanguages = [...selectedLanguages, lang]
                            console.log('Adding language:', lang, 'New languages:', newLanguages)
                            setSelectedLanguages(newLanguages)
                          } else {
                            const newLanguages = selectedLanguages.filter(l => l !== lang)
                            console.log('Removing language:', lang, 'New languages:', newLanguages)
                            setSelectedLanguages(newLanguages)
                            // Deselect slot if it doesn't match the new language selection
                            if (selectedSlot && selectedSlot.availableLanguages) {
                              const hasMatchingLanguage = newLanguages.some(l =>
                                selectedSlot.availableLanguages?.includes(l)
                              )
                              if (!hasMatchingLanguage) {
                                setSelectedSlot(null)
                              }
                            }
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {getServiceTypeMessage(serviceType, merchantState)}
                  </label>
                )}
                {serviceType === 'none' && (
                  <div className="text-xs text-amber-600">
                    {getServiceTypeMessage(serviceType)}
                  </div>
                )}

                {/* Show warning if no trainers available */}
                {availableLanguages.length === 0 && !loading && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="text-sm text-amber-800 font-medium">
                      ⚠️ No trainers available for this location
                    </div>
                    <div className="text-xs text-amber-700 mt-1">
                      Please contact support for assistance with scheduling training.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile: Vertical layout, Desktop: Horizontal layout */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Calendar Section - Full width on mobile */}
          <div className="flex-1 p-4 md:p-6 md:border-r border-gray-200 overflow-y-auto">
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
                  {currentMonth.getFullYear()} {MONTHS[currentMonth.getMonth()].slice(0, 3).toUpperCase()}
                </h3>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
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
                      ${selected ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2' : ''}
                      ${!selected && available ? 'hover:bg-gray-100 text-gray-900' : ''}
                      ${!selected && !available ? 'text-gray-300 cursor-not-allowed' : ''}
                      ${today && !selected ? 'ring-1 ring-gray-300' : ''}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Date</h3>
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

                    // Calculate max date (14 days or go-live date, whichever is earlier)
                    let endDate = new Date(startDate)
                    endDate.setDate(endDate.getDate() + 14)

                    if (bookingType === 'training' && goLiveDate) {
                      const goLiveParts = goLiveDate.split('-')
                      const goLive = createSingaporeDate(
                        parseInt(goLiveParts[0]),
                        parseInt(goLiveParts[1]) - 1,
                        parseInt(goLiveParts[2])
                      )
                      // Training must be BEFORE go-live date (at least 1 day before)
                      const lastTrainingDate = new Date(goLive)
                      lastTrainingDate.setDate(lastTrainingDate.getDate() - 1)
                      
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
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-lg font-bold">
                          {date.getDate()}
                        </div>
                        <div className="text-xs">
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </button>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Time Slots Section - Full width on mobile, sidebar on desktop */}
          <div className="w-full md:w-96 bg-gray-50 flex flex-col border-t md:border-t-0 md:border-l border-gray-200">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
            {loading || isFilteringSlots ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : selectedDate ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 sticky top-0 bg-gray-50 pb-2">Available Time Slots</h3>
                {filteredSlots.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                    {filteredSlots.map((slot, index) => (
                      <button
                        key={index}
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
                              </span>
                            </div>
                            {bookingType === 'training' && slot.availableLanguages && slot.availableLanguages.length > 0 && (
                              <div className="flex items-center gap-2 mt-2">
                                <Globe className="h-3 w-3 text-gray-400" />
                                <div className="flex flex-wrap gap-1">
                                  {slot.availableLanguages.map((lang) => (
                                    <span 
                                      key={lang} 
                                      className={`px-2 py-0.5 text-xs rounded font-medium ${
                                        selectedLanguages.includes(lang)
                                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {lang}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
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
                      ? 'Please select at least one language'
                      : 'No available slots for this date'}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-3" />
                  <p>Select a date to view available slots</p>
                </div>
              </div>
            )}

            {message && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${
                bookingStatus === 'success' ? 'bg-green-100 text-green-700' : 
                bookingStatus === 'error' ? 'bg-red-100 text-red-700' : 
                'bg-blue-100 text-blue-700'
              }`}>
                {message}
              </div>
            )}
            </div>
            
            {/* Fixed bottom buttons */}
            <div className="p-4 md:p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3 bg-white">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={handleBooking}
                disabled={!selectedDate || !selectedSlot || bookingStatus === 'loading'}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed order-1 sm:order-2"
              >
                {bookingStatus === 'loading' ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Confirmation Popup */}
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
              Booking Confirmed!
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Your training session has been successfully scheduled
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
                  <div className="text-sm text-gray-500">{bookingType === 'installation' ? 'Installer' : 'Trainer'}</div>
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
                  <div className="text-sm text-gray-500">Date</div>
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
                  <div className="text-sm text-gray-500">Time</div>
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
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}