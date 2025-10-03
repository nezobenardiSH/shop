'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BookingModal from '@/components/BookingModal'
import OnboardingTimeline from '@/components/OnboardingTimeline'
import WhatsAppButton from '@/components/WhatsAppButton'

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

export default function TrainerPortal() {
  const params = useParams()
  const router = useRouter()
  const trainerName = params.merchantId as string
  
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
  const [loggingOut, setLoggingOut] = useState(false)

  const loadTrainerData = async () => {
    setLoading(true)
    setSuccessMessage('')
    try {
      const response = await fetch(`/api/salesforce/merchant/${trainerName}`)
      const data = await response.json()
      setTrainerData(data)

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
        setSuccessMessage(`✅ ${fieldName} updated successfully!`)
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
    if (trainerName) {
      loadTrainerData()
      loadAvailableStages()
    }
  }, [trainerName])

  const handleOpenBookingModal = (trainer: any) => {
    console.log('Opening booking modal with:', { bookingType: trainer.bookingType, trainer });
    
    // Determine which actual trainer to use based on Salesforce data
    // This could be from a field like trainer.assignedTrainerEmail or trainer.operationManagerEmail
    let actualTrainerName = 'Nezo'; // Default trainer
    
    // Option 1: Use Operation Manager name if it matches a configured trainer
    if (trainer.operationManagerContact?.name) {
      actualTrainerName = trainer.operationManagerContact.name;
    }
    
    // Option 2: Map based on merchant name or other logic
    // For example: Nasi Lemak -> Nezo, Other merchants -> Jia En
    
    // Determine which date to use based on bookingType
    let existingDate = null;
    if (trainer.bookingType === 'installation') {
      existingDate = trainer.installationDate;
    } else if (trainer.bookingType === 'hardware-fulfillment') {
      existingDate = trainer.hardwareFulfillmentDate;
    } else if (trainer.bookingType === 'go-live') {
      existingDate = trainer.firstRevisedEGLD;
    } else {
      // Default to training
      existingDate = trainer.trainingDate;
    }
    
    setCurrentBookingInfo({
      trainerId: trainer.id,
      trainerName: actualTrainerName, // Use the actual trainer name for Lark
      merchantName: trainerData?.account?.businessStoreName || trainerData?.account?.name || trainer.name || 'Unknown Merchant',
      merchantAddress: trainerData?.account?.billingAddress || '',
      merchantPhone: trainer.phoneNumber || trainer.merchantPICContactNumber || '',
      merchantContactPerson: trainer.operationManagerContact?.name || trainer.businessOwnerContact?.name || '',
      displayName: trainer.name, // Keep the Salesforce trainer name for display
      bookingType: trainer.bookingType || 'training', // Pass the booking type
      existingBooking: null // Don't pass existing booking for now, let user select new date
    })
    setBookingModalOpen(true)
  }

  const handleBookingComplete = async (selectedDate?: string) => {
    console.log('Booking completed, refreshing trainer data...')
    setSuccessMessage('📅 Booking confirmed! Refreshing data...')
    
    // Refresh the trainer data to show the new training date
    await loadTrainerData()
    
    // Clear booking modal state
    setBookingModalOpen(false)
    setCurrentBookingInfo(null)
    
    // Show success message for a few seconds
    setSuccessMessage('✅ Training date updated successfully!')
    setTimeout(() => setSuccessMessage(''), 5000)
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
        let message = '✅ Successfully updated Onboarding Trainer!'
        if (updateResult.permissionWarning) {
          message += `\n⚠️ ${updateResult.permissionWarning}`
        }
        if (updateResult.writableFields) {
          message += `\n✅ Updated fields: ${updateResult.writableFields.join(', ')}`
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

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const response = await fetch('/api/auth/merchant-logout', {
        method: 'POST'
      })
      
      if (response.ok) {
        // Redirect to login page
        router.push(`/login/${trainerName}`)
        router.refresh()
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              🎯 {trainerName.replace(/-/g, ' ')}
            </h1>
            {trainerData?.success && trainerData?.onboardingTrainerData?.trainers?.[0]?.lastModifiedDate && (
              <p className="text-sm text-gray-600 mt-2">
                Last Modified: {new Date(trainerData.onboardingTrainerData.trainers[0].lastModifiedDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadTrainerData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
            {trainerData?.success && (
              <div className="text-green-600" title={trainerData.message}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
            {loggingOut ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Logging out...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </>
            )}
          </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          {successMessage && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-green-700 font-medium whitespace-pre-line">{successMessage}</div>
            </div>
          )}

          {editingTrainer && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-blue-900 font-semibold mb-3">✏️ Editing: {editingTrainer.name}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Trainer Name
                  </label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    📅 First Revised EGLD
                  </label>
                  <input
                    type="date"
                    value={formatDate(editData.firstRevisedEGLD)}
                    onChange={(e) => handleFieldChange('firstRevisedEGLD', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    🎯 Onboarding Trainer Stage
                  </label>
                  <select
                    value={editData.onboardingTrainerStage || ''}
                    onChange={(e) => handleFieldChange('onboardingTrainerStage', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    📞 Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editData.phoneNumber || ''}
                    onChange={(e) => handleFieldChange('phoneNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    📞 Merchant PIC Contact Number
                  </label>
                  <input
                    type="tel"
                    value={editData.merchantPICContactNumber || ''}
                    onChange={(e) => handleFieldChange('merchantPICContactNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter merchant PIC contact number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    🔧 Installation Date
                  </label>
                  <input
                    type="date"
                    value={formatDate(editData.installationDate)}
                    onChange={(e) => handleFieldChange('installationDate', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    🎓 Training Date
                  </label>
                  <div className="flex gap-2">
                    {editData.trainingDate ? (
                      <>
                        <div className="flex-1 px-3 py-2 border border-blue-300 rounded-md bg-gray-50">
                          {formatDate(editData.trainingDate)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenBookingModal(editData)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          📅 Reschedule
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenBookingModal(editData)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        📅 Book Training via Lark
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={saveTrainer}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {saving ? '💾 Saving...' : '💾 Save to Salesforce'}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
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
                    <p className="text-sm font-medium">🔍 Debug Information:</p>
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
            <div className="mt-6">
              <OnboardingTimeline 
                currentStage={trainerData.onboardingTrainerData.trainers[0].onboardingTrainerStage}
                stageData={trainerData.onboardingTrainerData.trainers[0]}
                trainerData={trainerData.onboardingTrainerData.trainers[0]}
                onBookingComplete={handleBookingComplete}
                onOpenBookingModal={handleOpenBookingModal}
              />
            </div>
          )}

          {/* Merchant Details Section - FIRST SECTION */}
          {trainerData && trainerData.success && trainerData.onboardingTrainerData && trainerData.onboardingTrainerData.trainers && trainerData.onboardingTrainerData.trainers[0] && (
            <div className="mt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Merchant Details</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  {(() => {
                    const trainer = trainerData.onboardingTrainerData.trainers[0];
                    const formatAddress = () => {
                      const parts = [
                        trainer.shippingStreet,
                        trainer.shippingCity,
                        trainer.shippingState && trainer.shippingZipPostalCode 
                          ? `${trainer.shippingState} ${trainer.shippingZipPostalCode}`
                          : trainer.shippingState || trainer.shippingZipPostalCode,
                        trainer.shippingCountry
                      ].filter(Boolean);
                      return parts.length > 0 ? parts : ['N/A'];
                    };

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        {/* Left Column */}
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Trainer Name</div>
                            <div className="text-gray-900">{trainer.name || 'N/A'}</div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Account Name</div>
                            <div className="text-gray-900">{trainer.accountName || 'N/A'}</div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Shipping Address</div>
                            <div className="text-gray-900">
                              {formatAddress().map((line, index) => (
                                <div key={index}>{line}</div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Sub-Industry</div>
                            <div className="text-gray-900">{trainer.subIndustry || 'N/A'}</div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Preferred Language</div>
                            <div className="text-gray-900">{trainer.preferredLanguage || 'N/A'}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Onboarding Services Bought</div>
                            <div className="text-gray-900">{trainer.onboardingServicesBought || 'N/A'}</div>
                          </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Business Owner Contact</div>
                            <div className="text-gray-900">
                              {trainer.businessOwnerContact ? (
                                <>
                                  <div>{trainer.businessOwnerContact.name}</div>
                                  {trainer.businessOwnerContact.phone && (
                                    <div className="text-gray-600">{trainer.businessOwnerContact.phone}</div>
                                  )}
                                </>
                              ) : 'N/A'}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Merchant PIC Contact</div>
                            <div className="text-gray-900">{trainer.merchantPICContactNumber || 'N/A'}</div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Operation Manager</div>
                            <div className="text-gray-900">
                              {trainer.operationManagerContact ? (
                                <>
                                  <div>{trainer.operationManagerContact.name}</div>
                                  {trainer.operationManagerContact.phone && (
                                    <div className="text-gray-600">{trainer.operationManagerContact.phone}</div>
                                  )}
                                </>
                              ) : 'N/A'}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Planned Go-Live Date</div>
                            <div className="text-gray-900">
                              {trainer.plannedGoLiveDate ? new Date(trainer.plannedGoLiveDate).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Required Features</div>
                            <div className="text-gray-900 text-sm">
                              {trainer.requiredFeaturesByMerchant || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
            </div>
          )}

          {/* Product Section */}
          {trainerData && trainerData.success && ((trainerData.orderItems && trainerData.orderItems.length > 0) || (trainerData.onboardingTrainerData?.trainers?.[0])) ? (() => {
            // Group products by order type
            const groupedProducts = trainerData.orderItems ? trainerData.orderItems.reduce((acc: any, item: any) => {
              const orderType = item.orderType || 'Other'
              if (!acc[orderType]) {
                acc[orderType] = []
              }
              acc[orderType].push(item)
              return acc
            }, {}) : {}

            // Get currency info once for all products
            const trainer = trainerData.onboardingTrainerData?.trainers?.[0]
            const shippingCountry = trainer?.shippingCountry || ''
            const currencyInfo = getCurrencyInfo(shippingCountry)

            return (
              <div className="mt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">📦 Products & Payment</h3>
                <div className="space-y-6">
                  {/* Payment Summary at the top */}
                  {trainer && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Quote Total Amount */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                            Quote Total Amount
                          </div>
                          <div className="text-2xl font-bold text-blue-900">
                            {trainer.syncedQuoteTotalAmount !== null && trainer.syncedQuoteTotalAmount !== undefined 
                              ? formatCurrency(trainer.syncedQuoteTotalAmount, currencyInfo)
                              : 'Not Available'}
                          </div>
                          <div className="text-sm text-blue-600 mt-1">
                            Synced from quote
                          </div>
                        </div>
                        
                        {/* Pending Payment */}
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
                            Pending Payment
                          </div>
                          <div className="text-2xl font-bold text-amber-900">
                            {trainer.pendingPayment !== null && trainer.pendingPayment !== undefined
                              ? formatCurrency(trainer.pendingPayment, currencyInfo)
                              : 'Not Available'}
                          </div>
                          <div className="text-sm text-amber-600 mt-1">
                            Amount outstanding
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {Object.entries(groupedProducts).map(([orderType, items]: [string, any]) => (
                    <div key={orderType} className="bg-white border border-gray-200 rounded-lg p-6">
                      {/* Order Type as Subsection Header */}
                      <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {orderType}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">({items.length} items)</span>
                      </h4>
                      
                      {/* Products Table List */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {items.map((item: any, index: number) => (
                              <tr key={item.id || index} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm text-gray-900">{item.productName || 'N/A'}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.quantity || 1}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.unitPrice, currencyInfo)}</td>
                                <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.totalPrice, currencyInfo)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50">
                              <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-900 text-right">Order Total:</td>
                              <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
                                {formatCurrency(items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0), currencyInfo)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })() : null}


        </div>
      </div>

      {/* Booking Modal */}
      {bookingModalOpen && currentBookingInfo && (
        <BookingModal
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          merchantId={currentBookingInfo.trainerId || currentBookingInfo.id}
          merchantName={currentBookingInfo.merchantName || currentBookingInfo.name}
          merchantAddress={currentBookingInfo.merchantAddress}
          merchantPhone={currentBookingInfo.merchantPhone || currentBookingInfo.phoneNumber}
          merchantContactPerson={currentBookingInfo.merchantContactPerson}
          trainerName={currentBookingInfo.trainerName}
          bookingType={currentBookingInfo.bookingType}
          currentBooking={currentBookingInfo.existingBooking}
          onBookingComplete={handleBookingComplete}
        />
      )}
      
      {/* WhatsApp Floating Button */}
      <WhatsAppButton />
    </div>
  )
}
