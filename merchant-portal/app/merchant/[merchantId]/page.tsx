'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BookingModal from '@/components/BookingModal'

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
    // Determine which actual trainer to use based on Salesforce data
    // This could be from a field like trainer.assignedTrainerEmail or trainer.operationManagerEmail
    let actualTrainerName = 'Nezo'; // Default trainer
    
    // Option 1: Use Operation Manager name if it matches a configured trainer
    if (trainer.operationManagerContact?.name) {
      actualTrainerName = trainer.operationManagerContact.name;
    }
    
    // Option 2: Map based on merchant name or other logic
    // For example: Nasi Lemak -> Nezo, Other merchants -> Jia En
    
    setCurrentBookingInfo({
      trainerId: trainer.id,
      trainerName: actualTrainerName, // Use the actual trainer name for Lark
      merchantName: trainerData?.account?.businessStoreName || trainerData?.account?.name || trainer.name || 'Unknown Merchant',
      merchantAddress: trainerData?.account?.billingAddress || '',
      merchantPhone: trainer.phoneNumber || trainer.merchantPICContactNumber || '',
      merchantContactPerson: trainer.operationManagerContact?.name || trainer.businessOwnerContact?.name || '',
      displayName: trainer.name, // Keep the Salesforce trainer name for display
      existingBooking: trainer.larkEventId ? {
        eventId: trainer.larkEventId,
        date: trainer.trainingDate ? new Date(trainer.trainingDate).toLocaleDateString() : '',
        time: 'Scheduled'
      } : null
    })
    setBookingModalOpen(true)
  }

  const handleBookingComplete = async () => {
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
              🎯 Trainer Portal
            </h1>
            <p className="text-gray-600 mt-2">
              Trainer: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{trainerName}</span>
            </p>
          </div>
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
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <button
            onClick={loadTrainerData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? '🔄 Loading...' : '📥 Load Trainer Data'}
          </button>

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

          {trainerData && (
            <div className="mt-6">
              <div className={`p-4 rounded-lg border ${
                trainerData.success
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <p className="font-medium">{trainerData.message}</p>

                {!trainerData.success && trainerData.availableTrainers && (
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

              {/* Merchant Details Section - FIRST SECTION */}
              {trainerData.onboardingTrainerData && trainerData.onboardingTrainerData.trainers && trainerData.onboardingTrainerData.trainers[0] && (
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

              {/* Payment Section */}
              {trainerData.onboardingTrainerData && trainerData.onboardingTrainerData.trainers && trainerData.onboardingTrainerData.trainers[0] && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">💳 Payment Information</h3>
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    {(() => {
                      const trainer = trainerData.onboardingTrainerData.trainers[0];
                      const currencyInfo = getCurrencyInfo(trainer.shippingCountry || '');
                      
                      return (
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
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Product Section */}
              {trainerData.orderItems && trainerData.orderItems.length > 0 && (() => {
                // Group products by order type
                const groupedProducts = trainerData.orderItems.reduce((acc: any, item: any) => {
                  const orderType = item.orderType || 'Other'
                  if (!acc[orderType]) {
                    acc[orderType] = []
                  }
                  acc[orderType].push(item)
                  return acc
                }, {})

                // Get currency info once for all products
                const trainer = trainerData.onboardingTrainerData?.trainers?.[0]
                const shippingCountry = trainer?.shippingCountry || ''
                const currencyInfo = getCurrencyInfo(shippingCountry)

                return (
                  <div className="mt-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">📦 Products</h3>
                    <div className="space-y-6">
                      {Object.entries(groupedProducts).map(([orderType, items]: [string, any]) => (
                        <div key={orderType} className="bg-white border border-gray-200 rounded-lg p-6">
                          {/* Order Type as Subsection Header */}
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                              {orderType}
                            </span>
                            <span className="ml-2 text-sm text-gray-500">({items.length} items)</span>
                          </h4>
                          
                          {/* Products Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item: any, index: number) => (
                              <div key={item.id || index} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50">
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Product Name</div>
                                    <div className="text-gray-900 font-medium">{item.productName || 'N/A'}</div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Unit Price</div>
                                      <div className="text-gray-900">
                                        {formatCurrency(item.unitPrice, currencyInfo)}
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Price</div>
                                      <div className="text-gray-900 font-semibold">
                                        {formatCurrency(item.totalPrice, currencyInfo)}
                                      </div>
                                    </div>
                                  </div>

                                  {item.quantity && (
                                    <div>
                                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Quantity</div>
                                      <div className="text-gray-900">{item.quantity}</div>
                                    </div>
                                  )}

                                  <div>
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Product ID</div>
                                    <div className="text-gray-600 text-xs font-mono truncate" title={item.product2Id}>
                                      {item.product2Id || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}


              {/* Onboarding Trainer Data */}
              {trainerData.onboardingTrainerData && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">🎯 Onboarding Trainer</h3>

                  {trainerData.onboardingTrainerData.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700 font-medium">Error loading trainer:</p>
                      <p className="text-red-600">{trainerData.onboardingTrainerData.error}</p>
                    </div>
                  ) : trainerData.onboardingTrainerData.trainers && trainerData.onboardingTrainerData.trainers.length > 0 ? (
                    <div>
                      <p className="text-gray-600 mb-4">
                        Showing trainer: {trainerData.onboardingTrainerData.trainers[0].name}
                      </p>
                      <div className="space-y-4">
                        {trainerData.onboardingTrainerData.trainers.map((trainer: any) => (
                          <div key={trainer.id} className="bg-green-50 border border-green-200 rounded-lg p-6">
                            <div className="flex justify-between items-start mb-4">
                              <h4 className="text-lg font-semibold text-green-900">
                                🎯 {trainer.name}
                              </h4>
                              <button
                                onClick={() => startEditing(trainer)}
                                disabled={editingTrainer?.id === trainer.id}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-1 px-3 rounded transition-colors"
                              >
                                {editingTrainer?.id === trainer.id ? 'Editing...' : '✏️ Edit'}
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="bg-yellow-50 p-4 rounded border border-yellow-300">
                                <strong className="text-yellow-800">📅 First Revised EGLD:</strong>
                                {editingFields[`egld-${trainer.id}`] ? (
                                  <div className="mt-2 space-y-2">
                                    <input
                                      type="date"
                                      value={formatDate(tempFieldValues[`egld-${trainer.id}`])}
                                      onChange={(e) => setTempFieldValues({ ...tempFieldValues, [`egld-${trainer.id}`]: e.target.value })}
                                      className="w-full px-2 py-1 border border-yellow-400 rounded"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleSaveField('firstRevisedEGLD', trainer.id)}
                                        disabled={saving}
                                        className="px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
                                      >
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        onClick={() => handleCancelField(`egld-${trainer.id}`)}
                                        className="px-2 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between mt-1">
                                    <div className="text-lg font-medium text-yellow-900">
                                      {trainer.firstRevisedEGLD || 'N/A'}
                                    </div>
                                    <button
                                      onClick={() => handleEditField(`egld-${trainer.id}`, trainer.firstRevisedEGLD)}
                                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                    >
                                      ✏️ Edit
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="bg-purple-50 p-4 rounded border border-purple-300">
                                <strong className="text-purple-800">🎯 Current Stage:</strong>
                                {editingFields[`stage-${trainer.id}`] ? (
                                  <div className="mt-2 space-y-2">
                                    <select
                                      value={tempFieldValues[`stage-${trainer.id}`] || ''}
                                      onChange={(e) => setTempFieldValues({ ...tempFieldValues, [`stage-${trainer.id}`]: e.target.value })}
                                      className="w-full px-2 py-1 border border-purple-400 rounded"
                                    >
                                      <option value="">Select a stage...</option>
                                      {availableStages.map((stage) => (
                                        <option key={stage.value} value={stage.value}>
                                          {stage.label}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleSaveField('onboardingTrainerStage', trainer.id)}
                                        disabled={saving}
                                        className="px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
                                      >
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        onClick={() => handleCancelField(`stage-${trainer.id}`)}
                                        className="px-2 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between mt-1">
                                    <div className="text-lg font-medium text-purple-900">
                                      {trainer.onboardingTrainerStage || 'N/A'}
                                    </div>
                                    <button
                                      onClick={() => handleEditField(`stage-${trainer.id}`, trainer.onboardingTrainerStage)}
                                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                    >
                                      ✏️ Edit
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="bg-orange-50 p-4 rounded border border-orange-300">
                                <strong className="text-orange-800">🔧 Installation Date:</strong>
                                <div className="text-lg font-medium text-orange-900">
                                  {trainer.installationDate ? new Date(trainer.installationDate).toLocaleDateString() : 'Not Scheduled'}
                                </div>
                                <button
                                  onClick={() => handleOpenBookingModal({ ...trainer, bookingType: 'installation' })}
                                  className="mt-2 px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                                >
                                  {trainer.installationDate ? '📅 Reschedule' : '📅 Book Installation'}
                                </button>
                              </div>

                              <div className="bg-blue-50 p-4 rounded border border-blue-300">
                                <strong className="text-blue-800">🎓 Training Date:</strong>
                                <div className="text-lg font-medium text-blue-900">
                                  {trainer.trainingDate ? new Date(trainer.trainingDate).toLocaleDateString() : 'Not Scheduled'}
                                </div>
                                <button
                                  onClick={() => handleOpenBookingModal(trainer)}
                                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                >
                                  {trainer.trainingDate ? '📅 Reschedule' : '📅 Book Training'}
                                </button>
                              </div>

                              {/* Contact Phone Information */}
                              <div className="bg-green-50 p-4 rounded border border-green-300">
                                <strong className="text-green-800">📞 Contact Information:</strong>
                                <div className="mt-2 space-y-3">
                                  {trainer.phoneNumber && (
                                    <div className="text-green-900 bg-white p-2 rounded border">
                                      <strong>Phone Number:</strong> {trainer.phoneNumber}
                                    </div>
                                  )}
                                  {trainer.merchantPICContactNumber && (
                                    <div className="text-green-900 bg-white p-2 rounded border">
                                      <strong>Merchant PIC Contact:</strong> {trainer.merchantPICContactNumber}
                                    </div>
                                  )}
                                  {trainer.operationManagerContact && (
                                    <div className="text-green-900 bg-white p-2 rounded border">
                                      <div>
                                        <strong>Operation Manager:</strong> {trainer.operationManagerContact.name}
                                      </div>
                                      {trainer.operationManagerContact.phone && (
                                        <div className="text-sm text-gray-600 mt-1">
                                          📞 {trainer.operationManagerContact.phone}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {trainer.businessOwnerContact && (
                                    <div className="text-green-900 bg-white p-2 rounded border">
                                      <div>
                                        <strong>Business Owner:</strong> {trainer.businessOwnerContact.name}
                                      </div>
                                      {trainer.businessOwnerContact.phone && (
                                        <div className="text-sm text-gray-600 mt-1">
                                          📞 {trainer.businessOwnerContact.phone}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {!trainer.phoneNumber && !trainer.merchantPICContactNumber &&
                                   !trainer.operationManagerContact && !trainer.businessOwnerContact && (
                                    <div className="text-gray-500 italic">No contact information available</div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-3 rounded border">
                                <strong className="text-green-800">Created Date:</strong>
                                <div className="text-green-900">
                                  {trainer.createdDate ? new Date(trainer.createdDate).toLocaleDateString() : 'N/A'}
                                </div>
                              </div>

                              <div className="bg-white p-3 rounded border">
                                <strong className="text-green-800">Last Modified:</strong>
                                <div className="text-green-900">
                                  {trainer.lastModifiedDate ? new Date(trainer.lastModifiedDate).toLocaleDateString() : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 font-medium">No trainer found with this name</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Stage Tabs Section */}
          {availableStages.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                🎯 Onboarding Trainer Stages
              </h2>

              {/* Tab Navigation */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                  {availableStages.map((stage) => {
                    const isActive = activeTab === stage.value
                    const isCurrent = trainerData?.onboardingTrainerData?.trainers?.[0]?.onboardingTrainerStage === stage.value

                    return (
                      <button
                        key={stage.value}
                        onClick={() => setActiveTab(stage.value)}
                        className={`
                          whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                          ${isActive
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }
                          ${isCurrent ? 'bg-green-50 rounded-t-lg px-3' : ''}
                        `}
                      >
                        {isCurrent && '✅ '}
                        {stage.label}
                      </button>
                    )
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="mt-4">
                {availableStages.map((stage) => (
                  <div
                    key={stage.value}
                    className={`${activeTab === stage.value ? 'block' : 'hidden'}`}
                  >
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        {stage.label}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded border">
                          <strong className="text-gray-700">Stage Value:</strong>
                          <div className="text-gray-900 font-mono text-sm">
                            {stage.value}
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded border">
                          <strong className="text-gray-700">Status:</strong>
                          <div className="text-gray-900">
                            {stage.active ? (
                              <span className="text-green-600">✅ Active</span>
                            ) : (
                              <span className="text-red-600">❌ Inactive</span>
                            )}
                            {stage.defaultValue && (
                              <span className="ml-2 text-blue-600">🔹 Default</span>
                            )}
                          </div>
                        </div>

                        {trainerData?.onboardingTrainerData?.trainers?.[0]?.onboardingTrainerStage === stage.value && (
                          <div className="md:col-span-2 bg-green-50 p-3 rounded border border-green-300">
                            <strong className="text-green-800">🎯 Current Stage:</strong>
                            <div className="text-green-900">
                              This trainer is currently at this stage
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {bookingModalOpen && currentBookingInfo && (
        <BookingModal
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          merchantId={currentBookingInfo.trainerId}
          merchantName={currentBookingInfo.merchantName}
          merchantAddress={currentBookingInfo.merchantAddress}
          merchantPhone={currentBookingInfo.merchantPhone}
          merchantContactPerson={currentBookingInfo.merchantContactPerson}
          trainerName={currentBookingInfo.trainerName}
          currentBooking={currentBookingInfo.existingBooking}
          onBookingComplete={handleBookingComplete}
        />
      )}
    </div>
  )
}
