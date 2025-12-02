'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { detectServiceType, getServiceTypeMessage } from '@/lib/service-type-detector'
import ImportantReminderBox from '@/components/ImportantReminderBox'
import { useEventTracking } from '@/lib/useAnalytics'

interface TimelineStage {
  id: string
  label: string
  status: 'completed' | 'current' | 'pending'
  completedDate?: string
  completedCount?: number
  totalCount?: number
}

interface OnboardingTimelineProps {
  currentStage?: string
  currentStageFromUrl?: string
  stageData?: any
  trainerData?: any
  onBookingComplete?: (selectedDate?: string) => void
  onOpenBookingModal?: (bookingInfo: any) => void
  onStageChange?: (stage: string) => void
  expandSection?: string // Auto-expand a specific section (e.g., 'product-setup', 'store-setup')
}

// Helper function to format date with time
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Not Set'

  const date = new Date(dateString)
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

// Helper function to format date only (dd mmm yyyy)
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Not Set'

  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

// Helper function to check if rescheduling is allowed
// Returns true if rescheduling is NOT allowed (less than 1 business day buffer)
// Requires at least 1 business day (weekdays only) between today and scheduled date
const isWithinNextDay = (dateString: string | null | undefined): boolean => {
  if (!dateString) return false

  const eventDate = new Date(dateString)
  const now = new Date()

  // Set time to start of day for both dates for accurate comparison
  const eventDateStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Count business days (Monday-Friday) between now and event date
  let businessDaysRemaining = 0
  let currentDate = new Date(nowStart)

  // Loop through each day until we reach the event date
  while (currentDate < eventDateStart) {
    currentDate.setDate(currentDate.getDate() + 1)
    const dayOfWeek = currentDate.getDay()

    // Count only weekdays (Monday=1 to Friday=5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      businessDaysRemaining++
    }
  }

  // Return true if there is 1 or less business days remaining
  // This means rescheduling is NOT allowed (need at least 1 business day buffer)
  // D-1 or same day bookings cannot be rescheduled
  return businessDaysRemaining <= 1
}

// Helper function to get industry-specific terminology
const getIndustryTerminology = (subIndustry: string | null | undefined) => {
  const industry = (subIndustry || '').toLowerCase()

  if (industry.includes('f&b') || industry.includes('fnb') || industry.includes('food') || industry.includes('beverage') || industry.includes('restaurant') || industry.includes('cafe') || industry.includes('café')) {
    return {
      setupLabel: 'Menu Setup',
      collectionForm: 'menu collection form',
      collectionFormLabel: 'Menu Collection Form',
      collectionName: 'menu',
      submissionTimestamp: 'menu collection submission timestamp',
      submissionTimestampLabel: 'Menu Collection Submission Timestamp',
      completedSetup: 'completed menu setup',
      completedSetupLabel: 'Completed Menu Setup',
      pendingStatus: 'Pending Menu',
      submittedStatus: 'Menu Submitted',
      submitButtonText: 'Submit Menu Collection Form',
      tooltipText: 'Product setup would be done by StoreHub and will be completed within 3 working days after product or menu submission'
    }
  } else if (industry.includes('retail')) {
    return {
      setupLabel: 'Product Setup',
      collectionForm: 'product collection form',
      collectionFormLabel: 'Product Collection Form',
      collectionName: 'product list',
      submissionTimestamp: 'product collection submission timestamp',
      submissionTimestampLabel: 'Product Collection Submission Timestamp',
      completedSetup: 'completed product setup',
      completedSetupLabel: 'Completed Product Setup',
      pendingStatus: 'Pending Product',
      submittedStatus: 'Product Submitted',
      submitButtonText: 'Submit Product Collection Form',
      tooltipText: 'Product setup would be done by StoreHub and will be completed within 3 working days after product or menu submission'
    }
  } else {
    // Default to Product Setup for unknown industries
    return {
      setupLabel: 'Product Setup',
      collectionForm: 'product collection form',
      collectionFormLabel: 'Product Collection Form',
      collectionName: 'product list',
      submissionTimestamp: 'product collection submission timestamp',
      submissionTimestampLabel: 'Product Collection Submission Timestamp',
      completedSetup: 'completed product setup',
      completedSetupLabel: 'Completed Product Setup',
      pendingStatus: 'Pending Product',
      submittedStatus: 'Product Submitted',
      submitButtonText: 'Submit Product Collection Form',
      tooltipText: 'Product setup would be done by StoreHub and will be completed within 3 working days after product or menu submission'
    }
  }
}

export default function OnboardingTimeline({ currentStage, currentStageFromUrl, stageData, trainerData, onBookingComplete, onOpenBookingModal, onStageChange, expandSection }: OnboardingTimelineProps) {
  const router = useRouter()
  const params = useParams()
  const merchantId = params.merchantId as string
  const [stages, setStages] = useState<TimelineStage[]>([])
  const { trackEvent } = useEventTracking()

  // Get industry-specific terminology
  const terminology = getIndustryTerminology(trainerData?.subIndustry)

  // Track when user clicks the product setup form link
  const handleProductSetupClick = () => {
    if (merchantId && trainerData?.trainerName) {
      trackEvent(
        merchantId,
        trainerData.trainerName,
        'product-setup',
        'form_link_clicked',
        { formLink: trainerData.menuCollectionFormLink }
      )
    }
  }

  // Handle stage click - update URL and scroll to section
  const handleStageClick = (stageId: string) => {
    // Update URL with stage parameter
    router.push(`/merchant/${merchantId}?stage=${stageId}`, { scroll: false })

    // Scroll to stage section
    setTimeout(() => {
      const element = document.getElementById(`stage-${stageId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)

    // Notify parent component
    onStageChange?.(stageId)
  }

  // Auto-scroll to stage when URL changes
  useEffect(() => {
    if (currentStageFromUrl) {
      setTimeout(() => {
        const element = document.getElementById(`stage-${currentStageFromUrl}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 300)
    }
  }, [currentStageFromUrl])

  // Calculate completion statuses at component level so they can be used throughout
  // Welcome stage is completed only when Welcome_Call_Status__c = 'Welcome Call Completed'
  const welcomeCompleted = trainerData?.welcomeCallStatus === 'Welcome Call Completed'

  // Preparation sub-stages
  // Hardware delivery is completed when tracking link is provided
  const hardwareDeliveryCompleted = !!trainerData?.trackingLink
  const productSetupCompleted = trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve'
  // Store setup is completed when video link exists and is not "NA"
  const storeSetupCompleted = !!trainerData?.videoProofLink && trainerData?.videoProofLink !== 'NA'

  const preparationSubStagesCompleted = [
    hardwareDeliveryCompleted,
    productSetupCompleted,
    storeSetupCompleted
  ].filter(Boolean).length

  const totalPreparationStages = 3

  let preparationStatus: 'completed' | 'current' | 'pending' = 'pending'
  if (welcomeCompleted) {
    if (preparationSubStagesCompleted === totalPreparationStages) {
      preparationStatus = 'completed'
    } else {
      preparationStatus = 'current'
    }
  }

  // Installation completion
  const installationCompleted = !!trainerData?.actualInstallationDate

  // Training completion - using single Training_Date__c field
  const trainingCompleted = trainerData?.trainingDate
    ? new Date(trainerData.trainingDate) <= new Date()
    : false

  // Scheduling prerequisites
  const canScheduleInstallation = storeSetupCompleted
  const productListSubmitted = !!trainerData?.menuCollectionSubmissionTimestamp
  const installationDateSet = !!trainerData?.installationDate
  const canScheduleTraining = productListSubmitted && installationDateSet

  // Initialize selectedStage based on URL parameter or welcome call completion status
  const initialStage = currentStageFromUrl ||
                       ((trainerData?.welcomeCallStatus === 'Welcome Call Completed' ||
                        trainerData?.welcomeCallStatus === 'Completed') ? 'preparation' : 'welcome')
  const [selectedStage, setSelectedStage] = useState<string>(initialStage)

  // Update selectedStage when URL changes
  useEffect(() => {
    if (currentStageFromUrl) {
      setSelectedStage(currentStageFromUrl)
    }
  }, [currentStageFromUrl])
  const [updatingField, setUpdatingField] = useState<string | null>(null)
  const [editingGoLiveDate, setEditingGoLiveDate] = useState(false)
  const [goLiveDateValue, setGoLiveDateValue] = useState('')
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [uploadingSSM, setUploadingSSM] = useState(false)
  const [uploadedSSMUrl, setUploadedSSMUrl] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<{[key: string]: boolean}>({
    'document-submission': false,
    'hardware-delivery': false,
    'product-setup': false,
    'store-setup': false,
    'installation': false,
    'training': false
  })
  const [expandedMobileStages, setExpandedMobileStages] = useState<{[key: string]: boolean}>({
    'welcome': false,
    'preparation': false,
    'installation': false,
    'training': false,
    'ready-go-live': false,
    'live': false
  })

  // Auto-expand section when expandSection prop is provided
  useEffect(() => {
    if (expandSection) {
      // Map section names to expandedItems keys
      const sectionMap: {[key: string]: string} = {
        'product-setup': 'product-setup',
        'store-setup': 'store-setup',
        'document-submission': 'document-submission',
        'hardware-delivery': 'hardware-delivery',
        'installation': 'installation',
        'training': 'training'
      }

      const expandKey = sectionMap[expandSection]
      if (expandKey) {
        setExpandedItems(prev => ({ ...prev, [expandKey]: true }))

        // Also expand mobile stages if applicable
        if (expandSection === 'product-setup' || expandSection === 'store-setup' ||
            expandSection === 'document-submission' || expandSection === 'hardware-delivery') {
          setExpandedMobileStages(prev => ({ ...prev, 'preparation': true }))
        } else if (expandSection === 'installation') {
          setExpandedMobileStages(prev => ({ ...prev, 'installation': true }))
        } else if (expandSection === 'training') {
          setExpandedMobileStages(prev => ({ ...prev, 'training': true }))
        }

        // Scroll to the section after a short delay
        setTimeout(() => {
          const element = document.getElementById(`section-${expandSection}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 300)
      }
    }
  }, [expandSection])

  // Define the new 6-stage flow
  const mainStages = [
    { 
      id: 'welcome', 
      label: 'Welcome to StoreHub', 
      sfValue: 'Welcome to StoreHub',
      subStages: []
    },
    { 
      id: 'preparation', 
      label: 'Preparation', 
      sfValue: 'Preparation',
      subStages: [
        { id: 'document-submission', label: 'Document Submission', sfValue: 'Document Submission' },
        { id: 'hardware-delivery', label: 'Hardware Delivery', sfValue: 'Hardware Delivery' },
        { id: 'product-setup', label: 'Product Setup', sfValue: 'Product Setup' }
      ]
    },
    { 
      id: 'installation', 
      label: 'Installation', 
      sfValue: 'Installation',
      subStages: []
    },
    { 
      id: 'training', 
      label: 'Training', 
      sfValue: 'Training',
      subStages: []
    },
    { 
      id: 'ready-go-live', 
      label: 'Ready to go live', 
      sfValue: 'Ready to go live',
      subStages: []
    },
    { 
      id: 'live', 
      label: 'Live', 
      sfValue: 'Live',
      subStages: []
    },
  ]
  
  // For backward compatibility, keep the flat stages array for mapping
  const standardStages = [
    { id: 'welcome-call', label: 'Welcome Call', sfValue: 'Welcome Call' },
    { id: 'product-setup', label: 'Product Setup', sfValue: 'Product Setup' },
    { id: 'hardware-fulfillment', label: 'Hardware Fulfillment', sfValue: 'Hardware Fulfillment' },
    { id: 'hardware-installation', label: 'Hardware Installation', sfValue: 'Hardware Installation' },
    { id: 'training', label: 'Training', sfValue: 'Training' },
    { id: 'go-live', label: 'Go Live', sfValue: 'Go Live' },
    { id: 'post-go-live', label: 'Post Go Live Check In', sfValue: 'Post Go Live Check In' },
  ]

  // Map Salesforce stages to our timeline stages
  const stageMapping: { [key: string]: string } = {
    'New': 'welcome',
    'Welcome Call': 'welcome',
    'Welcome to StoreHub': 'welcome',
    'Product Setup': 'preparation',
    'Preparation': 'preparation',
    'Document Submission': 'preparation',
    'Hardware Delivery': 'preparation',
    'Hardware Fulfillment': 'preparation',
    'Hardware Installation': 'installation',
    'Installation': 'installation',
    'Training': 'training',
    'Go Live': 'ready-go-live',
    'Ready to go live': 'ready-go-live',
    'Live': 'live',
    'Post Go Live Check In': 'live',
    // Legacy mappings
    'welcome-call': 'welcome',
    'product-setup': 'preparation',
    'hardware-fulfillment': 'preparation',
    'hardware-installation': 'installation',
    'training': 'training',
    'go-live': 'ready-go-live',
    'post-go-live': 'live',
    // Additional mappings for various Salesforce stage values
    'Welcome Call Completed': 'preparation',
    'Completed': 'preparation',
    'Product Setup Completed': 'installation',
    'Hardware Delivered': 'installation',
    'Installation Completed': 'training',
    'Training Completed': 'ready-go-live',
    'Ready to Go Live': 'ready-go-live',
    'Go Live Completed': 'live',
    'Post Go Live Completed': 'live',
    // Add more mappings based on actual Salesforce stages
  }

  useEffect(() => {
    // Determine stage statuses based on business rules from progress-bar-completion-guide.md
    const timelineStages: TimelineStage[] = []

    // Welcome Stage - Completed when Welcome_Call_Status__c = 'Welcome Call Completed'
    // (welcomeCompleted is now calculated at component level)

    timelineStages.push({
      id: 'welcome',
      label: 'Welcome to StoreHub',
      status: welcomeCompleted ? 'completed' : 'current',
      completedDate: trainerData?.firstCallTimestamp
    })

    // Preparation Stage - (completion statuses calculated at component level)
    timelineStages.push({
      id: 'preparation',
      label: 'Preparation',
      status: preparationStatus,
      completedDate: preparationStatus === 'completed' ? trainerData?.productSetupCompletedDate : undefined,
      completedCount: preparationSubStagesCompleted,
      totalCount: totalPreparationStages
    })
    
    // Installation Stage - (completion status calculated at component level)
    // Installation is completed if actualInstallationDate exists, regardless of Preparation status
    timelineStages.push({
      id: 'installation',
      label: 'Installation',
      status: installationCompleted ? 'completed' : (preparationStatus === 'completed' ? 'current' : 'pending'),
      completedDate: trainerData?.actualInstallationDate
    })

    // Training Stage - (completion status calculated at component level)
    timelineStages.push({
      id: 'training',
      label: 'Training',
      status: installationCompleted ? (trainingCompleted ? 'completed' : 'current') : 'pending',
      completedDate: trainerData?.trainingDate
    })
    
    // Ready to Go Live Stage - Reflects progress of all previous stages
    const readyToGoLive = welcomeCompleted &&
                         preparationStatus === 'completed' &&
                         installationCompleted &&
                         trainingCompleted

    // Calculate completed count for Ready to Go Live checklist
    const readyToGoLiveChecklist = [
      hardwareDeliveryCompleted,
      productSetupCompleted,
      installationCompleted,
      trainingCompleted,
      !!trainerData?.subscriptionActivationDate
    ]
    const readyToGoLiveCompletedCount = readyToGoLiveChecklist.filter(Boolean).length
    const readyToGoLiveTotalCount = 5
    const allChecklistItemsCompleted = readyToGoLiveCompletedCount === readyToGoLiveTotalCount

    // Determine Ready to Go Live status based on checklist completion
    let readyToGoLiveStatus: 'completed' | 'current' | 'pending' = 'pending'
    if (allChecklistItemsCompleted) {
      // All 5 checklist items completed (including subscription) - show as completed (green)
      readyToGoLiveStatus = 'completed'
    } else if (readyToGoLive) {
      // All previous stages completed but subscription not activated - show as current (orange)
      readyToGoLiveStatus = 'current'
    } else if (welcomeCompleted || preparationStatus !== 'pending' || installationCompleted || trainingCompleted) {
      // At least one previous stage has started or completed - show as current
      readyToGoLiveStatus = 'current'
    }

    timelineStages.push({
      id: 'ready-go-live',
      label: 'Ready to go live',
      status: readyToGoLiveStatus,
      completedDate: allChecklistItemsCompleted ? trainerData?.subscriptionActivationDate : undefined,
      completedCount: readyToGoLiveCompletedCount,
      totalCount: readyToGoLiveTotalCount
    })
    
    // Live Stage
    // Live is completed when POS/QR/Delivery transaction count in past 30 days > 30
    const isLive = (trainerData?.posQrDeliveryTnxCount ?? 0) > 30

    // Calculate days to go live on client side
    const daysToGoLive = trainerData?.plannedGoLiveDate
      ? Math.ceil((new Date(trainerData.plannedGoLiveDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null
    const isOverdue = daysToGoLive !== null && daysToGoLive < 0 && !isLive

    timelineStages.push({
      id: 'live',
      label: 'Live',
      status: isLive ? 'completed' : (readyToGoLive ? 'current' : 'pending'),
      completedDate: isLive ? trainerData?.subscriptionActivationDate : undefined
    })

    setStages(timelineStages)
    
    // Automatically open the current stage drawer on mobile
    const currentStageObj = timelineStages.find(s => s.status === 'current')
    if (currentStageObj) {
      setExpandedMobileStages(prev => ({
        ...prev,
        [currentStageObj.id]: true
      }))
    }
  }, [trainerData])

  const getStageIcon = (stage: TimelineStage, index: number) => {
    if (stage.status === 'completed') {
      return (
        <div className="w-10 h-10 bg-[#ff630f] rounded-full flex items-center justify-center text-white shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )
    } else if (stage.status === 'current') {
      return (
        <div className="w-10 h-10 bg-[#ff630f] rounded-full flex items-center justify-center shadow-lg">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span className="text-[#ff630f] font-bold text-sm">{index + 1}</span>
          </div>
        </div>
      )
    } else {
      return (
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
          <span className="text-gray-400 font-medium text-sm">{index + 1}</span>
        </div>
      )
    }
  }

  const getConnectorColor = (stage: TimelineStage) => {
    if (stage.status === 'completed') {
      return 'bg-gradient-to-r from-blue-500 to-purple-500'
    } else {
      return 'bg-gray-200'
    }
  }
  
  const getStatusText = (stage: TimelineStage) => {
    if (stage.status === 'completed') {
      return <span className="text-green-600 text-xs">Completed</span>
    } else if (stage.status === 'current') {
      return <span className="text-purple-600 text-xs">In Progress</span>
    } else {
      return <span className="text-gray-400 text-xs">Not Started</span>
    }
  }

  const handleBookingClick = (bookingType: string, existingDate?: string) => {
    console.log('🔘 handleBookingClick called:', {
      bookingType,
      existingDate,
      hasOnOpenBookingModal: !!onOpenBookingModal,
      trainerDataKeys: Object.keys(trainerData || {}),
      shippingState: trainerData?.shippingState,
      shippingCity: trainerData?.shippingCity,
      shippingCountry: trainerData?.shippingCountry
    })

    if (onOpenBookingModal) {
      onOpenBookingModal({
        ...trainerData,
        bookingType: bookingType,
        existingDate: existingDate
      })
    }
  }

  const toggleItemExpansion = (itemKey: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }))
  }
  
  const handleGoLiveDateSave = async () => {
    if (!goLiveDateValue || !trainerData?.id) return
    
    setUpdatingField('go-live')
    try {
      const response = await fetch('/api/salesforce/update-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId: trainerData.id,
          fieldName: 'go-live',
          value: goLiveDateValue,
          bookingType: 'go-live'
        })
      })
      
      const result = await response.json()
      if (result.success) {
        setEditingGoLiveDate(false)
        setGoLiveDateValue('')
        if (onBookingComplete) {
          onBookingComplete()
        }
      } else {
        console.error('Failed to update Go-Live date:', result.message)
        alert(`Failed to update Go-Live date: ${result.message}`)
      }
    } catch (error) {
      console.error('Error updating Go-Live date:', error)
      alert('Error updating Go-Live date. Please try again.')
    } finally {
      setUpdatingField(null)
    }
  }

  const toggleMobileStage = (stageId: string) => {
    setExpandedMobileStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }))
  }

  const getMobileStageContent = (stageId: string) => {
    switch(stageId) {
      case 'welcome':
        return (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">First Call Timestamp</div>
              <div className="text-base font-medium text-gray-900">
                {trainerData?.firstCallTimestamp
                  ? formatDateTime(trainerData.firstCallTimestamp)
                  : 'Not Recorded'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Onboarding Manager Name</div>
              <div className="text-base font-medium text-gray-900">
                {trainerData?.msmName || 'Not Assigned'}
              </div>
            </div>
            
            {/* Welcome Call Summary */}
            <div className="pt-3 border-t border-gray-200">
              <h5 className="text-sm font-semibold text-gray-900 mb-3">Welcome Call Summary:</h5>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Go live date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {trainerData?.plannedGoLiveDate
                      ? formatDate(trainerData.plannedGoLiveDate)
                      : 'Not Set'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Hardware delivery:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {trainerData?.hardwareFulfillmentDate
                      ? formatDate(trainerData.hardwareFulfillmentDate)
                      : 'Not Set'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Installation:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateTime(trainerData?.installationDate)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Training:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateTime(trainerData?.trainingDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'preparation':
        return (
          <div className="space-y-3">
            {/* Hardware Delivery - Expandable */}
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleItemExpansion('mobile-hardware')}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3 flex-1">
                  {/* Status Icon */}
                  {(() => {
                    const isDelivered = trainerData?.hardwareDeliveryStatus === 'Delivered' || 
                                       trainerData?.trackingLink;
                    const isScheduled = trainerData?.hardwareFulfillmentDate && !isDelivered;
                    
                    if (isDelivered) {
                      return (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      );
                    } else if (isScheduled) {
                      return (
                        <div className="w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      );
                    } else {
                      return (
                        <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                        </div>
                      );
                    }
                  })()}
                  <div className="flex-1 text-left">
                    <div className="text-base font-medium text-gray-900 text-left">Hardware Delivery</div>
                    <div className="text-sm text-left">
                      {(() => {
                        if (trainerData?.hardwareDeliveryStatus === 'Delivered') return <span className="text-gray-500">Delivered</span>;
                        if (trainerData?.trackingLink) return <span className="text-gray-500">In Transit</span>;
                        if (trainerData?.hardwareFulfillmentDate) return <span className="text-orange-600">Scheduled</span>;
                        return <span className="text-orange-600">Pending</span>;
                      })()}
                    </div>
                  </div>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                  expandedItems['mobile-hardware'] ? 'rotate-180' : ''
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedItems['mobile-hardware'] && (
                <div className="pl-12 pr-4 pb-4 space-y-3 pt-3 text-left">
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1 text-left">Order Status</div>
                    <div className="text-base text-gray-900">{trainerData?.orderNSStatus || 'Not Available'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Shipping Address</div>
                    <div className="text-base text-gray-900">
                      {(() => {
                        if (!trainerData?.orderShippingAddress) return 'Not Available';
                        if (typeof trainerData.orderShippingAddress === 'string') {
                          return trainerData.orderShippingAddress;
                        }
                        const addr = trainerData.orderShippingAddress;
                        const parts = [addr.street, addr.city, addr.state || addr.stateCode, 
                                     addr.postalCode, addr.country || addr.countryCode].filter(Boolean);
                        return parts.length > 0 ? parts.join(', ') : 'Not Available';
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Tracking Link</div>
                    {trainerData?.trackingLink ? (
                      <a href={trainerData.trackingLink} target="_blank" rel="noopener noreferrer"
                         className="inline-block text-base text-blue-600 hover:text-blue-700">
                        Track Package
                      </a>
                    ) : (
                      <span className="text-base text-gray-500">No tracking available</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span>Fulfillment Date</span>
                      <div className="relative group">
                        <svg
                          className="w-3.5 h-3.5 text-gray-400 cursor-help"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        {/* Tooltip */}
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded py-2 px-3 z-10 normal-case">
                          Shipment date can only be set by StoreHub Onboarding Manager
                          <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                    <div className="text-base text-gray-900">
                      {trainerData?.hardwareFulfillmentDate
                        ? formatDate(trainerData.hardwareFulfillmentDate)
                        : 'Not Scheduled'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Product Setup - Expandable */}
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleItemExpansion('mobile-product')}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3 flex-1">
                  {/* Status Icon */}
                  {(() => {
                    const productComplete = trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve';
                    const inProgress = !!trainerData?.menuCollectionSubmissionTimestamp && !productComplete;

                    if (productComplete) {
                      return (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      );
                    } else if (inProgress) {
                      return (
                        <div className="w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      );
                    } else {
                      return (
                        <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                        </div>
                      );
                    }
                  })()}
                  <div className="flex-1 text-left">
                    <div className="text-base font-medium text-gray-900 text-left">{terminology.setupLabel}</div>
                    <div className="text-sm text-gray-500 text-left">
                      {(() => {
                        if (trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve') return 'Completed';
                        if (trainerData?.menuCollectionSubmissionTimestamp) return <span className="text-orange-600">{terminology.submittedStatus}</span>;
                        return <span className="text-orange-600">{terminology.pendingStatus}</span>;
                      })()}
                    </div>
                  </div>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                  expandedItems['mobile-product'] ? 'rotate-180' : ''
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedItems['mobile-product'] && (
                <div className="pl-12 pr-4 pb-4 space-y-3 pt-3 text-left">
                  {/* Menu Submission Deadline Notice - Mobile */}
                  <ImportantReminderBox
                    type="product-list"
                    installationDate={trainerData?.actualInstallationDate}
                    trainingDate={trainerData?.trainingDate}
                    isCompleted={!!trainerData?.menuCollectionSubmissionTimestamp}
                    collectionName={terminology.collectionName}
                  />

                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1 text-left">{terminology.collectionFormLabel}</div>
                    {trainerData?.menuCollectionFormLink ? (
                      <a href={trainerData.menuCollectionFormLink} target="_blank" rel="noopener noreferrer"
                         onClick={handleProductSetupClick}
                         className="inline-flex items-center px-3 py-2 bg-[#ff630f] hover:bg-[#fe5b25] text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95">
                        Submit Form
                      </a>
                    ) : (
                      <span className="text-base text-gray-500">Form not available</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Submission Timestamp</div>
                    <div className="text-base text-gray-900">
                      {trainerData?.menuCollectionSubmissionTimestamp
                        ? formatDateTime(trainerData.menuCollectionSubmissionTimestamp)
                        : 'Not Submitted'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span>{terminology.completedSetupLabel}</span>
                      <div className="relative group">
                        <svg
                          className="w-3.5 h-3.5 text-gray-400 cursor-help"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        {/* Tooltip */}
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded py-2 px-3 z-10 normal-case">
                          {terminology.tooltipText}
                          <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                    <div className="text-base font-medium text-gray-900">
                      {trainerData?.completedProductSetup || 'No'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Store Setup Video - Expandable */}
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleItemExpansion('mobile-video')}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3 flex-1">
                  {/* Status Icon */}
                  {(trainerData?.videoProofLink || uploadedVideoUrl) ? (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <div className="text-base font-medium text-gray-900 text-left">Store Setup</div>
                    <div className="text-sm text-left">
                      {trainerData?.videoProofLink || uploadedVideoUrl ? (
                        <span className="text-gray-500">Completed</span>
                      ) : (
                        <span className="text-orange-600">Pending Upload</span>
                      )}
                    </div>
                  </div>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                  expandedItems['mobile-video'] ? 'rotate-180' : ''
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedItems['mobile-video'] && (
                <div className="pl-12 pr-4 pb-4 space-y-4 pt-3 text-left">
                  {/* Store Setup Video Deadline Notice - Mobile */}
                  <ImportantReminderBox
                    type="store-setup"
                    installationDate={trainerData?.installationDate}
                    isCompleted={!!(trainerData?.videoProofLink && trainerData?.videoProofLink !== 'NA')}
                  />

                  {/* CTA Section - Most Prominent */}
                  <div className="space-y-3">
                    {(trainerData?.videoProofLink || uploadedVideoUrl) && (
                      <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-700">Video uploaded - </span>
                        <a href={uploadedVideoUrl || trainerData?.videoProofLink} target="_blank" rel="noopener noreferrer"
                           className="text-blue-600 hover:text-blue-700 underline">
                          View Video
                        </a>
                      </div>
                    )}
                    <input
                      id={`mobile-video-upload-${trainerData?.id}`}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setUploadingVideo(true)
                        try {
                          const formData = new FormData()
                          formData.append('file', file)
                          formData.append('trainerId', trainerData?.id || '')
                          const response = await fetch('/api/salesforce/upload-video', {
                            method: 'POST',
                            body: formData
                          })
                          if (!response.ok) {
                            const error = await response.json()
                            throw new Error(error.details || error.error || 'Failed to upload')
                          }
                          const result = await response.json()
                          setUploadedVideoUrl(result.fileUrl)
                          if (onBookingComplete) {
                            onBookingComplete()
                          }
                        } catch (error) {
                          console.error('Error uploading video:', error)
                          alert(error instanceof Error ? error.message : 'Failed to upload')
                        } finally {
                          setUploadingVideo(false)
                          e.target.value = ''
                        }
                      }}
                    />
                    <button
                      onClick={() => document.getElementById(`mobile-video-upload-${trainerData?.id}`)?.click()}
                      disabled={uploadingVideo}
                      className="inline-flex items-center px-3 py-2 bg-[#ff630f] hover:bg-[#fe5b25] disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                      {uploadingVideo ? 'Uploading...' : (trainerData?.videoProofLink || uploadedVideoUrl ? 'Replace Video' : 'Upload Video')}
                    </button>
                  </div>

                  {/* Simplified Info Section */}
                  <div className="space-y-4 text-sm text-gray-700">
                    {/* Section 1: How to set up the store */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="font-semibold text-gray-900 mb-2">1. How to set up the store:</p>
                      <a href="https://drive.google.com/file/d/1vPr7y0VdD6sKaKG_h8JbwNi0RBE16xdc/view"
                         target="_blank" rel="noopener noreferrer"
                         className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
                        📖 Guide for your store network setup (cabling and wiring)
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>

                    {/* Section 2: How to record video */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="font-semibold text-gray-900 mb-3">2. How to record video:</p>
                      <div className="space-y-2 mb-3">
                        <p className="text-gray-700">Show us 3 things at each location:</p>
                        <p className="text-gray-700"><span className="font-semibold">Main Counter:</span> Terminal & receipt printer location, Power socket, LAN port</p>
                        <p className="text-gray-700"><span className="font-semibold">Kitchen/Other Stations:</span> Printer location, Power socket, LAN port</p>
                      </div>
                      <p className="text-blue-700 font-medium">📱 Quick Tip: Hold your phone sideways (horizontally) while recording!</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      
      case 'installation':
        return (
          <div className="space-y-4">
            <div>
              {(() => {
                // Check if external vendor using installerType from API
                const installerType = (trainerData as any)?.installerType
                const isExternalVendor = installerType === 'external'
                return (
                  <>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">
                      {isExternalVendor ? 'Proposed Installation Date' : 'Scheduled Installation Date'}
                    </div>
                    {isExternalVendor && (
                      <div className="text-xs text-gray-500 mb-2 italic">
                        Vendor will confirm directly to finalise the date
                      </div>
                    )}
                  </>
                )
              })()}
              <div>
                <div className="text-base font-medium text-gray-900 mb-2">
                  {trainerData?.installationDate
                    ? formatDateTime(trainerData.installationDate)
                    : 'Not Scheduled'}
                </div>
                {(() => {
                  const cannotReschedule = trainerData?.installationDate && isWithinNextDay(trainerData.installationDate)
                  // If date is already set, allow them to change it (don't block for prerequisites)
                  const hasExistingDate = !!trainerData?.installationDate
                  const isButtonDisabled = cannotReschedule || (!canScheduleInstallation && !hasExistingDate)
                  return (
                    <div>
                      <button
                        onClick={() => !isButtonDisabled && handleBookingClick('installation', trainerData?.installationDate)}
                        disabled={isButtonDisabled}
                        className={`px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg ${
                          isButtonDisabled
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-[#ff630f] hover:bg-[#fe5b25] active:scale-95'
                        }`}
                        title={cannotReschedule ? 'Rescheduling must be done at least 2 days in advance' : (!canScheduleInstallation && !hasExistingDate) ? 'Store Setup Video must be submitted first' : ''}
                      >
                        {trainerData?.installationDate ? 'Change Date' : 'Schedule'}
                      </button>
                      {!canScheduleInstallation && !hasExistingDate && (
                        <div className="mt-2 text-sm text-amber-600">
                          Please submit your Store Setup Video before scheduling installation.
                        </div>
                      )}
                      {cannotReschedule && (
                        <div className="mt-2 text-sm text-gray-600">
                          To reschedule, please contact your onboarding manager
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Installer Name</div>
              <div className="text-base font-medium text-gray-900">
                {(() => {
                  // If installer name is set, show it
                  if (trainerData?.installerName) {
                    return trainerData.installerName
                  }
                  // If installation date is set but no installer name, check installer type
                  if (trainerData?.installationDate) {
                    // Use installerType from parent trainerData object (not nested in trainers array)
                    const installerType = (trainerData as any)?.installerType
                    return installerType === 'external' ? 'External Vendor' : 'Not Assigned'
                  }
                  return 'Not Assigned'
                })()}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Store Address</div>
              <div className="text-base font-medium text-gray-900">
                {(() => {
                  const parts = [
                    trainerData?.shippingStreet,
                    trainerData?.shippingCity,
                    trainerData?.shippingState,
                    trainerData?.shippingZipPostalCode,
                    trainerData?.shippingCountry
                  ].filter(Boolean);
                  return parts.length > 0 ? parts.join(', ') : 'Not Available';
                })()}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Actual Installation Date</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.actualInstallationDate
                  ? formatDate(trainerData.actualInstallationDate)
                  : 'Not Completed'}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Installation Status</div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                trainerData?.installationStatus === 'Completed' ? 'bg-green-100 text-green-800' :
                trainerData?.installationStatus === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                trainerData?.installationStatus === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {trainerData?.installationStatus || 'Not Started'}
              </span>
            </div>

            {trainerData?.installationIssuesElaboration && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Installation Issues</div>
                <div className="text-sm text-gray-900 bg-red-50 border border-red-200 rounded p-2">
                  {trainerData.installationIssuesElaboration}
                </div>
              </div>
            )}
          </div>
        )
      
      case 'training':
        return (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Training Date</div>
              <div>
                <div className="text-base font-medium text-gray-900 mb-2">
                  {trainerData?.trainingDate
                    ? formatDateTime(trainerData.trainingDate)
                    : 'Not Scheduled'}
                </div>
                {(() => {
                  const cannotReschedule = trainerData?.trainingDate && isWithinNextDay(trainerData.trainingDate)
                  // If date is already set, allow them to change it (don't block for prerequisites)
                  const hasExistingDate = !!trainerData?.trainingDate
                  const isButtonDisabled = cannotReschedule || (!canScheduleTraining && !hasExistingDate)
                  return (
                    <div>
                      <button
                        onClick={() => !isButtonDisabled && handleBookingClick('training', trainerData?.trainingDate)}
                        disabled={isButtonDisabled}
                        className={`px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg ${
                          isButtonDisabled
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-[#ff630f] hover:bg-[#fe5b25] active:scale-95'
                        }`}
                        title={cannotReschedule ? 'Rescheduling must be done at least 2 days in advance' : (!canScheduleTraining && !hasExistingDate) ? `${terminology.collectionName.charAt(0).toUpperCase() + terminology.collectionName.slice(1)} must be submitted and Installation must be scheduled first` : ''}
                      >
                        {trainerData?.trainingDate ? 'Change Date' : 'Schedule'}
                      </button>
                      {!productListSubmitted && !hasExistingDate && (
                        <div className="mt-2 text-sm text-amber-600">
                          Please submit your {terminology.collectionName} before scheduling training.
                        </div>
                      )}
                      {productListSubmitted && !installationDateSet && !hasExistingDate && (
                        <div className="mt-2 text-sm text-amber-600">
                          Please schedule installation first before scheduling training.
                        </div>
                      )}
                      {cannotReschedule && (
                        <div className="mt-2 text-sm text-gray-600">
                          To reschedule, please contact your onboarding manager
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Remote Training Meeting Link - Only for Remote Training */}
            {trainerData?.onboardingServicesBought?.toLowerCase().includes('remote') && trainerData?.remoteTrainingMeetingLink && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Remote Training Meeting Link</div>
                <div className="space-y-3">
                  <a
                    href={trainerData.remoteTrainingMeetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors w-full justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Join Training
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(trainerData?.remoteTrainingMeetingLink || '');
                      alert('Meeting link copied to clipboard!');
                    }}
                    className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors w-full justify-center"
                    title="Copy meeting link"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Link
                  </button>
                  <div className="text-xs text-gray-500 font-mono break-all">
                    {trainerData.remoteTrainingMeetingLink}
                  </div>
                </div>
              </div>
            )}

            {/* Training Type */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Training Type</div>
              <div className="text-sm font-medium text-gray-900">
                {(() => {
                  const serviceType = detectServiceType(trainerData?.onboardingServicesBought)
                  const merchantState = trainerData?.shippingState || trainerData?.shippingCity || ''
                  console.log('🏷️ Training Type Debug (Mobile):', {
                    onboardingServicesBought: trainerData?.onboardingServicesBought,
                    shippingState: trainerData?.shippingState,
                    shippingCity: trainerData?.shippingCity,
                    serviceType,
                    merchantState
                  })
                  return getServiceTypeMessage(serviceType, merchantState)
                })()}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Trainer Name</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.csmName || 'Not Assigned'}
              </div>
            </div>

            {/* Store Address - Only for Onsite Training */}
            {!trainerData?.onboardingServicesBought?.toLowerCase().includes('remote') && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Store Address</div>
                <div className="text-sm font-medium text-gray-900">
                  {(() => {
                    const parts = [
                      trainerData?.shippingStreet,
                      trainerData?.shippingCity,
                      trainerData?.shippingState,
                      trainerData?.shippingZipPostalCode,
                      trainerData?.shippingCountry
                    ].filter(Boolean);
                    return parts.length > 0 ? parts.join(', ') : 'Not Available';
                  })()}
                </div>
              </div>
            )}

            {/* Required Features by Merchant */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Required Features by Merchant</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.requiredFeaturesByMerchant || 'None Specified'}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Onboarding Services Bought</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.onboardingServicesBought || 'None'}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Completed Training</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.completedTraining ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        )

      case 'ready-go-live':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-base text-gray-700">✓ Hardware Delivered</span>
              <span className={`text-sm ${trainerData?.hardwareFulfillmentDate ? 'text-green-600' : 'text-gray-400'}`}>
                {trainerData?.hardwareFulfillmentDate ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base text-gray-700">✓ Product Setup</span>
              <span className={`text-sm ${(trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve') ? 'text-green-600' : 'text-gray-400'}`}>
                {(trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve') ? trainerData?.completedProductSetup : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base text-gray-700">✓ Installation</span>
              <span className={`text-sm ${trainerData?.installationStatus === 'Completed' ? 'text-green-600' : 'text-gray-400'}`}>
                {trainerData?.installationStatus === 'Completed' ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base text-gray-700">✓ Training</span>
              <span className={`text-sm ${trainerData?.completedTraining === 'Yes' ? 'text-green-600' : 'text-gray-400'}`}>
                {trainerData?.completedTraining === 'Yes' ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base text-gray-700">✓ Subscription Activated</span>
              <span className={`text-sm ${trainerData?.subscriptionActivationDate ? 'text-green-600' : 'text-gray-400'}`}>
                {trainerData?.subscriptionActivationDate ? 'Yes' : 'No'}
              </span>
            </div>
            {trainerData?.boAccountName && !trainerData?.subscriptionActivationDate && (
              <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded">
                <p className="text-orange-800 mb-1 text-sm">⚠️ Please activate subscription at:</p>
                <a
                  href={`https://${trainerData.boAccountName}.storehubhq.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all text-base"
                >
                  {trainerData.boAccountName}.storehubhq.com
                </a>
                <div className="mt-2 pt-2 border-t border-orange-200">
                  <p className="text-xs text-orange-700 mb-1">Need help?</p>
                  <a
                    href="https://care.storehub.com/en/articles/10650521-manage-subscription-how-to-self-activate-your-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    View activation guide
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </div>
        )
      
      case 'live':
        return (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
              <div className="text-sm font-medium">
                {trainerData?.firstRevisedEGLD && new Date(trainerData.firstRevisedEGLD) <= new Date() ? (
                  <span className="text-green-600">✅ Merchant is Live</span>
                ) : (
                  <span className="text-gray-500">⏳ Awaiting Go-Live</span>
                )}
              </div>
            </div>

            {/* BackOffice Account Name */}
            {trainerData?.boAccountName && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">BackOffice Account</div>
                <a
                  href={`https://${trainerData.boAccountName}.storehubhq.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#ff630f] hover:text-[#e55a0e] transition-colors"
                >
                  <span>{trainerData.boAccountName}.storehubhq.com</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            {/* Onboarding Survey Link */}
            {trainerData?.boAccountName && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Onboarding Survey</div>
                <a
                  href={`https://storehub.sg.larksuite.com/share/base/form/shrlgoT9OUwf6B1w5bdBSQTOCeb?prefill_Your+BackOffice+Account+Name=${encodeURIComponent(trainerData.boAccountName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#ff630f] hover:text-[#e55a0e] transition-colors"
                >
                  <span>Share Your Feedback</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <p className="text-xs text-gray-500 mt-1">Help us improve your onboarding experience</p>
              </div>
            )}
          </div>
        )
      
      default:
        return <div className="text-xs text-gray-500">No details available</div>
    }
  }

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg p-3">
      {/* Desktop: Horizontal Progress Bar Timeline */}
      <div className="hidden md:block bg-gray-50 rounded-lg p-2 mb-3">
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => {
            // Check if stage is locked due to unmet prerequisites
            // Don't lock if date is already set (they should be able to change it)
            const trainingDateSet = !!trainerData?.trainingDate
            const isInstallationLocked = stage.id === 'installation' && !canScheduleInstallation && !installationDateSet && !installationCompleted
            const isTrainingLocked = stage.id === 'training' && !canScheduleTraining && !trainingDateSet && !trainingCompleted
            const isStageLocked = isInstallationLocked || isTrainingLocked

            // Tooltip message for locked stages
            const lockedTooltip = isInstallationLocked
              ? 'Please submit your Store Setup Video first'
              : isTrainingLocked
                ? !productListSubmitted
                  ? `Please submit your ${terminology.collectionName} first`
                  : 'Please schedule Installation first'
                : ''

            return (
            <div
              key={stage.id}
              className={`flex-1 relative group ${isStageLocked ? 'opacity-50' : ''}`}
            >
              {/* Tooltip for locked stages */}
              {isStageLocked && lockedTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  {lockedTooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              )}
              <div
                className={`transition-all duration-200 rounded-lg p-2 -m-2 ${
                  isStageLocked
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer'
                } ${
                  selectedStage === stage.id
                    ? 'bg-orange-50 shadow-sm'
                    : isStageLocked ? '' : 'hover:bg-white hover:shadow-sm'
                }`}
                onClick={() => !isStageLocked && handleStageClick(stage.id)}
              >
                {/* Progress Bar Section */}
                <div className="relative">
                  <div className={`h-2 rounded-full transition-all duration-200 ${
                    stage.status === 'completed' ? 'bg-green-500' :
                    stage.status === 'current' ? 'bg-orange-400' :
                    'bg-gray-300'
                  } ${index < stages.length - 1 ? 'mr-1' : ''} ${
                    selectedStage === stage.id ? 'h-3 shadow-md' : 'hover:h-3'
                  }`} />

                  {/* Stage Label Below */}
                  <div className="mt-1.5 text-center">
                    <div className={`text-[10px] font-semibold transition-colors duration-200 ${
                      selectedStage === stage.id ? 'text-[#ff630f]' :
                      stage.status === 'completed' ? 'text-green-600' :
                      stage.status === 'current' ? 'text-orange-600' :
                      'text-gray-500'
                    }`}>
                      {stage.label}
                    </div>
                    {/* Status under stage name */}
                    <div className="text-[8px] text-gray-500 mt-0.5">
                      {(() => {
                        switch(stage.id) {
                          case 'welcome':
                            return stage.status === 'completed' ? 'Completed' : 'In Progress'
                          case 'preparation':
                            if (stage.status === 'completed') return 'Completed'
                            if (stage.completedCount !== undefined && stage.totalCount !== undefined) {
                              return `${stage.completedCount}/${stage.totalCount} Completed`
                            }
                            return 'In Progress'
                          case 'installation':
                            if (stage.status === 'completed') return 'Completed'
                            if (stage.status === 'current') return 'In Progress'
                            // Show "Scheduled" with date if date is set, "Not set" if no date
                            return trainerData?.installationDate
                              ? `Scheduled • ${formatDate(trainerData.installationDate)}`
                              : 'Not set'
                          case 'training':
                            if (stage.status === 'completed') return 'Completed'
                            if (stage.status === 'current') return 'In Progress'
                            // Show "Scheduled" with date if date is set, "Not set" if no date
                            const trainingDate = trainerData?.posTrainingDate || trainerData?.backOfficeTrainingDate || trainerData?.trainingDate
                            return trainingDate
                              ? `Scheduled • ${formatDate(trainingDate)}`
                              : 'Not set'
                          case 'ready-go-live':
                            if (stage.status === 'completed') return 'Ready'
                            if (stage.completedCount !== undefined && stage.totalCount !== undefined) {
                              return `${stage.completedCount}/${stage.totalCount} Completed`
                            }
                            return stage.status === 'current' ? 'Preparing' : 'Not Started'
                          case 'live':
                            // Show "Live" if merchant is Live (stage.status === 'completed')
                            // Show "Overdue" if Days to Go Live < 0 and not Live
                            // Calculate days to go live on client side
                            const daysToGoLive = trainerData?.plannedGoLiveDate
                              ? Math.ceil((new Date(trainerData.plannedGoLiveDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                              : null
                            if (stage.status === 'completed') {
                              return 'Live'
                            }
                            if (daysToGoLive !== null && daysToGoLive < 0) {
                              return 'Overdue'
                            }
                            return stage.status === 'current' ? 'Going Live' : 'Not Started'
                          default:
                            return ''
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Mobile: Vertical Timeline with Expandable Drawers */}
      <div className="md:hidden">
        <div className="space-y-4">
          {stages.map((stage, index) => {
            // Check if stage is locked due to unmet prerequisites
            // Don't lock if date is already set (they should be able to change it)
            const trainingDateSet = !!trainerData?.trainingDate
            const isInstallationLocked = stage.id === 'installation' && !canScheduleInstallation && !installationDateSet && !installationCompleted
            const isTrainingLocked = stage.id === 'training' && !canScheduleTraining && !trainingDateSet && !trainingCompleted
            const isStageLocked = isInstallationLocked || isTrainingLocked

            // Prerequisite message for locked stages
            const lockedMessage = isInstallationLocked
              ? 'Please submit your Store Setup Video first'
              : isTrainingLocked
                ? !productListSubmitted
                  ? `Please submit your ${terminology.collectionName} first`
                  : 'Please schedule Installation first'
                : ''

            return (
            <div key={stage.id} className={`relative ${isStageLocked ? 'opacity-50' : ''}`}>
              {/* Connector Line */}
              {index < stages.length - 1 && (
                <div className="absolute left-[16px] top-12 bottom-0 w-0.5 bg-gray-300" />
              )}

              {/* Stage Item */}
              <div className="relative">
                <button
                  onClick={() => !isStageLocked && toggleMobileStage(stage.id)}
                  className={`w-full text-left py-2 px-1 -mx-1 rounded-lg transition-colors ${
                    isStageLocked ? 'cursor-not-allowed' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Stage Icon/Circle - Medium size for balance */}
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md ${
                      stage.status === 'completed' ? 'bg-green-500' :
                      stage.status === 'current' ? 'bg-orange-500' :
                      'bg-gray-300'
                    }`}>
                      {stage.status === 'completed' ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : stage.status === 'current' ? (
                        <div className="w-2.5 h-2.5 bg-white rounded-full" />
                      ) : (
                        <div className="w-2.5 h-2.5 bg-gray-100 rounded-full" />
                      )}
                    </div>
                    
                    {/* Stage Content */}
                    <div className="flex-1 pr-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className={`font-semibold text-base ${
                            stage.status === 'completed' ? 'text-gray-900' :
                            stage.status === 'current' ? 'text-gray-900' :
                            'text-gray-600'
                          }`}>
                            {stage.label}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            {(() => {
                              if (stage.id === 'welcome') {
                                return welcomeCompleted ? 'Completed' : 'In Progress'
                              }
                              if (stage.id === 'live') {
                                // Show "Live" if merchant is Live (stage.status === 'completed')
                                // Show "Overdue" if Days to Go Live < 0 and not Live
                                // Calculate days to go live on client side
                                const daysToGoLive = trainerData?.plannedGoLiveDate
                                  ? Math.ceil((new Date(trainerData.plannedGoLiveDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                  : null
                                if (stage.status === 'completed') {
                                  return 'Live'
                                }
                                if (daysToGoLive !== null && daysToGoLive < 0) {
                                  return 'Overdue'
                                }
                                return stage.status === 'current' ? 'Going Live' : 'Not Started'
                              }
                              // For stages with completion counts (Preparation, Ready to Go Live)
                              if (stage.completedCount !== undefined && stage.totalCount !== undefined) {
                                // Show "Completed" if stage status is completed
                                if (stage.status === 'completed') {
                                  return 'Completed'
                                }
                                return `${stage.completedCount}/${stage.totalCount} Completed`
                              }
                              if (stage.completedDate) {
                                return formatDate(stage.completedDate)
                              }
                              // Show scheduled dates for Not Started stages
                              if (stage.status === 'pending') {
                                if (stage.id === 'installation') {
                                  return trainerData?.installationDate
                                    ? `Scheduled • ${formatDate(trainerData.installationDate)}`
                                    : 'Not set'
                                } else if (stage.id === 'training') {
                                  const trainingDate = trainerData?.posTrainingDate || trainerData?.backOfficeTrainingDate || trainerData?.trainingDate
                                  return trainingDate
                                    ? `Scheduled • ${formatDate(trainingDate)}`
                                    : 'Not set'
                                }
                                return 'Not Started'
                              }
                              return stage.status === 'current' ? 'In Progress' : ''
                            })()}
                          </p>
                          {/* Prerequisite message for locked stages */}
                          {isStageLocked && lockedMessage && (
                            <p className="text-xs text-amber-600 mt-0.5">{lockedMessage}</p>
                          )}
                        </div>

                        {/* Expand/Collapse Arrow - Larger tap target */}
                        <div className="p-1">
                          <svg className={`w-6 h-6 text-gray-400 transition-transform ${
                            expandedMobileStages[stage.id] ? 'rotate-180' : ''
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
                
                {/* Expandable Content Drawer */}
                {expandedMobileStages[stage.id] && (
                  <div className="ml-12 mt-3 pb-3">
                    {getMobileStageContent(stage.id)}
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Desktop Only: Preparation Status Overview - Prominent */}
      {selectedStage === 'preparation' && (
        <div id="stage-preparation" className="hidden md:block">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Preparation</span>
            {(() => {
              // Use the same completion logic as defined at component level
              // Hardware delivery is completed when tracking link is provided
              const hardwareDeliveryCompleted = !!trainerData?.trackingLink;
              const productSetupCompleted = trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve';
              // Store setup is completed when video link exists and is not "NA"
              const storeSetupCompleted = !!trainerData?.videoProofLink && trainerData?.videoProofLink !== 'NA';

              const completed = [
                hardwareDeliveryCompleted,
                productSetupCompleted,
                storeSetupCompleted
              ].filter(Boolean).length;

              const allDone = completed === 3;

              return (
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  allDone ? 'bg-green-100 text-green-800' :
                  completed >= 2 ? 'bg-blue-100 text-blue-800' :
                  completed >= 1 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {allDone ? 'Completed' : `${completed}/3 Completed`}
                </span>
              );
            })()}
          </h4>
          
          <div className="space-y-3">
            {/* 1. Hardware Delivery */}
            <div className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="p-3">
                <button
                  onClick={() => toggleItemExpansion('hardware-delivery')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      // Hardware Delivery status icons
                      const isDelivered = trainerData?.hardwareDeliveryStatus === 'Delivered' || trainerData?.trackingLink;
                      const isScheduled = trainerData?.hardwareFulfillmentDate && !isDelivered;

                      if (isDelivered) {
                        return (
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        );
                      } else if (isScheduled) {
                        return (
                          <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        );
                      } else {
                        return (
                          <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        );
                      }
                    })()}
                    <div className="text-sm font-medium text-gray-900">Hardware Delivery</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      {(() => {
                        if (trainerData?.hardwareDeliveryStatus === 'Delivered' || trainerData?.trackingLink) {
                          return <span className="text-gray-500">Delivered</span>;
                        }
                        if (trainerData?.hardwareFulfillmentDate) {
                          return <span className="text-orange-600">Scheduled</span>;
                        }
                        return <span className="text-orange-600">Pending</span>;
                      })()}
                    </div>
                    <svg className={`w-4 h-4 transition-transform text-gray-400 ${expandedItems['hardware-delivery'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Details for Hardware Delivery */}
                {expandedItems['hardware-delivery'] && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Order Status</div>
                      <div className="text-sm text-gray-900">
                        {trainerData?.orderNSStatus || 'Not Available'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Shipping Address</div>
                      <div className="text-sm text-gray-900">
                        {(() => {
                          if (!trainerData?.orderShippingAddress) return 'Not Available';

                          // Handle if it's already a string
                          if (typeof trainerData.orderShippingAddress === 'string') {
                            return trainerData.orderShippingAddress;
                          }

                          // Handle if it's an address object
                          const addr = trainerData.orderShippingAddress;
                          const parts = [
                            addr.street,
                            addr.city,
                            addr.state || addr.stateCode,
                            addr.postalCode,
                            addr.country || addr.countryCode
                          ].filter(Boolean);

                          return parts.length > 0 ? parts.join(', ') : 'Not Available';
                        })()}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tracking Link</div>
                        {trainerData?.trackingLink ? (
                          <a
                            href={trainerData.trackingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm inline-flex items-center gap-1"
                          >
                            Track Package
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-sm text-gray-500">No tracking available</span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span>Hardware Shipment Date</span>
                          <div className="relative group">
                            <svg
                              className="w-3.5 h-3.5 text-gray-400 cursor-help"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            {/* Tooltip */}
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded py-2 px-3 z-10 normal-case">
                              Shipment date can only be set by StoreHub Onboarding Manager. Contact your Onboarding Manager to set the date.
                              <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-900">
                          {trainerData?.hardwareFulfillmentDate
                            ? formatDate(trainerData.hardwareFulfillmentDate)
                            : 'Not Scheduled'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Product Setup */}
            <div className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="p-3">
                <button
                  onClick={() => toggleItemExpansion('product-setup')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const productComplete = trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve';
                      const inProgress = !!trainerData?.menuCollectionSubmissionTimestamp && !productComplete;

                      if (productComplete) {
                        return (
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        );
                      } else if (inProgress) {
                        return (
                          <div className="w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                          </div>
                        );
                      } else {
                        return (
                          <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        );
                      }
                    })()}
                    <div className="text-sm font-medium text-gray-900">{terminology.setupLabel}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-gray-500">
                      {(() => {
                        if (trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve') return 'Completed';
                        if (trainerData?.menuCollectionSubmissionTimestamp) return <span className="text-orange-600">{terminology.submittedStatus}</span>;
                        return <span className="text-orange-600">{terminology.pendingStatus}</span>;
                      })()}
                    </div>
                    <svg className={`w-4 h-4 transition-transform text-gray-400 ${expandedItems['product-setup'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Details for Product Setup */}
                {expandedItems['product-setup'] && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    {/* Menu Submission Deadline Notice - Desktop */}
                    <ImportantReminderBox
                      type="product-list"
                      installationDate={trainerData?.actualInstallationDate}
                      trainingDate={trainerData?.trainingDate}
                      isCompleted={!!trainerData?.menuCollectionSubmissionTimestamp}
                      collectionName={terminology.collectionName}
                    />

                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{terminology.collectionFormLabel}</div>
                      {trainerData?.menuCollectionFormLink ? (
                        <a
                          href={trainerData.menuCollectionFormLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={handleProductSetupClick}
                          className="inline-flex items-center px-4 py-2 bg-[#ff630f] hover:bg-[#fe5b25] text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          {terminology.submitButtonText}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500">Form link not available</span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{terminology.submissionTimestampLabel}</div>
                      <div className="text-sm text-gray-900">
                        {trainerData?.menuCollectionSubmissionTimestamp
                          ? formatDateTime(trainerData.menuCollectionSubmissionTimestamp)
                          : 'Not Submitted'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span>{terminology.completedSetupLabel}</span>
                        <div className="relative group">
                          <svg
                            className="w-3.5 h-3.5 text-gray-400 cursor-help"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          {/* Tooltip */}
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded py-2 px-3 z-10 normal-case">
                            {terminology.tooltipText}
                            <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {trainerData?.completedProductSetup || 'No'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Store Setup */}
            <div className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="p-3">
                <button
                  onClick={() => toggleItemExpansion('store-setup')}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      // Store setup is completed when video link exists and is not "NA"
                      const storeSetupComplete = !!trainerData?.videoProofLink && trainerData?.videoProofLink !== 'NA';

                      return storeSetupComplete ? (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      );
                    })()}
                    <div className="text-sm font-medium text-gray-900">Store Setup</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-gray-500">
                      {((trainerData?.videoProofLink && trainerData?.videoProofLink !== 'NA') || uploadedVideoUrl) ? (
                        <span>Completed</span>
                      ) : (
                        <span className="text-orange-600">Pending Upload</span>
                      )}
                    </div>
                    <svg className={`w-4 h-4 transition-transform text-gray-400 ${expandedItems['store-setup'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Details for Store Setup */}
                {expandedItems['store-setup'] && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-4">
                    {/* Store Setup Video Deadline Notice - Desktop */}
                    <ImportantReminderBox
                      type="store-setup"
                      installationDate={trainerData?.installationDate}
                      isCompleted={!!(trainerData?.videoProofLink && trainerData?.videoProofLink !== 'NA')}
                    />

                    {/* CTA Section - Most Prominent */}
                    <div className="space-y-3">
                      {(trainerData?.videoProofLink || uploadedVideoUrl) && (
                        <div className="flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-gray-700">Video uploaded - </span>
                          <a href={uploadedVideoUrl || trainerData?.videoProofLink} target="_blank" rel="noopener noreferrer"
                             className="text-blue-600 hover:text-blue-700 underline">
                            View Video
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                          <input
                            id={`store-video-upload-${trainerData?.id}`}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return

                              setUploadingVideo(true)
                              try {
                                const formData = new FormData()
                                formData.append('file', file)
                                formData.append('trainerId', trainerData?.id || '')

                                const response = await fetch('/api/salesforce/upload-video', {
                                  method: 'POST',
                                  body: formData
                                })

                                if (!response.ok) {
                                  const error = await response.json()
                                  throw new Error(error.details || error.error || 'Failed to upload video')
                                }

                                const result = await response.json()
                                setUploadedVideoUrl(result.fileUrl)

                                if (onBookingComplete) {
                                  onBookingComplete()
                                }
                              } catch (error) {
                                console.error('Error uploading video:', error)
                                alert(error instanceof Error ? error.message : 'Failed to upload video')
                              } finally {
                                setUploadingVideo(false)
                                e.target.value = ''
                              }
                            }}
                          />
                        <button
                          onClick={() => document.getElementById(`store-video-upload-${trainerData?.id}`)?.click()}
                          disabled={uploadingVideo}
                          className="inline-flex items-center px-4 py-2 bg-[#ff630f] hover:bg-[#fe5b25] disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                          </svg>
                          {uploadingVideo ? 'Uploading...' : (trainerData?.videoProofLink || uploadedVideoUrl ? 'Replace Video' : 'Upload Video')}
                        </button>
                      </div>
                    </div>

                    {/* Simplified Info Section */}
                    <div className="space-y-4 text-sm text-gray-700">
                      {/* Section 1: How to set up the store */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="font-semibold text-gray-900 mb-2">1. How to set up the store:</p>
                        <a href="https://drive.google.com/file/d/1vPr7y0VdD6sKaKG_h8JbwNi0RBE16xdc/view"
                           target="_blank" rel="noopener noreferrer"
                           className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
                          📖 Guide for your store network setup (cabling and wiring)
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>

                      {/* Section 2: How to record video */}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="font-semibold text-gray-900 mb-3">2. How to record video:</p>
                        <div className="space-y-2 mb-3">
                          <p className="text-gray-700">Show us 3 things at each location:</p>
                          <p className="text-gray-700"><span className="font-semibold">Main Counter:</span> Terminal & receipt printer location, Power socket, LAN port</p>
                          <p className="text-gray-700"><span className="font-semibold">Kitchen/Other Stations:</span> Printer location, Power socket, LAN port</p>
                        </div>
                        <p className="text-blue-700 font-medium">📱 Quick Tip: Hold your phone sideways (horizontally) while recording!</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Desktop Only: Welcome Stage Details */}
      {selectedStage === 'welcome' && (
        <div id="stage-welcome" className="hidden md:block">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Welcome to StoreHub</span>
            {(trainerData?.welcomeCallStatus === 'Welcome Call Completed' || trainerData?.welcomeCallStatus === 'Completed') &&
              <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Completed</span>
            }
          </h4>

          <div className="space-y-4">
            {/* Welcome Call Status */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Welcome Call Status</div>
              <div className="text-sm font-medium">
                {trainerData?.welcomeCallStatus ? (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    trainerData.welcomeCallStatus === 'Welcome Call Completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {trainerData.welcomeCallStatus}
                  </span>
                ) : (
                  <span className="text-gray-500">Not Set</span>
                )}
              </div>
            </div>

            {/* First Call Timestamp */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">First Call Timestamp</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.firstCallTimestamp
                  ? formatDateTime(trainerData.firstCallTimestamp)
                  : 'Not Recorded'}
              </div>
            </div>

            {/* Onboarding Manager Name */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Onboarding Manager Name</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.msmName || 'Not Assigned'}
              </div>
            </div>

            {/* Welcome Call Summary */}
            <div className="mt-6 pt-4 border-t border-gray-300">
              <h5 className="text-md font-semibold text-gray-900 mb-3">Welcome Call Summary:</h5>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">• Go live date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {trainerData?.plannedGoLiveDate
                      ? formatDate(trainerData.plannedGoLiveDate)
                      : 'Not Set'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">• Hardware delivery date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {trainerData?.hardwareFulfillmentDate
                      ? formatDate(trainerData.hardwareFulfillmentDate)
                      : 'Not Set'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">• Installation date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateTime(trainerData?.installationDate)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">• Training Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateTime(trainerData?.trainingDate)}
                  </span>
                </div>
              </div>
            </div>


          </div>
        </div>
      )}

      {/* Desktop Only: Installation Stage Details */}
      {selectedStage === 'installation' && (
        <div id="stage-installation" className="hidden md:block">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Installation</span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              installationCompleted ? 'bg-green-100 text-green-800' :
              trainerData?.installationDate ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {installationCompleted ? 'Completed' : trainerData?.installationDate ? 'Scheduled' : 'Not Started'}
            </span>
          </h4>

          <div className="space-y-4">
            {/* Installation Date - Editable */}
            <div>
              {(() => {
                // Check if external vendor using installerType from API
                const installerType = (trainerData as any)?.installerType
                const isExternalVendor = installerType === 'external'
                return (
                  <>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      {isExternalVendor ? 'Proposed Installation Date' : 'Scheduled Installation Date'}
                    </div>
                    {isExternalVendor && (
                      <div className="text-xs text-gray-500 mb-1 italic">
                        Vendor will confirm directly to finalise the date
                      </div>
                    )}
                  </>
                )
              })()}
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.installationDate
                      ? formatDateTime(trainerData.installationDate)
                      : 'Not Scheduled'}
                  </div>
                  {(() => {
                    const cannotReschedule = trainerData?.installationDate && isWithinNextDay(trainerData.installationDate)
                    // If date is already set, allow them to change it (don't block for prerequisites)
                    const hasExistingDate = !!trainerData?.installationDate
                    const isButtonDisabled = cannotReschedule || (!canScheduleInstallation && !hasExistingDate)
                    return (
                      <button
                        onClick={() => !isButtonDisabled && handleBookingClick('installation', trainerData?.installationDate)}
                        disabled={isButtonDisabled}
                        className={`inline-flex items-center px-3 py-2 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg ${
                          isButtonDisabled
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-[#ff630f] hover:bg-[#fe5b25] active:scale-95'
                        }`}
                        title={cannotReschedule ? 'Rescheduling must be done at least 2 days in advance' : (!canScheduleInstallation && !hasExistingDate) ? 'Store Setup Video must be submitted first' : ''}
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {trainerData?.installationDate ? 'Change Date' : 'Schedule'}
                      </button>
                    )
                  })()}
                </div>
                {(() => {
                  const cannotReschedule = trainerData?.installationDate && isWithinNextDay(trainerData.installationDate)
                  const hasExistingDate = !!trainerData?.installationDate
                  if (!canScheduleInstallation && !hasExistingDate) {
                    return (
                      <div className="mt-2 text-sm text-amber-600">
                        Please submit your Store Setup Video before scheduling installation.
                      </div>
                    )
                  }
                  return cannotReschedule ? (
                    <div className="mt-2 text-sm text-gray-600">
                      To reschedule, please contact your onboarding manager
                    </div>
                  ) : null
                })()}
              </div>
            </div>

            {/* Installer Name */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Installer Name</div>
              <div className="text-sm font-medium text-gray-900">
                {(() => {
                  // If installer name is set, show it
                  if (trainerData?.installerName) {
                    return trainerData.installerName
                  }
                  // If installation date is set but no installer name, check installer type
                  if (trainerData?.installationDate) {
                    // Use installerType from parent trainerData object (not nested in trainers array)
                    const installerType = (trainerData as any)?.installerType
                    return installerType === 'external' ? 'External Vendor' : 'Not Assigned'
                  }
                  return 'Not Assigned'
                })()}
              </div>
            </div>

            {/* Store Address from Onboarding_Trainer__c */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Store Address</div>
              <div className="text-sm font-medium text-gray-900">
                {(() => {
                  // Build full address from Onboarding_Trainer__c shipping fields
                  const parts = [
                    trainerData?.shippingStreet,
                    trainerData?.shippingCity,
                    trainerData?.shippingState,
                    trainerData?.shippingZipPostalCode,
                    trainerData?.shippingCountry
                  ].filter(Boolean);
                  
                  return parts.length > 0 ? parts.join(', ') : 'Not Available';
                })()}
              </div>
            </div>

            {/* Actual Installation Date */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Actual Installation Date</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.actualInstallationDate
                  ? formatDate(trainerData.actualInstallationDate)
                  : 'Not Completed'}
              </div>
            </div>

            {/* Installation Issues Elaboration */}
            {trainerData?.installationIssuesElaboration && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Installation Issues</div>
                <div className="text-sm text-gray-900 bg-red-50 border border-red-200 rounded p-2">
                  {trainerData.installationIssuesElaboration}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Desktop Only: Training Stage Details */}
      {selectedStage === 'training' && (
        <div id="stage-training" className="hidden md:block">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Training</span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              trainingCompleted ? 'bg-green-100 text-green-800' :
              trainerData?.trainingDate ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {trainingCompleted ? 'Completed' : trainerData?.trainingDate ? 'Scheduled' : 'Not Started'}
            </span>
          </h4>

          <div className="space-y-4">
            {/* Training Date - Editable */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Training Date</div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.trainingDate
                      ? formatDateTime(trainerData.trainingDate)
                      : 'Not Scheduled'}
                  </div>
                  {(() => {
                    const cannotReschedule = trainerData?.trainingDate && isWithinNextDay(trainerData.trainingDate)
                    // If date is already set, allow them to change it (don't block for prerequisites)
                    const hasExistingDate = !!trainerData?.trainingDate
                    const isButtonDisabled = cannotReschedule || (!canScheduleTraining && !hasExistingDate)
                    return (
                      <button
                        onClick={() => !isButtonDisabled && handleBookingClick('training', trainerData?.trainingDate)}
                        disabled={isButtonDisabled}
                        className={`inline-flex items-center px-3 py-2 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg ${
                          isButtonDisabled
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-[#ff630f] hover:bg-[#fe5b25] active:scale-95'
                        }`}
                        title={cannotReschedule ? 'Rescheduling must be done at least 2 days in advance' : (!canScheduleTraining && !hasExistingDate) ? `${terminology.collectionName.charAt(0).toUpperCase() + terminology.collectionName.slice(1)} must be submitted and Installation must be scheduled first` : ''}
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {trainerData?.trainingDate ? 'Change Date' : 'Schedule'}
                      </button>
                    )
                  })()}
                </div>
                {(() => {
                  const cannotReschedule = trainerData?.trainingDate && isWithinNextDay(trainerData.trainingDate)
                  const hasExistingDate = !!trainerData?.trainingDate
                  if (!productListSubmitted && !hasExistingDate) {
                    return (
                      <div className="mt-2 text-sm text-amber-600">
                        Please submit your {terminology.collectionName} before scheduling training.
                      </div>
                    )
                  }
                  if (!installationDateSet && !hasExistingDate) {
                    return (
                      <div className="mt-2 text-sm text-amber-600">
                        Please schedule installation first before scheduling training.
                      </div>
                    )
                  }
                  return cannotReschedule ? (
                    <div className="mt-2 text-sm text-gray-600">
                      To reschedule, please contact your onboarding manager
                    </div>
                  ) : null
                })()}
              </div>
            </div>

            {/* Remote Training Meeting Link - Only for Remote Training */}
            {trainerData?.onboardingServicesBought?.toLowerCase().includes('remote') && trainerData?.remoteTrainingMeetingLink && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Remote Training Meeting Link</div>
                <div className="flex items-center gap-3">
                  <a
                    href={trainerData.remoteTrainingMeetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Join Training
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(trainerData?.remoteTrainingMeetingLink || '');
                      alert('Meeting link copied to clipboard!');
                    }}
                    className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    title="Copy meeting link"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Link
                  </button>
                  <div className="text-xs text-gray-500 font-mono truncate max-w-md">
                    {trainerData.remoteTrainingMeetingLink}
                  </div>
                </div>
              </div>
            )}

            {/* Training Type */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Training Type</div>
              <div className="text-sm font-medium text-gray-900">
                {(() => {
                  const serviceType = detectServiceType(trainerData?.onboardingServicesBought)
                  const merchantState = trainerData?.shippingState || trainerData?.shippingCity || ''
                  console.log('🏷️ Training Type Debug (Desktop):', {
                    onboardingServicesBought: trainerData?.onboardingServicesBought,
                    shippingState: trainerData?.shippingState,
                    shippingCity: trainerData?.shippingCity,
                    serviceType,
                    merchantState
                  })
                  return getServiceTypeMessage(serviceType, merchantState)
                })()}
              </div>
            </div>

            {/* Trainer Name - Only show if training date exists */}
            {trainerData?.trainingDate && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Trainer Name</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.csmName || 'Not Assigned'}
                </div>
              </div>
            )}

            {/* Preferred Language */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Preferred Language</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.preferredLanguage || 'Not Specified'}
              </div>
            </div>

            {/* Store Address from Onboarding_Trainer__c - Only for Onsite Training */}
            {!trainerData?.onboardingServicesBought?.toLowerCase().includes('remote') && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Store Address</div>
                <div className="text-sm font-medium text-gray-900">
                  {(() => {
                    // Build full address from Onboarding_Trainer__c shipping fields
                    const parts = [
                      trainerData?.shippingStreet,
                      trainerData?.shippingCity,
                      trainerData?.shippingState,
                      trainerData?.shippingZipPostalCode,
                      trainerData?.shippingCountry
                    ].filter(Boolean);

                    return parts.length > 0 ? parts.join(', ') : 'Not Available';
                  })()}
                </div>
              </div>
            )}

            {/* Training Completed Status */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Training Completed</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.completedTraining ? 'Yes' : 'No'}
              </div>
            </div>

            {/* Required Features by Merchant */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Required Features by Merchant</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.requiredFeaturesByMerchant || 'None Specified'}
              </div>
            </div>

            {/* Onboarding Services Bought */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Onboarding Services Bought</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.onboardingServicesBought || 'None'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Only: Ready to Go Live Stage Details */}
      {selectedStage === 'ready-go-live' && (
        <div id="stage-ready-go-live" className="hidden md:block">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Ready to Go Live</span>
            {(() => {
              // Ready to Go Live is done when all previous stages are completed
              const allDone = welcomeCompleted &&
                             preparationStatus === 'completed' &&
                             installationCompleted &&
                             trainingCompleted;

              return (
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  allDone ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {allDone ? 'Ready' : 'In Progress'}
                </span>
              );
            })()}
          </h4>

          <div className="space-y-4">
            {/* Checklist Items */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h5 className="text-sm font-semibold text-gray-900 mb-3">Go-Live Readiness Checklist</h5>
              <div className="space-y-3">
                {/* Hardware Fulfillment */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {trainerData?.trackingLink ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span className="text-base text-gray-700">Hardware Delivered</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {trainerData?.hardwareFulfillmentDate
                      ? formatDate(trainerData.hardwareFulfillmentDate)
                      : 'Pending'}
                  </span>
                </div>

                {/* Product Setup */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve') ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span className="text-base text-gray-700">Product Setup Completed</span>
                  </div>
                  <span className="text-sm">
                    {(() => {
                      if (trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve') {
                        return <span className="text-gray-500">Completed</span>;
                      } else if (trainerData?.menuCollectionSubmissionTimestamp) {
                        return <span className="text-orange-600">{terminology.submittedStatus}</span>;
                      } else {
                        return <span className="text-orange-600">{terminology.pendingStatus}</span>;
                      }
                    })()}
                  </span>
                </div>

                {/* Installation */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {installationCompleted ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span className="text-base text-gray-700">Hardware Installation Completed</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {installationCompleted ? 'Completed' : trainerData?.installationDate ? 'Scheduled' : 'Pending'}
                  </span>
                </div>

                {/* Training */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {trainingCompleted ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span className="text-base text-gray-700">Training Completed</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {trainingCompleted ? 'Completed' : trainerData?.trainingDate ? 'Scheduled' : 'Pending'}
                  </span>
                </div>

                {/* Subscription Activation */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {trainerData?.subscriptionActivationDate ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span className="text-base text-gray-700">Subscription Activated</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {trainerData?.subscriptionActivationDate
                      ? formatDate(trainerData.subscriptionActivationDate)
                      : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Subscription Activation Instruction */}
            {trainerData?.boAccountName && !trainerData?.subscriptionActivationDate && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-semibold text-orange-900 mb-1">Action Required: Activate Subscription</h5>
                    <p className="text-sm text-orange-800 mb-2">
                      Please activate the merchant's subscription at:
                    </p>
                    <a
                      href={`https://${trainerData.boAccountName}.storehubhq.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                    >
                      {trainerData.boAccountName}.storehubhq.com
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <div className="mt-3 pt-3 border-t border-orange-200">
                      <p className="text-xs text-orange-700 mb-1">Need help with activation?</p>
                      <a
                        href="https://care.storehub.com/en/articles/10650521-manage-subscription-how-to-self-activate-your-account"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        View activation guide
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop Only: Live Stage Details */}
      {selectedStage === 'live' && (
        <div id="stage-live" className="hidden md:block">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Live</span>
            {(trainerData?.posQrDeliveryTnxCount ?? 0) > 30 &&
              <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Live</span>
            }
          </h4>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
              <div className="text-sm font-medium">
                {(trainerData?.posQrDeliveryTnxCount ?? 0) > 30 ? (
                  <span className="text-green-600">✅ Merchant is Live</span>
                ) : (
                  <span className="text-gray-500">⏳ Awaiting Go-Live</span>
                )}
              </div>
            </div>

            {/* BackOffice Account Name */}
            {trainerData?.boAccountName && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">BackOffice Account</div>
                <a
                  href={`https://${trainerData.boAccountName}.storehubhq.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#ff630f] hover:text-[#e55a0e] transition-colors"
                >
                  <span>{trainerData.boAccountName}.storehubhq.com</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            {/* Onboarding Survey Link */}
            {trainerData?.boAccountName && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Onboarding Survey</div>
                <a
                  href={`https://storehub.sg.larksuite.com/share/base/form/shrlgoT9OUwf6B1w5bdBSQTOCeb?prefill_Your+BackOffice+Account+Name=${encodeURIComponent(trainerData.boAccountName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#ff630f] hover:text-[#e55a0e] transition-colors"
                >
                  <span>Share Your Feedback</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <p className="text-xs text-gray-500 mt-1">Help us improve your onboarding experience</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop Only: Simple placeholder for other stages */}
      {selectedStage !== 'preparation' && selectedStage !== 'welcome' && selectedStage !== 'installation' &&
       selectedStage !== 'training' && selectedStage !== 'ready-go-live' && selectedStage !== 'live' && (
        <div className="hidden md:block">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            {stages.find(s => s.id === selectedStage)?.label || 'Stage Details'}
          </h4>
          <p className="text-sm text-gray-600">
            Detailed view for {selectedStage} stage will be implemented here.
          </p>
        </div>
      )}
    </div>
  )
}
