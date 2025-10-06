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

export default function OnboardingTimeline({ currentStage, stageData, trainerData, onBookingComplete, onOpenBookingModal }: OnboardingTimelineProps) {
  const [stages, setStages] = useState<TimelineStage[]>([])
  // Initialize selectedStage based on welcome call completion status
  const initialStage = (trainerData?.welcomeCallStatus === 'Welcome Call Completed' || 
                        trainerData?.welcomeCallStatus === 'Completed') ? 'implementation' : 'welcome-call'
  const [selectedStage, setSelectedStage] = useState<string>(initialStage)
  const [updatingField, setUpdatingField] = useState<string | null>(null)
  const [editingGoLiveDate, setEditingGoLiveDate] = useState(false)
  const [goLiveDateValue, setGoLiveDateValue] = useState('')
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)

  // Define the main 4 stages with sub-stages
  const mainStages = [
    { 
      id: 'welcome-call', 
      label: 'Welcome Call', 
      sfValue: 'Welcome Call',
      subStages: []
    },
    { 
      id: 'implementation', 
      label: 'Implementation', 
      sfValue: 'Implementation',
      subStages: [
        { id: 'product-setup', label: 'Product Setup', sfValue: 'Product Setup' },
        { id: 'hardware-fulfillment', label: 'Hardware Fulfillment', sfValue: 'Hardware Fulfillment' },
        { id: 'hardware-installation', label: 'Installation', sfValue: 'Hardware Installation' },
        { id: 'training', label: 'Training', sfValue: 'Training' },
        { id: 'store-readiness', label: 'Store Readiness', sfValue: 'Store Readiness' }
      ]
    },
    { 
      id: 'go-live', 
      label: 'Go Live', 
      sfValue: 'Go Live',
      subStages: []
    },
    { 
      id: 'post-go-live', 
      label: 'Post Go Live', 
      sfValue: 'Post Go Live Check In',
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
    'New': 'welcome-call',
    'Welcome Call': 'welcome-call',
    'Welcome Call Scheduled': 'welcome-call',
    'Welcome Call Completed': 'welcome-call',
    'Product Setup': 'product-setup',
    'Product Setup In Progress': 'product-setup',
    'Product Setup Completed': 'product-setup',
    'Hardware Fulfillment': 'hardware-fulfillment',
    'Hardware Ordered': 'hardware-fulfillment',
    'Hardware Shipped': 'hardware-fulfillment',
    'Hardware Delivered': 'hardware-fulfillment',
    'Hardware Installation': 'hardware-installation',
    'Installation Scheduled': 'hardware-installation',
    'Installation In Progress': 'hardware-installation',
    'Installation Completed': 'hardware-installation',
    'Training': 'training',
    'Training Scheduled': 'training',
    'Training In Progress': 'training',
    'Training Completed': 'training',
    'Go Live': 'go-live',
    'Go Live Scheduled': 'go-live',
    'Go Live In Progress': 'go-live',
    'Go Live Completed': 'go-live',
    'Post Go Live Check In': 'post-go-live',
    'Onboarding Complete': 'post-go-live',
    // Add more mappings based on actual Salesforce stages
  }

  useEffect(() => {
    // Determine stage statuses based on business rules
    const timelineStages: TimelineStage[] = []
    
    // 1. Welcome Call Stage
    const welcomeCallCompleted = trainerData?.welcomeCallStatus === 'Welcome Call Completed' || 
                                 trainerData?.welcomeCallStatus === 'Completed'
    
    timelineStages.push({
      id: 'welcome-call',
      label: 'Welcome Call',
      status: welcomeCallCompleted ? 'completed' : 
              (trainerData?.welcomeCallStatus && trainerData.welcomeCallStatus !== 'Not Started' ? 'current' : 'pending'),
      completedDate: trainerData?.firstCallTimestamp
    })
    
    // If welcome call is completed, automatically set selected stage to implementation
    if (welcomeCallCompleted && selectedStage === 'welcome-call') {
      setSelectedStage('implementation')
    }
    
    // 2. Implementation Stage
    // Check if all implementation sub-stages are completed
    const productSetupCompleted = trainerData?.productSetupStatus === 'Completed' || 
                                  trainerData?.productSetupStatus === 'Product Setup Completed'
    const hardwareDeliveryCompleted = trainerData?.hardwareDeliveryStatus === 'Delivered' || 
                                      trainerData?.hardwareDeliveryStatus === 'Hardware Delivered'
    const installationCompleted = trainerData?.hardwareInstallationStatus === 'Completed' || 
                                  trainerData?.hardwareInstallationStatus === 'Installation Completed'
    const trainingCompleted = trainerData?.trainingStatus === 'Completed' || 
                             trainerData?.trainingStatus === 'Training Completed'
    const storeReadinessCompleted = trainerData?.videoProofLink || uploadedVideoUrl
    
    // Count completed implementation sub-stages
    const implementationSubStages = [
      productSetupCompleted,
      hardwareDeliveryCompleted,
      installationCompleted,
      trainingCompleted,
      storeReadinessCompleted
    ]
    const completedImplementationCount = implementationSubStages.filter(Boolean).length
    const totalImplementationStages = 5
    
    const allImplementationCompleted = completedImplementationCount === totalImplementationStages
    
    const implementationInProgress = welcomeCallCompleted && !allImplementationCompleted
    
    timelineStages.push({
      id: 'implementation',
      label: 'Implementation',
      status: allImplementationCompleted ? 'completed' : 
              (implementationInProgress ? 'current' : 'pending'),
      completedDate: undefined,
      // Add custom properties for the completion count
      completedCount: completedImplementationCount,
      totalCount: totalImplementationStages
    })
    
    // 3. Go Live Stage
    const goLiveInProgress = allImplementationCompleted && 
                            (!trainerData?.firstRevisedEGLD || new Date(trainerData.firstRevisedEGLD) > new Date())
    const goLiveCompleted = allImplementationCompleted && 
                           trainerData?.firstRevisedEGLD && 
                           new Date(trainerData.firstRevisedEGLD) <= new Date()
    
    timelineStages.push({
      id: 'go-live',
      label: 'Go Live',
      status: goLiveCompleted ? 'completed' : 
              (goLiveInProgress ? 'current' : 'pending'),
      completedDate: trainerData?.firstRevisedEGLD
    })
    
    // 4. Post Go Live Stage
    const postGoLiveActive = goLiveCompleted
    
    timelineStages.push({
      id: 'post-go-live',
      label: 'Post Go Live',
      status: postGoLiveActive ? 'current' : 'pending',
      completedDate: undefined
    })

    setStages(timelineStages)
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
        <div className="w-10 h-10 bg-[#ff630f] rounded-full flex items-center justify-center text-white shadow-md ring-4 ring-[#ff630f]/20">
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
      return <span className="text-gray-400 text-xs">Pending</span>
    }
  }

  const handleBookingClick = (bookingType: string, existingDate?: string) => {
    if (onOpenBookingModal) {
      onOpenBookingModal({ 
        ...trainerData, 
        bookingType: bookingType,
        existingDate: existingDate
      })
    }
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


  return (
    <div className="bg-white border border-[#e5e7eb] rounded-2xl p-6">
      <h3 className="text-xl font-bold text-[#0b0707] mb-6">🚀 Onboarding Timeline</h3>
      
      {/* Desktop Timeline (Horizontal) */}
      <div className="hidden lg:block overflow-x-auto">
        <div className="relative min-w-max">
          <div className="flex items-center justify-between">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center">
                <div 
                  className="relative flex flex-col items-center px-4 cursor-pointer hover:opacity-90 transition-all hover:scale-105"
                  onClick={() => setSelectedStage(stage.id)}
                >
                  {/* Step Number */}
                  <div className="text-xs text-[#6b6a6a] mb-2">Step {index + 1}</div>
                  
                  {/* Stage Icon */}
                  <div className="relative z-10">
                    {getStageIcon(stage, index)}
                  </div>
                  
                  {/* Stage Label */}
                  <div className="mt-3 text-center max-w-[120px]">
                    <div className={`text-sm font-semibold ${
                      selectedStage === stage.id ? 'text-[#ff630f]' :
                      stage.status === 'completed' ? 'text-[#0b0707]' :
                      stage.status === 'current' ? 'text-[#ff630f]' :
                      'text-[#6b6a6a]'
                    }`}>
                      {stage.label}
                    </div>
                    {stage.id === 'implementation' && (
                      <div className="text-xs text-gray-500 mt-1">
                        {stage.completedCount}/{stage.totalCount} completed
                      </div>
                    )}
                    <div className="mt-1">
                      {getStatusText(stage)}
                    </div>
                  </div>
                </div>
                
                {/* Connector Line */}
                {index < stages.length - 1 && (
                  <div className="w-16 h-1 relative -top-5">
                    <div className={`h-0.5 ${getConnectorColor(stage)} rounded-full`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Tablet Timeline (Single row for 4 stages) */}
      <div className="hidden md:block lg:hidden">
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => (
              <div key={stage.id} className="flex-1 flex items-center">
                <div 
                  className="relative flex flex-col items-center cursor-pointer hover:opacity-90 transition-all hover:scale-105"
                  onClick={() => setSelectedStage(stage.id)}
                >
                  {/* Step Number */}
                  <div className="text-xs text-gray-500 mb-1">Step {index + 1}</div>
                  
                  {/* Stage Icon */}
                  <div className="relative z-10">
                    {getStageIcon(stage, index)}
                  </div>
                  
                  {/* Stage Label */}
                  <div className="mt-2 text-center">
                    <div className={`text-xs font-semibold ${
                      selectedStage === stage.id ? 'text-purple-700' :
                      stage.status === 'completed' ? 'text-gray-800' :
                      stage.status === 'current' ? 'text-purple-700' :
                      'text-gray-600'
                    }`}>
                      {stage.label}
                    </div>
                    {stage.id === 'implementation' && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {stage.completedCount}/{stage.totalCount} completed
                      </div>
                    )}
                    <div className="mt-1">
                      {getStatusText(stage)}
                    </div>
                  </div>
                </div>
                
                {/* Connector Line */}
                {index < 3 && (
                  <div className="flex-1 h-0.5 mx-2">
                    <div className={`h-full ${getConnectorColor(stage)}`} />
                  </div>
                )}
              </div>
          ))}
        </div>
      </div>
      
      {/* Mobile Timeline (Horizontal Scrollable - Compact) */}
      <div className="block md:hidden overflow-x-auto pb-1">
        <div className="relative min-w-max">
          <div className="flex items-center justify-between" style={{ minWidth: '500px' }}>
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center">
                <div 
                  className="relative flex flex-col items-center px-2 cursor-pointer hover:opacity-90 transition-all"
                  onClick={() => setSelectedStage(stage.id)}
                >
                  {/* Stage Icon with Step Number */}
                  <div className="relative z-10">
                    <div className="transform scale-75">
                      {getStageIcon(stage, index)}
                    </div>
                    <div className="absolute -top-1 -right-1 text-[10px] bg-white rounded-full w-4 h-4 flex items-center justify-center font-bold text-gray-600 border border-gray-300">
                      {index + 1}
                    </div>
                  </div>
                  
                  {/* Stage Label - Compact */}
                  <div className="mt-2 text-center max-w-[80px]">
                    <div className={`text-[11px] font-semibold leading-tight ${
                      selectedStage === stage.id ? 'text-purple-700' :
                      stage.status === 'completed' ? 'text-gray-800' :
                      stage.status === 'current' ? 'text-purple-700' :
                      'text-gray-600'
                    }`}>
                      {stage.label}
                    </div>
                    {stage.id === 'implementation' && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {stage.completedCount}/{stage.totalCount}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Connector Line */}
                {index < stages.length - 1 && (
                  <div className="w-8 h-0.5 relative -top-3">
                    <div className={`h-full ${getConnectorColor(stage)} rounded-full`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Scroll indicator - smaller */}
        <div className="text-center mt-1 md:hidden">
          <span className="text-[10px] text-gray-400">← Swipe →</span>
        </div>
      </div>
      
      {/* Current Stage Info */}
      {currentStage && (
        <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-700">
            <span className="font-medium">Current Stage:</span> {currentStage}
          </div>
        </div>
      )}

      {/* Stage Details Section - Shows only selected stage */}
      <div className="mt-6">
        {selectedStage === 'welcome-call' && (
          <div className="bg-white rounded-2xl p-4 border border-[#e5e7eb]">
            <h4 className="text-sm font-semibold text-[#0b0707] mb-3 flex items-center">
              <span className="mr-2">📞</span> Welcome Call Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Call Status</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.welcomeCallStatus || 'Not Started'}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">First Call Timestamp</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.firstCallTimestamp 
                    ? new Date(trainerData.firstCallTimestamp).toLocaleString() 
                    : 'Not Scheduled'}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">MSM Name</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.msmName || 'Not Assigned'}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedStage === 'implementation' && (
          <div className="space-y-4">
            {/* Implementation Progress Overview */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Implementation Progress</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="flex items-center gap-2">
                  {(trainerData?.productSetupStatus === 'Completed' || trainerData?.productSetupStatus === 'Product Setup Completed') ? 
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg> :
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  <span className="text-xs">Product Setup</span>
                </div>
                <div className="flex items-center gap-2">
                  {(trainerData?.hardwareDeliveryStatus === 'Delivered' || trainerData?.hardwareDeliveryStatus === 'Hardware Delivered') ?
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg> :
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  <span className="text-xs">Hardware Delivery</span>
                </div>
                <div className="flex items-center gap-2">
                  {(trainerData?.hardwareInstallationStatus === 'Completed' || trainerData?.hardwareInstallationStatus === 'Installation Completed') ?
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg> :
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  <span className="text-xs">Installation</span>
                </div>
                <div className="flex items-center gap-2">
                  {(trainerData?.trainingStatus === 'Completed' || trainerData?.trainingStatus === 'Training Completed') ?
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg> :
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  <span className="text-xs">Training</span>
                </div>
                <div className="flex items-center gap-2">
                  {(trainerData?.videoProofLink || uploadedVideoUrl) ?
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg> :
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  <span className="text-xs">Store Readiness</span>
                </div>
              </div>
            </div>
            
            {/* Product Setup */}
          <div className="bg-white rounded-2xl p-4 border border-[#e5e7eb]">
            <h4 className="text-sm font-semibold text-[#0b0707] mb-3 flex items-center justify-between">
              <span className="flex items-center">
                <span className="mr-2">⚙️</span> Product Setup
              </span>
              {(trainerData?.productSetupStatus === 'Completed' || trainerData?.productSetupStatus === 'Product Setup Completed') &&
                <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Completed</span>
              }
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Product Setup Status</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.productSetupStatus || 'Not Started'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Completed Product Setup</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.completedProductSetup 
                      ? new Date(trainerData.completedProductSetup).toLocaleDateString() 
                      : 'Not Completed'}
                  </div>
                </div>
              </div>
              
              {trainerData?.boAccountName && (
                <div>
                  <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">StoreHub Account</div>
                  <a
                    href={`https://${trainerData.boAccountName}.storehubhq.com/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 underline inline-flex items-center gap-1"
                  >
                    {trainerData.boAccountName}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
              
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Menu Collection</div>
                {(() => {
                  // Check if the link exists and is a complete, valid URL
                  const link = trainerData?.menuCollectionFormLink
                  const isValidLink = link && 
                    link.trim() !== '' && 
                    !link.endsWith('prefill_Account+Name=') && // Not just the base URL with empty prefill
                    (link.startsWith('http://') || link.startsWith('https://')) &&
                    link.length > 50 // A reasonable minimum length for a valid form URL
                  
                  if (isValidLink) {
                    return (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload Menu
                      </a>
                    )
                  } else {
                    return (
                      <button
                        disabled
                        className="inline-flex items-center px-4 py-2 bg-gray-400 cursor-not-allowed text-white text-sm font-medium rounded-lg"
                        title="Menu collection form link not configured in Salesforce"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload Menu (Link Not Available)
                      </button>
                    )
                  }
                })()}
              </div>
            </div>
          </div>

            {/* Hardware Fulfillment */}
          <div className="bg-white rounded-2xl p-4 border border-[#e5e7eb]">
            <h4 className="text-sm font-semibold text-[#0b0707] mb-3 flex items-center justify-between">
              <span className="flex items-center">
                <span className="mr-2">📦</span> Hardware Fulfillment
              </span>
              {(trainerData?.hardwareDeliveryStatus === 'Delivered' || trainerData?.hardwareDeliveryStatus === 'Hardware Delivered') &&
                <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Completed</span>
              }
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Hardware Delivery Status</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.hardwareDeliveryStatus || 'Not Started'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Hardware Fulfillment Date</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900">
                      {trainerData?.hardwareFulfillmentDate 
                        ? new Date(trainerData.hardwareFulfillmentDate).toLocaleDateString() 
                        : 'Not Scheduled'}
                    </div>
                    <div className="text-xs text-gray-500 italic ml-2">
                      (Managed by CSM/MSM)
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Tracking Link</div>
                {trainerData?.trackingLink ? (
                  <a 
                    href={trainerData.trackingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 underline inline-flex items-center gap-1"
                  >
                    Track Shipment
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <div className="text-sm text-gray-500 italic">No tracking available</div>
                )}
              </div>
            </div>
          </div>

            {/* Hardware Installation */}
          <div className="bg-white rounded-2xl p-4 border border-[#e5e7eb]">
            <h4 className="text-sm font-semibold text-[#0b0707] mb-3 flex items-center justify-between">
              <span className="flex items-center">
                <span className="mr-2">🔧</span> Hardware Installation
              </span>
              {(trainerData?.hardwareInstallationStatus === 'Completed' || trainerData?.hardwareInstallationStatus === 'Installation Completed') &&
                <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Completed</span>
              }
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Installation Status</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.hardwareInstallationStatus || 'Not Started'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Installation Date</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900">
                      {trainerData?.installationDate 
                        ? new Date(trainerData.installationDate).toLocaleDateString() 
                        : 'Not Scheduled'}
                    </div>
                    <button
                      onClick={() => handleBookingClick('installation', trainerData?.installationDate)}
                      className="text-[#ff630f] hover:text-[#fe5b25] text-sm transition-colors"
                      title="Book with Lark Calendar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Actual Installation Date</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.actualInstallationDate 
                      ? new Date(trainerData.actualInstallationDate).toLocaleDateString() 
                      : 'Not Completed'}
                  </div>
                </div>
              </div>
              
              {trainerData?.installationIssuesElaboration && (
                <div>
                  <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Installation Issues</div>
                  <div className="text-sm text-gray-900 bg-yellow-50 p-2 rounded border border-yellow-200">
                    {trainerData.installationIssuesElaboration}
                  </div>
                </div>
              )}
            </div>
          </div>

            {/* Training */}
          <div className="bg-white rounded-2xl p-4 border border-[#e5e7eb]">
            <h4 className="text-sm font-semibold text-[#0b0707] mb-3 flex items-center justify-between">
              <span className="flex items-center">
                <span className="mr-2">🎓</span> Training
              </span>
              {(trainerData?.trainingStatus === 'Completed' || trainerData?.trainingStatus === 'Training Completed') &&
                <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Completed</span>
              }
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Training Status</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.trainingStatus || 'Not Started'}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">BackOffice Training</div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.backOfficeTrainingDate 
                      ? new Date(trainerData.backOfficeTrainingDate).toLocaleDateString() 
                      : 'Not Scheduled'}
                  </div>
                  <button
                    onClick={() => handleBookingClick('training-backoffice', trainerData?.backOfficeTrainingDate)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                    title="Book BackOffice Training"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">POS Training</div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.posTrainingDate 
                      ? new Date(trainerData.posTrainingDate).toLocaleDateString() 
                      : 'Not Scheduled'}
                  </div>
                  <button
                    onClick={() => handleBookingClick('training-pos', trainerData?.posTrainingDate)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                    title="Book POS Training"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">CSM Name</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.csmName || 'Not Assigned'}
                </div>
              </div>
            </div>
          </div>

            {/* Store Readiness */}
          <div className="bg-white rounded-2xl p-4 border border-[#e5e7eb]">
            <h4 className="text-sm font-semibold text-[#0b0707] mb-3 flex items-center justify-between">
              <span className="flex items-center">
                <span className="mr-2">📹</span> Store Readiness
              </span>
              {(trainerData?.videoProofLink || uploadedVideoUrl) &&
                <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Completed</span>
              }
            </h4>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Video Proof</div>
                {trainerData?.videoProofLink || uploadedVideoUrl ? (
                  <div className="flex items-center gap-2">
                    <a 
                      href={uploadedVideoUrl || trainerData?.videoProofLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 underline inline-flex items-center gap-1"
                    >
                      View Uploaded Video
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No video uploaded</div>
                )}
              </div>
              
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Upload Store Video</div>
                <div className="flex items-center gap-2">
                  <input
                    id="video-upload"
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
                        
                        // Refresh the page data
                        if (onBookingComplete) {
                          onBookingComplete()
                        }
                      } catch (error) {
                        console.error('Error uploading video:', error)
                        alert(error instanceof Error ? error.message : 'Failed to upload video')
                      } finally {
                        setUploadingVideo(false)
                        // Reset the input
                        e.target.value = ''
                      }
                    }}
                  />
                  <button
                    onClick={() => document.getElementById('video-upload')?.click()}
                    disabled={uploadingVideo}
                    className="inline-flex items-center px-6 py-2.5 bg-[#ff630f] hover:bg-[#fe5b25] disabled:bg-gray-400 text-white font-medium rounded-full transition-all duration-200 transform hover:scale-105 disabled:cursor-not-allowed"
                  >
                    {uploadingVideo ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload Video
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {selectedStage === 'go-live' && (
          <div className="bg-white rounded-2xl p-4 border border-[#e5e7eb]">
            <h4 className="text-sm font-semibold text-[#0b0707] mb-3 flex items-center">
              <span className="mr-2">🚀</span> Go Live
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">Planned Go-Live Date</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.plannedGoLiveDate 
                    ? new Date(trainerData.plannedGoLiveDate).toLocaleDateString() 
                    : 'Not Set'}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6b6a6a] uppercase tracking-wider mb-1">First Revised EGLD</div>
                {editingGoLiveDate ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={goLiveDateValue}
                      onChange={(e) => setGoLiveDateValue(e.target.value)}
                      className="text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <button
                      onClick={handleGoLiveDateSave}
                      disabled={updatingField === 'go-live'}
                      className="text-green-600 hover:text-green-700 disabled:text-gray-400"
                    >
                      {updatingField === 'go-live' ? (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingGoLiveDate(false)
                        setGoLiveDateValue('')
                      }}
                      className="text-gray-600 hover:text-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900">
                      {trainerData?.firstRevisedEGLD 
                        ? new Date(trainerData.firstRevisedEGLD).toLocaleDateString() 
                        : 'Not Set'}
                    </div>
                    <button
                      onClick={() => {
                        setEditingGoLiveDate(true)
                        setGoLiveDateValue(trainerData?.firstRevisedEGLD 
                          ? new Date(trainerData.firstRevisedEGLD).toISOString().split('T')[0]
                          : new Date().toISOString().split('T')[0])
                      }}
                      className="text-[#ff630f] hover:text-[#fe5b25] text-sm transition-colors"
                      title="Set Go-Live Date"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedStage === 'post-go-live' && (
          <div className="bg-white rounded-2xl p-4 border border-[#e5e7eb]">
            <h4 className="text-sm font-semibold text-[#0b0707] mb-3 flex items-center">
              <span className="mr-2">✅</span> Post Go Live Check In
            </h4>
            <div className="text-sm text-gray-600">Scheduled after go-live completion</div>
          </div>
        )}
      </div>
      
    </div>
  )
}