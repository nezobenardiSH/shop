'use client'

import { useState } from 'react'

export default function TestCombined() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editingTrainer, setEditingTrainer] = useState<any>(null)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const loadData = async () => {
    setLoading(true)
    setSuccessMessage('')
    try {
      const response = await fetch('/api/salesforce/test')
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ success: false, message: `Error: ${error}` })
    } finally {
      setLoading(false)
    }
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

        // Update the result with new data
        if (updateResult.updatedData) {
          setResult((prev: any) => ({
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🏢 Account & Opportunity Data
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <button
            onClick={loadData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? '🔄 Loading...' : '📥 Load Account & Opportunity Data'}
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
                    🎓 Training Date
                  </label>
                  <input
                    type="date"
                    value={formatDate(editData.trainingDate)}
                    onChange={(e) => handleFieldChange('trainingDate', e.target.value)}
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

          {result && (
            <div className="mt-6">
              <div className={`p-4 rounded-lg border ${
                result.success 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <p className="font-medium">{result.message}</p>
                {result.environment && (
                  <p className="text-sm mt-1">Environment: {result.environment}</p>
                )}
                {result.orgName && (
                  <p className="text-sm">Organization: {result.orgName}</p>
                )}
              </div>

              {/* Account Data */}
              {result.customFieldsData?.account && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">🏢 Account Data</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-blue-900 mb-3">
                      {result.customFieldsData.account.name}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded border">
                        <strong className="text-blue-800">Business Store Name:</strong>
                        <div className="text-lg text-blue-900 font-medium">
                          {result.customFieldsData.account.businessStoreName || 'N/A'}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <strong className="text-blue-800">Account ID:</strong>
                        <div className="text-sm font-mono text-gray-600">
                          {result.customFieldsData.account.id}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Onboarding Trainer Data */}
              {result.onboardingTrainerData && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">🎯 Onboarding Trainer Data</h3>
                  
                  {result.onboardingTrainerData.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700 font-medium">Error loading onboarding trainers:</p>
                      <p className="text-red-600">{result.onboardingTrainerData.error}</p>
                    </div>
                  ) : result.onboardingTrainerData.trainers && result.onboardingTrainerData.trainers.length > 0 ? (
                    <div>
                      <p className="text-gray-600 mb-4">
                        Found {result.onboardingTrainerData.totalCount} onboarding trainers
                      </p>
                      <div className="space-y-4">
                        {result.onboardingTrainerData.trainers.map((trainer: any) => (
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

                              <div className="bg-blue-50 p-4 rounded border border-blue-300">
                                <strong className="text-blue-800">🎓 Training Date:</strong>
                                <div className="text-lg font-medium text-blue-900">
                                  {trainer.trainingDate ? new Date(trainer.trainingDate).toLocaleDateString() : 'N/A'}
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

                              <div className="bg-gray-50 p-3 rounded border md:col-span-3">
                                <strong className="text-gray-800">Trainer ID:</strong>
                                <div className="text-xs font-mono text-gray-600">{trainer.id}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 font-medium">No onboarding trainers found</p>
                      <p className="text-yellow-700 text-sm mt-1">
                        Total trainers in query result: {result.onboardingTrainerData.totalCount || 0}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Debug Information */}
              {result.onboardingTrainerData && (
                <div className="mt-6">
                  <details className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                    <summary className="cursor-pointer font-medium text-gray-700">
                      🔍 Debug Information (Click to expand)
                    </summary>
                    <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-96">
                      {JSON.stringify(result.onboardingTrainerData, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
