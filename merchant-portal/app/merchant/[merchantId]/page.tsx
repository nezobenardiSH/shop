'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function TrainerPortal() {
  const params = useParams()
  const trainerName = params.merchantId as string
  
  const [trainerData, setTrainerData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editingTrainer, setEditingTrainer] = useState<any>(null)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [availableStages, setAvailableStages] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [reminderLoading, setReminderLoading] = useState<string | null>(null)

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

  const handleReminder = async (phoneNumber: string, contactType: string) => {
    setReminderLoading(phoneNumber)
    try {
      // Here you can implement the reminder functionality
      // For now, we'll just show a success message
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call

      setSuccessMessage(`Reminder sent to ${contactType}: ${phoneNumber}`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Failed to send reminder:', error)
      setSuccessMessage(`Failed to send reminder to ${phoneNumber}`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setReminderLoading(null)
    }
  }

  useEffect(() => {
    if (trainerName) {
      loadTrainerData()
      loadAvailableStages()
    }
  }, [trainerName])

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
          setTrainerData(prev => ({
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
    setEditData(prev => ({
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            🎯 Trainer Portal
          </h1>
          <p className="text-gray-600 mt-2">
            Trainer: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{trainerName}</span>
          </p>
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

              {/* Account Data */}
              {trainerData.account && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">🏢 Account Information</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-blue-900 mb-3">
                      {trainerData.account.name}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded border">
                        <strong className="text-blue-800">Business Store Name:</strong>
                        <div className="text-lg text-blue-900 font-medium">
                          {trainerData.account.businessStoreName || 'N/A'}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <strong className="text-blue-800">Account ID:</strong>
                        <div className="text-sm font-mono text-gray-600">
                          {trainerData.account.id}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                                <div className="text-lg font-medium text-yellow-900">
                                  {trainer.firstRevisedEGLD || 'N/A'}
                                </div>
                              </div>

                              <div className="bg-purple-50 p-4 rounded border border-purple-300">
                                <strong className="text-purple-800">🎯 Current Stage:</strong>
                                <div className="text-lg font-medium text-purple-900">
                                  {trainer.onboardingTrainerStage || 'N/A'}
                                </div>
                              </div>

                              <div className="bg-orange-50 p-4 rounded border border-orange-300">
                                <strong className="text-orange-800">🔧 Installation Date:</strong>
                                <div className="text-lg font-medium text-orange-900">
                                  {trainer.installationDate ? new Date(trainer.installationDate).toLocaleDateString() : 'N/A'}
                                </div>
                              </div>

                              {/* Contact Phone Information */}
                              <div className="bg-green-50 p-4 rounded border border-green-300">
                                <strong className="text-green-800">📞 Contact Information:</strong>
                                <div className="mt-2 space-y-3">
                                  {trainer.phoneNumber && (
                                    <div className="flex items-center justify-between text-green-900 bg-white p-2 rounded border">
                                      <div>
                                        <strong>Phone Number:</strong> {trainer.phoneNumber}
                                      </div>
                                      <button
                                        onClick={() => handleReminder(trainer.phoneNumber, 'Phone Number')}
                                        disabled={reminderLoading === trainer.phoneNumber}
                                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                      >
                                        {reminderLoading === trainer.phoneNumber ? '⏳' : '🔔 Reminder'}
                                      </button>
                                    </div>
                                  )}
                                  {trainer.merchantPICContactNumber && (
                                    <div className="flex items-center justify-between text-green-900 bg-white p-2 rounded border">
                                      <div>
                                        <strong>Merchant PIC Contact:</strong> {trainer.merchantPICContactNumber}
                                      </div>
                                      <button
                                        onClick={() => handleReminder(trainer.merchantPICContactNumber, 'Merchant PIC')}
                                        disabled={reminderLoading === trainer.merchantPICContactNumber}
                                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                      >
                                        {reminderLoading === trainer.merchantPICContactNumber ? '⏳' : '🔔 Reminder'}
                                      </button>
                                    </div>
                                  )}
                                  {trainer.operationManagerContact && (
                                    <div className="text-green-900 bg-white p-2 rounded border">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <strong>Operation Manager:</strong> {trainer.operationManagerContact.name}
                                        </div>
                                        {trainer.operationManagerContact.phone && (
                                          <button
                                            onClick={() => handleReminder(trainer.operationManagerContact.phone, `Operation Manager (${trainer.operationManagerContact.name})`)}
                                            disabled={reminderLoading === trainer.operationManagerContact.phone}
                                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                          >
                                            {reminderLoading === trainer.operationManagerContact.phone ? '⏳' : '🔔 Reminder'}
                                          </button>
                                        )}
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
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <strong>Business Owner:</strong> {trainer.businessOwnerContact.name}
                                        </div>
                                        {trainer.businessOwnerContact.phone && (
                                          <button
                                            onClick={() => handleReminder(trainer.businessOwnerContact.phone, `Business Owner (${trainer.businessOwnerContact.name})`)}
                                            disabled={reminderLoading === trainer.businessOwnerContact.phone}
                                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                          >
                                            {reminderLoading === trainer.businessOwnerContact.phone ? '⏳' : '🔔 Reminder'}
                                          </button>
                                        )}
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
    </div>
  )
}
