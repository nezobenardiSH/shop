'use client'

import { useState, useEffect } from 'react'

interface TimelineStage {
  id: string
  label: string
  status: 'completed' | 'current' | 'pending'
  completedDate?: string
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
  const [selectedStage, setSelectedStage] = useState<string>('welcome-call')
  const [updatingField, setUpdatingField] = useState<string | null>(null)
  const [editingGoLiveDate, setEditingGoLiveDate] = useState(false)
  const [goLiveDateValue, setGoLiveDateValue] = useState('')

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
        { id: 'training', label: 'Training', sfValue: 'Training' }
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
    // Determine which main stage is current based on Salesforce data
    const currentMappedStage = currentStage ? stageMapping[currentStage] : null
    
    // Map the current stage to main stage
    let currentMainStageId = currentMappedStage
    if (currentMappedStage && ['product-setup', 'hardware-fulfillment', 'hardware-installation', 'training'].includes(currentMappedStage)) {
      currentMainStageId = 'implementation'
    }
    
    // Find the index of the current main stage
    const currentIndex = currentMainStageId 
      ? mainStages.findIndex(s => s.id === currentMainStageId)
      : -1

    // Build the timeline stages with their statuses
    const timelineStages: TimelineStage[] = mainStages.map((stage, index) => {
      let status: 'completed' | 'current' | 'pending' = 'pending'
      
      if (currentIndex >= 0) {
        if (index < currentIndex) {
          status = 'completed'
        } else if (index === currentIndex) {
          status = 'current'
        } else {
          status = 'pending'
        }
      }

      return {
        id: stage.id,
        label: stage.label,
        status,
        completedDate: undefined
      }
    })

    setStages(timelineStages)
  }, [currentStage, stageData])

  const getStageIcon = (stage: TimelineStage, index: number) => {
    if (stage.status === 'completed') {
      return (
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )
    } else if (stage.status === 'current') {
      return (
        <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white shadow-md ring-4 ring-purple-200">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span className="text-purple-600 font-bold text-sm">{index + 1}</span>
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
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-6">🚀 Onboarding Timeline</h3>
      
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
                  <div className="text-xs text-gray-500 mb-2">Step {index + 1}</div>
                  
                  {/* Stage Icon */}
                  <div className="relative z-10">
                    {getStageIcon(stage, index)}
                  </div>
                  
                  {/* Stage Label */}
                  <div className="mt-3 text-center max-w-[120px]">
                    <div className={`text-sm font-semibold ${
                      selectedStage === stage.id ? 'text-purple-700' :
                      stage.status === 'completed' ? 'text-gray-800' :
                      stage.status === 'current' ? 'text-purple-700' :
                      'text-gray-600'
                    }`}>
                      {stage.label}
                    </div>
                    {stage.id === 'implementation' && (
                      <div className="text-xs text-gray-500 mt-1">
                        (4 sub-stages)
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
      
      {/* Mobile Timeline (Vertical) */}
      <div className="block md:hidden">
        <div className="relative">
          {stages.map((stage, index) => (
            <div 
              key={stage.id} 
              className="flex items-start mb-6 last:mb-0 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedStage(stage.id)}
            >
              <div className="flex flex-col items-center mr-4">
                {/* Step Number */}
                <div className="text-xs text-gray-500 mb-1">Step {index + 1}</div>
                
                {/* Stage Icon */}
                <div className="relative z-10">
                  {getStageIcon(stage, index)}
                </div>
                
                {/* Vertical Connector */}
                {index < stages.length - 1 && (
                  <div className={`w-0.5 h-20 mt-2 ${getConnectorColor(stage)}`} />
                )}
              </div>
              
              {/* Stage Info */}
              <div className="flex-1 pt-8">
                <div className={`text-sm font-semibold ${
                  selectedStage === stage.id ? 'text-purple-700' :
                  stage.status === 'completed' ? 'text-gray-800' :
                  stage.status === 'current' ? 'text-purple-700' :
                  'text-gray-600'
                }`}>
                  {stage.label}
                </div>
                <div className="mt-1">
                  {getStatusText(stage)}
                </div>
              </div>
            </div>
          ))}
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
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">📞</span> Welcome Call Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Call Status</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.welcomeCallStatus || 'Not Started'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">First Call Timestamp</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.firstCallTimestamp 
                    ? new Date(trainerData.firstCallTimestamp).toLocaleString() 
                    : 'Not Scheduled'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">MSM Name</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.msmName || 'Not Assigned'}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedStage === 'implementation' && (
          <div className="space-y-4">
            {/* Product Setup */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">⚙️</span> Product Setup
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Product Setup Status</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.productSetupStatus || 'Not Started'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Completed Product Setup</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.completedProductSetup 
                      ? new Date(trainerData.completedProductSetup).toLocaleDateString() 
                      : 'Not Completed'}
                  </div>
                </div>
              </div>
              
              {trainerData?.boAccountName && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">StoreHub Account</div>
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
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">📦</span> Hardware Fulfillment
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Hardware Delivery Status</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.hardwareDeliveryStatus || 'Not Started'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Hardware Fulfillment Date</div>
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
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">🔧</span> Hardware Installation
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Installation Status</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.hardwareInstallationStatus || 'Not Started'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Installation Date</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900">
                      {trainerData?.installationDate 
                        ? new Date(trainerData.installationDate).toLocaleDateString() 
                        : 'Not Scheduled'}
                    </div>
                    <button
                      onClick={() => handleBookingClick('installation', trainerData?.installationDate)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
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
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Actual Installation Date</div>
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.actualInstallationDate 
                      ? new Date(trainerData.actualInstallationDate).toLocaleDateString() 
                      : 'Not Completed'}
                  </div>
                </div>
              </div>
              
              {trainerData?.installationIssuesElaboration && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Installation Issues</div>
                  <div className="text-sm text-gray-900 bg-yellow-50 p-2 rounded border border-yellow-200">
                    {trainerData.installationIssuesElaboration}
                  </div>
                </div>
              )}
            </div>
          </div>

            {/* Training */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">🎓</span> Training
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Training Status</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.trainingStatus || 'Not Started'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Training Date</div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-900">
                    {trainerData?.trainingDate 
                      ? new Date(trainerData.trainingDate).toLocaleDateString() 
                      : 'Not Scheduled'}
                  </div>
                  <button
                    onClick={() => handleBookingClick('training', trainerData?.trainingDate)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                    title="Book with Lark Calendar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">CSM Name</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.csmName || 'Not Assigned'}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {selectedStage === 'go-live' && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">🚀</span> Go Live
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Planned Go-Live Date</div>
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.plannedGoLiveDate 
                    ? new Date(trainerData.plannedGoLiveDate).toLocaleDateString() 
                    : 'Not Set'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">First Revised EGLD</div>
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
                      className="text-blue-600 hover:text-blue-700 text-sm"
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
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">✅</span> Post Go Live Check In
            </h4>
            <div className="text-sm text-gray-600">Scheduled after go-live completion</div>
          </div>
        )}
      </div>
      
    </div>
  )
}