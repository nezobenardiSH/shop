'use client'

import { useState } from 'react'

export default function TestSalesforceEdit() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [successMessage, setSuccessMessage] = useState('')

  const testConnection = async () => {
    setLoading(true)
    setSuccessMessage('')
    try {
      const response = await fetch('/api/salesforce/test')
      const data = await response.json()
      setResult(data)
      
      // Initialize edit data with current values
      if (data.customFieldsData?.account) {
        setEditData(data.customFieldsData.account)
      }
    } catch (error) {
      setResult({ success: false, message: `Error: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  const saveChanges = async () => {
    if (!result?.customFieldsData?.account?.id) {
      alert('No account data to update')
      return
    }

    setSaving(true)
    setSuccessMessage('')
    
    try {
      const response = await fetch('/api/salesforce/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: result.customFieldsData.account.id,
          updates: editData
        })
      })

      const updateResult = await response.json()
      
      if (updateResult.success) {
        let message = '✅ Successfully updated Salesforce!'
        if (updateResult.permissionWarning) {
          message += `\n⚠️ ${updateResult.permissionWarning}`
        }
        if (updateResult.writableFields) {
          message += `\n✅ Updated fields: ${updateResult.writableFields.join(', ')}`
        }
        setSuccessMessage(message)

        // Update the result with new data
        if (updateResult.updatedData) {
          setResult(prev => ({
            ...prev,
            customFieldsData: {
              ...prev.customFieldsData,
              account: updateResult.updatedData
            }
          }))
          setEditData(updateResult.updatedData)
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

  const formatDateTime = (dateTimeString: string) => {
    if (!dateTimeString) return ''
    try {
      return new Date(dateTimeString).toISOString().slice(0, 16)
    } catch {
      return dateTimeString
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          ✏️ Editable Salesforce Data
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <button
            onClick={testConnection}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors mr-4"
          >
            {loading ? '🔄 Loading...' : '📥 Load Salesforce Data'}
          </button>

          {result?.customFieldsData?.account && (
            <button
              onClick={saveChanges}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {saving ? '💾 Saving...' : '💾 Save to Salesforce'}
            </button>
          )}

          {successMessage && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-green-700 font-medium whitespace-pre-line">{successMessage}</div>
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

              {result.customFieldsData?.account && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">✏️ Edit Account Data: {result.customFieldsData.account.name}</h3>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Business Store Name
                        </label>
                        <input
                          type="text"
                          value={editData.businessStoreName || ''}
                          onChange={(e) => handleFieldChange('businessStoreName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Onboarding Trainer
                        </label>
                        <input
                          type="text"
                          value={editData.onboardingTrainer || ''}
                          onChange={(e) => handleFieldChange('onboardingTrainer', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Services Bought
                        </label>
                        <input
                          type="text"
                          value={editData.servicesBought || ''}
                          onChange={(e) => handleFieldChange('servicesBought', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Latest SF Stage
                        </label>
                        <input
                          type="text"
                          value={editData.latestSFStage || ''}
                          onChange={(e) => handleFieldChange('latestSFStage', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Trainer Stage
                        </label>
                        <input
                          type="text"
                          value={editData.onboardingTrainerStage || ''}
                          onChange={(e) => handleFieldChange('onboardingTrainerStage', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Planned Go Live Date
                        </label>
                        <input
                          type="date"
                          value={formatDate(editData.plannedGoLiveDate)}
                          onChange={(e) => handleFieldChange('plannedGoLiveDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Finalised Go Live Date
                        </label>
                        <input
                          type="date"
                          value={formatDate(editData.finalisedGoLiveDate)}
                          onChange={(e) => handleFieldChange('finalisedGoLiveDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Latest Stage Date
                        </label>
                        <input
                          type="date"
                          value={formatDate(editData.latestStageDate)}
                          onChange={(e) => handleFieldChange('latestStageDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Go Live Stage Timestamp
                        </label>
                        <input
                          type="datetime-local"
                          value={formatDateTime(editData.goLiveStageTimestamp)}
                          onChange={(e) => handleFieldChange('goLiveStageTimestamp', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Onboarding Completed Timestamp
                        </label>
                        <input
                          type="datetime-local"
                          value={formatDateTime(editData.onboardingCompletedTimestamp)}
                          onChange={(e) => handleFieldChange('onboardingCompletedTimestamp', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
