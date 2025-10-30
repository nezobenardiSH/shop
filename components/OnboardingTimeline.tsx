'use client'

import { useState, useEffect } from 'react'

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
  stageData?: any
  trainerData?: any
  onBookingComplete?: (selectedDate?: string) => void
  onOpenBookingModal?: (bookingInfo: any) => void
}

// Helper function to format date with time
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Not Set'

  const date = new Date(dateString)
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

// Helper function to format date only (dd/mm/yyyy)
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Not Set'

  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export default function OnboardingTimeline({ currentStage, stageData, trainerData, onBookingComplete, onOpenBookingModal }: OnboardingTimelineProps) {
  const [stages, setStages] = useState<TimelineStage[]>([])

  // Calculate completion statuses at component level so they can be used throughout
  // Welcome stage is completed only when Welcome_Call_Status__c = 'Welcome Call Completed'
  const welcomeCompleted = trainerData?.welcomeCallStatus === 'Welcome Call Completed'

  // Preparation sub-stages
  // Hardware delivery is completed when tracking link is provided
  const hardwareDeliveryCompleted = !!trainerData?.trackingLink
  const productSetupCompleted = trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve'
  const storeSetupCompleted = !!trainerData?.videoProofLink

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

  // Initialize selectedStage based on welcome call completion status
  const initialStage = (trainerData?.welcomeCallStatus === 'Welcome Call Completed' ||
                        trainerData?.welcomeCallStatus === 'Completed') ? 'preparation' : 'welcome'
  const [selectedStage, setSelectedStage] = useState<string>(initialStage)
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

    // If welcome is completed, automatically set selected stage to preparation
    if (welcomeCompleted && selectedStage === 'welcome') {
      setSelectedStage('preparation')
    }

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
    timelineStages.push({
      id: 'installation',
      label: 'Installation',
      status: preparationStatus === 'completed' ? (installationCompleted ? 'completed' : 'current') : 'pending',
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
      status: readyToGoLive ? (isLive ? 'completed' : 'current') : 'pending',
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
      trainerDataKeys: Object.keys(trainerData || {})
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
                  ? new Date(trainerData.firstCallTimestamp).toLocaleString()
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
                      ? new Date(trainerData.plannedGoLiveDate).toLocaleDateString()
                      : 'Not Set'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Hardware delivery:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {trainerData?.hardwareFulfillmentDate
                      ? new Date(trainerData.hardwareFulfillmentDate).toLocaleDateString()
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
                    const isInProgress = trainerData?.hardwareFulfillmentDate && !isDelivered;
                    
                    if (isDelivered) {
                      return (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      );
                    } else if (isInProgress) {
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
                    <div className="text-sm text-gray-500 text-left">
                      {(() => {
                        if (trainerData?.hardwareDeliveryStatus === 'Delivered') return 'Delivered';
                        if (trainerData?.trackingLink) return 'In Transit';
                        if (trainerData?.hardwareFulfillmentDate) return 'Scheduled';
                        return 'Pending';
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
                          Fulfillment date can only be set by StoreHub Onboarding Manager
                          <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                    <div className="text-base text-gray-900">
                      {trainerData?.hardwareFulfillmentDate
                        ? new Date(trainerData.hardwareFulfillmentDate).toLocaleDateString()
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
                    <div className="text-base font-medium text-gray-900 text-left">Product Setup</div>
                    <div className="text-sm text-gray-500 text-left">
                      {(() => {
                        if (trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve') return 'Completed';
                        if (trainerData?.menuCollectionSubmissionTimestamp) return 'In Progress';
                        return 'Pending';
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
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1 text-left">Menu Collection Form</div>
                    {trainerData?.menuCollectionFormLink ? (
                      <a href={trainerData.menuCollectionFormLink} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center px-2 py-1 bg-[#ff630f] hover:bg-[#fe5b25] text-white text-xs font-medium rounded transition-all duration-200">
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
                        ? new Date(trainerData.menuCollectionSubmissionTimestamp).toLocaleString()
                        : 'Not Submitted'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span>Completed Product Setup</span>
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
                          Product setup will be completed within 3 days of menu submission
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
                    <div className="text-sm text-gray-500 text-left">
                      {trainerData?.videoProofLink || uploadedVideoUrl ? 'Video Uploaded' : 'Pending Upload'}
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
                <div className="pl-12 pr-4 pb-4 space-y-3 pt-3 text-left">
                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1 text-left">Store Setup Guide</div>
                    <a href="https://drive.google.com/file/d/1vPr7y0VdD6sKaKG_h8JbwNi0RBE16xdc/view"
                       target="_blank" rel="noopener noreferrer"
                       className="inline-block text-base text-blue-600 hover:text-blue-700">
                      View Setup Guide
                    </a>
                  </div>

                  {/* Video Checklist Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                    <div className="text-sm font-semibold text-blue-900">
                      📱 Quick Tip: Hold your phone sideways (horizontally) while recording! Landscape mode works best. ↔️
                    </div>

                    <div className="text-sm font-semibold text-gray-900 mt-3">
                      Your 1-Minute Video Checklist
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      In one continuous video, please walk us through these 3 stops:
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="bg-white rounded p-3 border border-blue-100">
                        <div className="font-semibold text-gray-900 mb-1">Stop 1: Your Main Counter</div>
                        <ul className="list-disc list-inside text-gray-700 space-y-0.5 ml-2">
                          <li><span className="font-medium">Show us:</span> Where your new terminal and receipt printer will go.</li>
                          <li><span className="font-medium">Zoom in on:</span> The nearby power sockets and LAN port.</li>
                          <li><span className="font-medium">Say:</span> "Counter ready!"</li>
                        </ul>
                      </div>

                      <div className="bg-white rounded p-3 border border-blue-100">
                        <div className="font-semibold text-gray-900 mb-1">Stop 2: Your Kitchen</div>
                        <ul className="list-disc list-inside text-gray-700 space-y-0.5 ml-2">
                          <li><span className="font-medium">Show us:</span> The spot for your kitchen printer.</li>
                          <li><span className="font-medium">Zoom in on:</span> Its dedicated power socket and LAN port.</li>
                          <li><span className="font-medium">Say:</span> "Kitchen ready!" <span className="text-gray-500">(If you have more than one kitchen printer, please show each spot.)</span></li>
                        </ul>
                      </div>

                      <div className="bg-white rounded p-3 border border-blue-100">
                        <div className="font-semibold text-gray-900 mb-1">Stop 3: Your Bar (if applicable)</div>
                        <ul className="list-disc list-inside text-gray-700 space-y-0.5 ml-2">
                          <li><span className="font-medium">Show us:</span> The spot for your bar printer.</li>
                          <li><span className="font-medium">Zoom in on:</span> Its power socket and LAN port.</li>
                          <li><span className="font-medium">Say:</span> "Bar ready!"</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Video Proof Status</div>
                    <div className="text-base text-gray-900">
                      {trainerData?.videoProofLink || uploadedVideoUrl ? 'Uploaded' : 'Pending Upload'}
                    </div>
                  </div>
                  {(trainerData?.videoProofLink || uploadedVideoUrl) && (
                    <a href={uploadedVideoUrl || trainerData?.videoProofLink} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-blue-600 hover:text-blue-700">
                      View Video
                    </a>
                  )}
                  <div>
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
                      className="px-2 py-1 bg-[#ff630f] hover:bg-[#fe5b25] disabled:bg-gray-400 text-white text-xs font-medium rounded transition-all duration-200"
                    >
                      {uploadingVideo ? 'Uploading...' : (trainerData?.videoProofLink || uploadedVideoUrl ? 'Replace Video' : 'Upload Video')}
                    </button>
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
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Scheduled Installation Date</div>
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-gray-900">
                  {trainerData?.installationDate
                    ? formatDateTime(trainerData.installationDate)
                    : 'Not Scheduled'}
                </span>
                {(() => {
                  const isPastDate = trainerData?.installationDate && new Date(trainerData.installationDate) < new Date()
                  return (
                    <button
                      onClick={() => !isPastDate && handleBookingClick('installation', trainerData?.installationDate)}
                      disabled={isPastDate}
                      className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 ${
                        isPastDate
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-[#ff630f] hover:bg-[#fe5b25]'
                      }`}
                    >
                      {trainerData?.installationDate ? 'Reschedule' : 'Schedule'}
                    </button>
                  )
                })()}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Assigned Installer</div>
              <div className="text-base font-medium text-gray-900">
                {trainerData?.installerName || 'Not Assigned'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Installation ST Ticket No</div>
              <div className="text-base font-medium text-gray-900">
                {trainerData?.installationSTTicketNo || 'Not Available'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Store Address</div>
              <div className="text-base font-medium text-gray-900">
                {trainerData?.merchantLocation || 'Not Available'}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Actual Installation Date</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.actualInstallationDate
                  ? new Date(trainerData.actualInstallationDate).toLocaleDateString()
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

            {/* Merchant Location */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Merchant Location</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.merchantLocation || 'Not Available'}
              </div>
            </div>
          </div>
        )
      
      case 'training':
        return (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Training Date</div>
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-gray-900">
                  {trainerData?.trainingDate
                    ? formatDateTime(trainerData.trainingDate)
                    : 'Not Scheduled'}
                </span>
                {(() => {
                  const isPastDate = trainerData?.trainingDate && new Date(trainerData.trainingDate) < new Date()
                  return (
                    <button
                      onClick={() => !isPastDate && handleBookingClick('training', trainerData?.trainingDate)}
                      disabled={isPastDate}
                      className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 ${
                        isPastDate
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-[#ff630f] hover:bg-[#fe5b25]'
                      }`}
                    >
                      {trainerData?.trainingDate ? 'Reschedule' : 'Schedule'}
                    </button>
                  )
                })()}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Trainer Name</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.csmName || 'Not Assigned'}
              </div>
            </div>

            {/* Merchant Location */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Merchant Location</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.merchantLocation || 'Not Available'}
              </div>
            </div>

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
                {trainerData?.onboardingServicesBought || 'Standard Package'}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Training Completion Status</div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                trainerData?.completedTraining === 'Yes' ? 'bg-green-100 text-green-800' :
                trainerData?.completedTraining === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                trainerData?.completedTraining === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {trainerData?.completedTraining === 'Yes' ? 'Completed' : 
                 trainerData?.completedTraining || 'Not Started'}
              </span>
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
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex-1 relative">
              <div
                className={`cursor-pointer transition-all duration-200 rounded-lg p-2 -m-2 ${
                  selectedStage === stage.id
                    ? 'bg-orange-50 shadow-sm'
                    : 'hover:bg-white hover:shadow-sm'
                }`}
                onClick={() => setSelectedStage(stage.id)}
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
                            if (stage.completedCount !== undefined && stage.totalCount !== undefined) {
                              return `${stage.completedCount}/${stage.totalCount} Completed`
                            }
                            return 'In Progress'
                          case 'installation':
                            if (stage.status === 'completed') return 'Completed'
                            if (stage.status === 'current') return 'In Progress'
                            // Show "Not Started" with date if scheduled
                            return trainerData?.installationDate
                              ? `Not Started • ${formatDate(trainerData.installationDate)}`
                              : 'Not Started • Not Scheduled'
                          case 'training':
                            if (stage.status === 'completed') return 'Completed'
                            if (stage.status === 'current') return 'In Progress'
                            // Show "Not Started" with date if scheduled
                            const trainingDate = trainerData?.posTrainingDate || trainerData?.backOfficeTrainingDate || trainerData?.trainingDate
                            return trainingDate
                              ? `Not Started • ${formatDate(trainingDate)}`
                              : 'Not Started • Not Scheduled'
                          case 'ready-go-live':
                            if (stage.status === 'completed') return 'Ready'
                            if (stage.completedCount !== undefined && stage.totalCount !== undefined) {
                              return `${stage.completedCount}/${stage.totalCount} Completed`
                            }
                            return stage.status === 'current' ? 'Preparing' : 'Not Started'
                          case 'live':
                            // Show "Overdue" if Days to Go Live < 0 and not on Live stage
                            // Show "Done" if Days to Go Live < 0 and on Live stage
                            // Calculate days to go live on client side
                            const daysToGoLive = trainerData?.plannedGoLiveDate
                              ? Math.ceil((new Date(trainerData.plannedGoLiveDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                              : null
                            if (daysToGoLive !== null && daysToGoLive < 0) {
                              return stage.status === 'completed' ? 'Done' : 'Overdue'
                            }
                            return stage.status === 'completed' ? 'Live' : stage.status === 'current' ? 'Going Live' : 'Not Started'
                          default:
                            return ''
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: Vertical Timeline with Expandable Drawers */}
      <div className="md:hidden">
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div key={stage.id} className="relative">
              {/* Connector Line */}
              {index < stages.length - 1 && (
                <div className="absolute left-[16px] top-12 bottom-0 w-0.5 bg-gray-300" />
              )}
              
              {/* Stage Item */}
              <div className="relative">
                <button
                  onClick={() => toggleMobileStage(stage.id)}
                  className="w-full text-left py-2 px-1 -mx-1 rounded-lg hover:bg-gray-50 transition-colors"
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
                                // Show "Overdue" if Days to Go Live < 0 and not on Live stage
                                // Show "Done" if Days to Go Live < 0 and on Live stage
                                // Calculate days to go live on client side
                                const daysToGoLive = trainerData?.plannedGoLiveDate
                                  ? Math.ceil((new Date(trainerData.plannedGoLiveDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                  : null
                                if (daysToGoLive !== null && daysToGoLive < 0) {
                                  return stage.status === 'completed' ? 'Done' : 'Overdue'
                                }
                                return stage.status === 'completed' ? 'Live' : stage.status === 'current' ? 'Going Live' : 'Not Started'
                              }
                              if (stage.completedCount !== undefined && stage.totalCount !== undefined) {
                                return `${stage.completedCount}/${stage.totalCount} Completed`
                              }
                              if (stage.completedDate) {
                                return formatDate(stage.completedDate)
                              }
                              // Show scheduled dates for Not Started stages
                              if (stage.status === 'pending') {
                                let dateStr = 'Not Started'
                                if (stage.id === 'installation') {
                                  if (trainerData?.installationDate) {
                                    dateStr += ` • ${formatDate(trainerData.installationDate)}`
                                  } else {
                                    dateStr += ' • Not Scheduled'
                                  }
                                } else if (stage.id === 'training') {
                                  const trainingDate = trainerData?.posTrainingDate || trainerData?.backOfficeTrainingDate || trainerData?.trainingDate
                                  if (trainingDate) {
                                    dateStr += ` • ${formatDate(trainingDate)}`
                                  } else {
                                    dateStr += ' • Not Scheduled'
                                  }
                                }
                                return dateStr
                              }
                              return stage.status === 'current' ? 'In Progress' : ''
                            })()}
                          </p>
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
          ))}
        </div>
      </div>

      {/* Desktop Only: Preparation Status Overview - Prominent */}
      {selectedStage === 'preparation' && (
        <div className="hidden md:block">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Preparation</span>
            {(() => {
              // Use the same completion logic as defined at component level
              // Hardware delivery is completed when tracking link is provided
              const hardwareDeliveryCompleted = !!trainerData?.trackingLink;
              const productSetupCompleted = trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve';
              const storeSetupCompleted = !!trainerData?.videoProofLink;

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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      // Hardware Delivery is done when Hardware Fulfillment Date has passed
                      const hardwareComplete = trainerData?.hardwareFulfillmentDate
                        ? new Date(trainerData.hardwareFulfillmentDate) <= new Date()
                        : false;

                      return hardwareComplete ? (
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
                    <div className="text-sm font-medium text-gray-900">Hardware Delivery</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-gray-500">
                      Status: {(() => {
                        const hardwareComplete = trainerData?.hardwareFulfillmentDate
                          ? new Date(trainerData.hardwareFulfillmentDate) <= new Date()
                          : false;
                        return hardwareComplete ? 'Completed' : 'Pending';
                      })()}
                    </div>
                    <button
                      onClick={() => toggleItemExpansion('hardware-delivery')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className={`w-4 h-4 transition-transform ${expandedItems['hardware-delivery'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

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
                          <span>Hardware Fulfillment Date</span>
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
                              Fulfillment date can only be set by StoreHub Onboarding Manager
                              <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-900">
                          {trainerData?.hardwareFulfillmentDate
                            ? new Date(trainerData.hardwareFulfillmentDate).toLocaleDateString()
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
                <div className="flex items-center justify-between">
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
                    <div className="text-sm font-medium text-gray-900">Product Setup</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-gray-500">
                      Status: {(() => {
                        if (trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve') return 'Completed';
                        if (trainerData?.menuCollectionSubmissionTimestamp) return 'In Progress';
                        return 'Pending';
                      })()}
                    </div>
                    <button
                      onClick={() => toggleItemExpansion('product-setup')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className={`w-4 h-4 transition-transform ${expandedItems['product-setup'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Details for Product Setup */}
                {expandedItems['product-setup'] && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Menu Collection Form</div>
                      {trainerData?.menuCollectionFormLink ? (
                        <a
                          href={trainerData.menuCollectionFormLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 bg-[#ff630f] hover:bg-[#fe5b25] text-white text-sm font-medium rounded transition-all duration-200"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Submit Menu Collection Form
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500">Form link not available</span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Menu Collection Submission Timestamp</div>
                      <div className="text-sm text-gray-900">
                        {trainerData?.menuCollectionSubmissionTimestamp
                          ? new Date(trainerData.menuCollectionSubmissionTimestamp).toLocaleString()
                          : 'Not Submitted'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span>Completed Product Setup</span>
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
                            Product setup will be completed within 3 days of menu submission
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const storeSetupComplete = !!trainerData?.videoProofLink;

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
                      {trainerData?.videoProofLink || uploadedVideoUrl ? (
                        <span className="text-green-600 font-medium">✓ Video Uploaded</span>
                      ) : (
                        <span className="text-orange-600 font-medium">⏳ Pending Upload</span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleItemExpansion('store-setup')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className={`w-4 h-4 transition-transform ${expandedItems['store-setup'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Details for Store Setup */}
                {expandedItems['store-setup'] && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Store Setup Guide</div>
                      <div className="text-sm font-medium text-gray-900">
                        <a
                          href="https://drive.google.com/file/d/1vPr7y0VdD6sKaKG_h8JbwNi0RBE16xdc/view"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline inline-flex items-center gap-1"
                        >
                          Guide for your store network setup (cabling and wiring)
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>

                    {/* Video Checklist Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                      <div className="text-sm font-semibold text-blue-900">
                        📱 Quick Tip: Hold your phone sideways (horizontally) while recording! Landscape mode works best. ↔️
                      </div>

                      <div className="text-sm font-semibold text-gray-900 mt-2">
                        Your 1-Minute Video Checklist
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        In one continuous video, please walk us through these 3 stops:
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="bg-white rounded p-3 border border-blue-100">
                          <div className="font-semibold text-gray-900 mb-1">Stop 1: Your Main Counter</div>
                          <ul className="list-disc list-inside text-gray-700 space-y-0.5 ml-2">
                            <li><span className="font-medium">Show us:</span> Where your new terminal and receipt printer will go.</li>
                            <li><span className="font-medium">Zoom in on:</span> The nearby power sockets and LAN port.</li>
                            <li><span className="font-medium">Say:</span> "Counter ready!"</li>
                          </ul>
                        </div>

                        <div className="bg-white rounded p-3 border border-blue-100">
                          <div className="font-semibold text-gray-900 mb-1">Stop 2: Your Kitchen</div>
                          <ul className="list-disc list-inside text-gray-700 space-y-0.5 ml-2">
                            <li><span className="font-medium">Show us:</span> The spot for your kitchen printer.</li>
                            <li><span className="font-medium">Zoom in on:</span> Its dedicated power socket and LAN port.</li>
                            <li><span className="font-medium">Say:</span> "Kitchen ready!" <span className="text-gray-500">(If you have more than one kitchen printer, please show each spot.)</span></li>
                          </ul>
                        </div>

                        <div className="bg-white rounded p-3 border border-blue-100">
                          <div className="font-semibold text-gray-900 mb-1">Stop 3: Your Bar (if applicable)</div>
                          <ul className="list-disc list-inside text-gray-700 space-y-0.5 ml-2">
                            <li><span className="font-medium">Show us:</span> The spot for your bar printer.</li>
                            <li><span className="font-medium">Zoom in on:</span> Its power socket and LAN port.</li>
                            <li><span className="font-medium">Say:</span> "Bar ready!"</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Video Proof of Store Readiness</div>
                      <div className="space-y-2">
                        {/* Show existing video if available */}
                        {(trainerData?.videoProofLink || uploadedVideoUrl) && (
                          <div className="flex items-center gap-2">
                            <a
                              href={uploadedVideoUrl || trainerData?.videoProofLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 text-sm inline-flex items-center gap-1"
                            >
                              View Current Video
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}

                        {/* Always show upload button for new upload or replacement */}
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
                            className="inline-flex items-center px-2 py-1 bg-[#ff630f] hover:bg-[#fe5b25] disabled:bg-gray-400 text-white text-xs font-medium rounded transition-all duration-200 disabled:cursor-not-allowed"
                          >
                            {uploadingVideo ? 'Uploading...' : (trainerData?.videoProofLink || uploadedVideoUrl ? 'Replace Video' : 'Upload Store Setup Video')}
                          </button>
                        </div>
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
        <div className="hidden md:block">
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
                  ? new Date(trainerData.firstCallTimestamp).toLocaleString()
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
                      ? new Date(trainerData.plannedGoLiveDate).toLocaleDateString()
                      : 'Not Set'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">• Hardware delivery date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {trainerData?.hardwareFulfillmentDate
                      ? new Date(trainerData.hardwareFulfillmentDate).toLocaleDateString()
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
        <div className="hidden md:block">
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
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Scheduled Installation Date</div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.installationDate
                    ? formatDateTime(trainerData.installationDate)
                    : 'Not Scheduled'}
                </div>
                {(() => {
                  const isPastDate = trainerData?.installationDate && new Date(trainerData.installationDate) < new Date()
                  return (
                    <button
                      onClick={() => !isPastDate && handleBookingClick('installation', trainerData?.installationDate)}
                      disabled={isPastDate}
                      className={`inline-flex items-center px-2 py-1 text-white text-xs font-medium rounded transition-all duration-200 ${
                        isPastDate
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-[#ff630f] hover:bg-[#fe5b25]'
                      }`}
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {trainerData?.installationDate ? 'Reschedule' : 'Schedule'}
                    </button>
                  )
                })()}
              </div>
            </div>

            {/* Installer Name */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Assigned Installer</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.installerName || 'Not Assigned'}
              </div>
            </div>

            {/* Installation ST Ticket No */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Installation ST Ticket No</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.installationSTTicketNo || 'Not Available'}
              </div>
            </div>

            {/* Shipping Address from Order */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Store Address</div>
              <div className="text-sm font-medium text-gray-900">
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

            {/* Actual Installation Date */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Actual Installation Date</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.actualInstallationDate
                  ? new Date(trainerData.actualInstallationDate).toLocaleDateString()
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

            {/* Merchant Location */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Merchant Location</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.merchantLocation || 'Not Available'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Only: Training Stage Details */}
      {selectedStage === 'training' && (
        <div className="hidden md:block">
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
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.trainingDate
                    ? formatDateTime(trainerData.trainingDate)
                    : 'Not Scheduled'}
                </div>
                {(() => {
                  const isPastDate = trainerData?.trainingDate && new Date(trainerData.trainingDate) < new Date()
                  return (
                    <button
                      onClick={() => !isPastDate && handleBookingClick('training', trainerData?.trainingDate)}
                      disabled={isPastDate}
                      className={`inline-flex items-center px-2 py-1 text-white text-xs font-medium rounded transition-all duration-200 ${
                        isPastDate
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-[#ff630f] hover:bg-[#fe5b25]'
                      }`}
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {trainerData?.trainingDate ? 'Reschedule' : 'Schedule'}
                    </button>
                  )
                })()}
              </div>
            </div>

            {/* Trainer Name */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Trainer Name</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.csmName || 'Not Assigned'}
              </div>
            </div>

            {/* Merchant Location */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Merchant Location</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.merchantLocation || 'Not Available'}
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
                {trainerData?.onboardingServicesBought || 'Standard Package'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Only: Ready to Go Live Stage Details */}
      {selectedStage === 'ready-go-live' && (
        <div className="hidden md:block">
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
                      ? new Date(trainerData.hardwareFulfillmentDate).toLocaleDateString()
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
                  <span className="text-sm text-gray-500">
                    {(trainerData?.completedProductSetup === 'Yes' || trainerData?.completedProductSetup === 'Yes - Self-serve') ? 'Completed' : 'In Progress'}
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
                      ? new Date(trainerData.subscriptionActivationDate).toLocaleDateString()
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
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop Only: Live Stage Details */}
      {selectedStage === 'live' && (
        <div className="hidden md:block">
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
