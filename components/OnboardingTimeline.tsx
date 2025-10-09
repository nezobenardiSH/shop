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
    // Determine stage statuses based on business rules
    const timelineStages: TimelineStage[] = []
    
    // Welcome Stage
    const welcomeCompleted = trainerData?.welcomeCallStatus === 'Welcome Call Completed' || 
                            trainerData?.welcomeCallStatus === 'Completed'
    
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
    
    // Preparation Stage - Complex logic for sub-stages
    const documentSubmissionCompleted = 
      (trainerData?.welcomeCallStatus === 'Welcome Call Completed' || trainerData?.welcomeCallStatus === 'Completed') &&
      trainerData?.menuSubmissionDate &&
      trainerData?.ssmDocument &&
      trainerData?.videoProofLink
    
    const hardwareDeliveryCompleted = 
      trainerData?.paymentStatus === 'Paid' &&
      trainerData?.deliveryAddress &&
      trainerData?.trackingLink &&
      trainerData?.hardwareFulfillmentDate
    
    const productSetupCompleted = 
      trainerData?.menuCollectionFormLink &&
      trainerData?.menuSubmissionDate &&
      trainerData?.productSetupStatus === 'Completed'
    
    const preparationSubStagesCompleted = [
      documentSubmissionCompleted,
      hardwareDeliveryCompleted,
      productSetupCompleted
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
    
    timelineStages.push({
      id: 'preparation',
      label: 'Preparation',
      status: preparationStatus,
      completedDate: preparationStatus === 'completed' ? trainerData?.productSetupCompletedDate : undefined,
      completedCount: preparationSubStagesCompleted,
      totalCount: totalPreparationStages
    })
    
    // Installation Stage
    const installationCompleted = trainerData?.hardwareInstallationStatus === 'Completed' || 
                                 trainerData?.hardwareInstallationStatus === 'Installation Completed'
    
    timelineStages.push({
      id: 'installation',
      label: 'Installation',
      status: preparationStatus === 'completed' ? (installationCompleted ? 'completed' : 'current') : 'pending',
      completedDate: trainerData?.actualInstallationDate
    })
    
    // Training Stage
    const trainingCompleted = trainerData?.trainingStatus === 'Completed' || 
                             trainerData?.trainingStatus === 'Training Completed'
    
    timelineStages.push({
      id: 'training',
      label: 'Training',
      status: installationCompleted ? (trainingCompleted ? 'completed' : 'current') : 'pending',
      completedDate: trainerData?.backOfficeTrainingDate || trainerData?.posTrainingDate
    })
    
    // Ready to Go Live Stage
    const readyToGoLive = trainingCompleted &&
                         trainerData?.hardwareDeliveryStatus === 'Delivered' &&
                         trainerData?.productSetupStatus === 'Completed' &&
                         trainerData?.hardwareInstallationStatus === 'Completed' &&
                         trainerData?.boAccountName
    
    timelineStages.push({
      id: 'ready-go-live',
      label: 'Ready to go live',
      status: trainingCompleted ? (readyToGoLive ? 'completed' : 'current') : 'pending',
      completedDate: undefined
    })
    
    // Live Stage
    const isLive = trainerData?.firstRevisedEGLD && 
                  new Date(trainerData.firstRevisedEGLD) <= new Date()
    
    timelineStages.push({
      id: 'live',
      label: 'Live',
      status: readyToGoLive ? (isLive ? 'completed' : 'current') : 'pending',
      completedDate: trainerData?.firstRevisedEGLD
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

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg p-3">
      <h3 className="text-lg font-bold text-[#0b0707] mb-3">Onboarding Progress</h3>
      
      {/* Compact Progress Bar Timeline */}
      <div className="bg-gray-50 rounded-lg p-2 mb-3">
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex-1 relative">
              <div 
                className="cursor-pointer"
                onClick={() => setSelectedStage(stage.id)}
              >
                {/* Progress Bar Section */}
                <div className="relative">
                  <div className={`h-2 rounded-full transition-all ${
                    stage.status === 'completed' ? 'bg-green-500' :
                    stage.status === 'current' ? 'bg-orange-400' :
                    'bg-gray-300'
                  } ${index < stages.length - 1 ? 'mr-1' : ''}`} />
                  
                  {/* Stage Label Below */}
                  <div className="mt-1.5 text-center">
                    <div className={`text-[10px] font-semibold ${
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
                            return stage.status === 'completed' ? 'Complete' : 'In Progress'
                          case 'preparation':
                            if (stage.completedCount !== undefined && stage.totalCount !== undefined) {
                              return `${stage.completedCount}/${stage.totalCount} Complete`
                            }
                            return 'In Progress'
                          case 'installation':
                            return stage.status === 'completed' ? 'Complete' : stage.status === 'current' ? 'In Progress' : 'Pending'
                          case 'training':
                            return stage.status === 'completed' ? 'Complete' : stage.status === 'current' ? 'In Progress' : 'Pending'
                          case 'ready-go-live':
                            return stage.status === 'completed' ? 'Ready' : stage.status === 'current' ? 'Preparing' : 'Pending'
                          case 'live':
                            return stage.status === 'completed' ? 'Live' : stage.status === 'current' ? 'Going Live' : 'Pending'
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

      {/* Preparation Status Overview - Prominent */}
      {selectedStage === 'preparation' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-gray-900">Preparation Progress</h4>
            <div className="text-sm text-gray-500">
              {(() => {
                const ssmDocumentCompleted = !!trainerData?.ssmDocument;
                const hardwareDeliveryCompleted = !!trainerData?.trackingLink;
                const productSetupCompleted = trainerData?.completedProductSetup === 'Yes';
                const storeSetupCompleted = !!trainerData?.videoProofLink;

                const completed = [
                  ssmDocumentCompleted,
                  hardwareDeliveryCompleted,
                  productSetupCompleted,
                  storeSetupCompleted
                ].filter(Boolean).length;
                return `${completed}/4 Complete`;
              })()}
            </div>
          </div>
          
          <div className="space-y-3">
            {/* 1. Submit SSM Document */}
            <div className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const ssmCompleted = !!trainerData?.ssmDocument;

                      return ssmCompleted ? (
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
                    <div className="text-sm font-medium text-gray-900">Submit SSM Document</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-gray-500">
                      {trainerData?.ssmDocument || uploadedSSMUrl ? (
                        <span className="text-green-600 font-medium">✓ Document Uploaded</span>
                      ) : (
                        <span className="text-orange-600 font-medium">⏳ Pending Upload</span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleItemExpansion('document-submission')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className={`w-4 h-4 transition-transform ${expandedItems['document-submission'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Expanded Details for SSM Document Submission */}
                {expandedItems['document-submission'] && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div>
                      <div className="space-y-2">
                        {/* Show existing document if available */}
                        {(trainerData?.ssmDocument || uploadedSSMUrl) && (
                          <div className="flex items-center gap-2">
                            <a
                              href={uploadedSSMUrl || trainerData?.ssmDocument}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 text-sm inline-flex items-center gap-1"
                            >
                              View Current Document
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}

                        {/* Always show upload button for new upload or replacement */}
                        <div className="flex items-center gap-2">
                          <input
                            id={`ssm-doc-upload-${trainerData?.id}`}
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return

                              setUploadingSSM(true)
                              try {
                                const formData = new FormData()
                                formData.append('file', file)
                                formData.append('trainerId', trainerData?.id || '')
                                formData.append('documentType', 'ssm')

                                const response = await fetch('/api/salesforce/upload-document', {
                                  method: 'POST',
                                  body: formData
                                })

                                if (!response.ok) {
                                  const error = await response.json()
                                  throw new Error(error.details || error.error || 'Failed to upload document')
                                }

                                const result = await response.json()
                                setUploadedSSMUrl(result.fileUrl)

                                if (onBookingComplete) {
                                  onBookingComplete()
                                }
                              } catch (error) {
                                console.error('Error uploading SSM document:', error)
                                alert(error instanceof Error ? error.message : 'Failed to upload document')
                              } finally {
                                setUploadingSSM(false)
                                e.target.value = ''
                              }
                            }}
                          />
                          <button
                            onClick={() => document.getElementById(`ssm-doc-upload-${trainerData?.id}`)?.click()}
                            disabled={uploadingSSM}
                            className="inline-flex items-center px-2 py-1 bg-[#ff630f] hover:bg-[#fe5b25] disabled:bg-gray-400 text-white text-xs font-medium rounded transition-all duration-200 disabled:cursor-not-allowed"
                          >
                            {uploadingSSM ? 'Uploading...' : (trainerData?.ssmDocument || uploadedSSMUrl ? 'Replace Document' : 'Upload SSM Document')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Show SSM Document Field Value */}
                    {trainerData?.ssmDocument && (
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Salesforce SSM Field</div>
                        <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                          <code className="text-xs break-all">{trainerData.ssmDocument}</code>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Hardware Delivery */}
            <div className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const hardwareComplete = !!trainerData?.trackingLink;

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
                      Status: {trainerData?.trackingLink ? 'Completed' : 'Pending'}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Hardware Fulfillment Date</div>
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

            {/* 3. Product Setup */}
            <div className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const productComplete = trainerData?.completedProductSetup === 'Yes';
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
                        if (trainerData?.completedProductSetup === 'Yes') return 'Completed';
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
                      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Completed Product Setup</div>
                      <div className="text-sm font-medium text-gray-900">
                        {trainerData?.completedProductSetup || 'No'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Store Setup */}
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
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
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
      
      {/* Welcome Stage Details */}
      {selectedStage === 'welcome' && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Welcome to StoreHub</span>
            {(trainerData?.welcomeCallStatus === 'Welcome Call Completed' || trainerData?.welcomeCallStatus === 'Completed') &&
              <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Completed</span>
            }
          </h4>

          <div className="space-y-4">
            {/* First Call Timestamp */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">First Call Timestamp</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.firstCallTimestamp
                  ? new Date(trainerData.firstCallTimestamp).toLocaleString()
                  : 'Not Recorded'}
              </div>
            </div>

            {/* MSM Name */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">MSM Name</div>
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
                    {trainerData?.installationDate
                      ? new Date(trainerData.installationDate).toLocaleDateString()
                      : 'Not Set'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">• POS Training Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {trainerData?.posTrainingDate
                      ? new Date(trainerData.posTrainingDate).toLocaleDateString()
                      : 'Not Set'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">• BackOffice Training Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {trainerData?.backOfficeTrainingDate
                      ? new Date(trainerData.backOfficeTrainingDate).toLocaleDateString()
                      : 'Not Set'}
                  </span>
                </div>
              </div>
            </div>


          </div>
        </div>
      )}

      {/* Installation Stage Details */}
      {selectedStage === 'installation' && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Installation</span>
            {(trainerData?.hardwareInstallationStatus === 'Completed' || trainerData?.hardwareInstallationStatus === 'Installation Completed') &&
              <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Completed</span>
            }
          </h4>

          <div className="space-y-4">
            {/* Installation Date - Editable */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Scheduled Installation Date</div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.installationDate
                    ? new Date(trainerData.installationDate).toLocaleDateString()
                    : 'Not Scheduled'}
                </div>
                <button
                  onClick={() => handleBookingClick('installation', trainerData?.installationDate)}
                  className="inline-flex items-center px-2 py-1 bg-[#ff630f] hover:bg-[#fe5b25] text-white text-xs font-medium rounded transition-all duration-200"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {trainerData?.installationDate ? 'Reschedule' : 'Schedule'}
                </button>
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

            {/* Installation Status */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Installation Status</div>
              <div className="text-sm font-medium">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  trainerData?.installationStatus === 'Completed' ? 'bg-green-100 text-green-800' :
                  trainerData?.installationStatus === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                  trainerData?.installationStatus === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {trainerData?.installationStatus || 'Not Started'}
                </span>
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

      {/* Training Stage Details */}
      {selectedStage === 'training' && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Training</span>
            {(trainerData?.trainingStatus === 'Completed' || trainerData?.trainingStatus === 'Training Completed' || trainerData?.completedTraining === 'Yes') &&
              <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Completed</span>
            }
          </h4>

          <div className="space-y-4">
            {/* POS Training Date - Editable */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">POS Training Date</div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.posTrainingDate
                    ? new Date(trainerData.posTrainingDate).toLocaleDateString()
                    : 'Not Scheduled'}
                </div>
                <button
                  onClick={() => handleBookingClick('pos-training', trainerData?.posTrainingDate)}
                  className="inline-flex items-center px-2 py-1 bg-[#ff630f] hover:bg-[#fe5b25] text-white text-xs font-medium rounded transition-all duration-200"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {trainerData?.posTrainingDate ? 'Reschedule' : 'Schedule'}
                </button>
              </div>
            </div>

            {/* BackOffice Training Date - Editable */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">BackOffice Training Date</div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-900">
                  {trainerData?.backOfficeTrainingDate || trainerData?.trainingDate
                    ? new Date(trainerData.backOfficeTrainingDate || trainerData.trainingDate).toLocaleDateString()
                    : 'Not Scheduled'}
                </div>
                <button
                  onClick={() => handleBookingClick('backoffice-training', trainerData?.backOfficeTrainingDate || trainerData?.trainingDate)}
                  className="inline-flex items-center px-2 py-1 bg-[#ff630f] hover:bg-[#fe5b25] text-white text-xs font-medium rounded transition-all duration-200"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {trainerData?.backOfficeTrainingDate || trainerData?.trainingDate ? 'Reschedule' : 'Schedule'}
                </button>
              </div>
            </div>

            {/* CSM Name */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">CSM Name</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.csmName || 'Not Assigned'}
              </div>
            </div>

            {/* Training Location */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Training Location</div>
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

            {/* Completed Training Status */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Training Completion Status</div>
              <div className="text-sm font-medium">
                <span className={`px-2 py-1 rounded-full text-xs ${
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
          </div>
        </div>
      )}

      {/* Ready to Go Live Stage Details */}
      {selectedStage === 'ready-go-live' && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Ready to Go Live</span>
            {(() => {
              const hardwareDelivered = trainerData?.hardwareDeliveryStatus === 'Delivered' || trainerData?.hardwareFulfillmentDate;
              const productSetupDone = trainerData?.completedProductSetup === 'Yes';
              const installationDone = trainerData?.installationStatus === 'Completed';
              const trainingDone = trainerData?.completedTraining === 'Yes';
              const allDone = hardwareDelivered && productSetupDone && installationDone && trainingDone;
              
              return allDone && (
                <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Ready</span>
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
                    {(trainerData?.hardwareDeliveryStatus === 'Delivered' || trainerData?.hardwareFulfillmentDate) ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span className="text-sm text-gray-700">Hardware Delivered</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {trainerData?.hardwareFulfillmentDate
                      ? new Date(trainerData.hardwareFulfillmentDate).toLocaleDateString()
                      : 'Pending'}
                  </span>
                </div>

                {/* Product Setup */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {trainerData?.completedProductSetup === 'Yes' ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span className="text-sm text-gray-700">Product Setup Completed</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {trainerData?.completedProductSetup === 'Yes' ? 'Completed' : 'In Progress'}
                  </span>
                </div>

                {/* Installation */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {trainerData?.installationStatus === 'Completed' ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span className="text-sm text-gray-700">Hardware Installation Completed</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {trainerData?.installationStatus || 'Pending'}
                  </span>
                </div>

                {/* Training */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {trainerData?.completedTraining === 'Yes' ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <span className="text-sm text-gray-700">Training Completed</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {trainerData?.completedTraining === 'Yes' ? 'Completed' : 'In Progress'}
                  </span>
                </div>
              </div>
            </div>

            {/* Go-Live Date Section */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Finalised Go-Live Date</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.firstRevisedEGLD || trainerData?.plannedGoLiveDate
                  ? new Date(trainerData.firstRevisedEGLD || trainerData.plannedGoLiveDate).toLocaleDateString()
                  : 'Not Set'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Stage Details */}
      {selectedStage === 'live' && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <span>Live</span>
            {trainerData?.firstRevisedEGLD && new Date(trainerData.firstRevisedEGLD) <= new Date() &&
              <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Live</span>
            }
          </h4>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Go-Live Date</div>
              <div className="text-sm font-medium text-gray-900">
                {trainerData?.firstRevisedEGLD
                  ? new Date(trainerData.firstRevisedEGLD).toLocaleDateString()
                  : 'Not Yet Live'}
              </div>
            </div>

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
          </div>
        </div>
      )}

      {/* Simple placeholder for other stages */}
      {selectedStage !== 'preparation' && selectedStage !== 'welcome' && selectedStage !== 'installation' && 
       selectedStage !== 'training' && selectedStage !== 'ready-go-live' && selectedStage !== 'live' && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
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
