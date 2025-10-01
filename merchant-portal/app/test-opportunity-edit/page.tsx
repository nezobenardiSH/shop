'use client'

import { useState } from 'react'

export default function TestOpportunityEdit() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null)

  const testConnection = async () => {
    setLoading(true)
    setSuccessMessage('')
    try {
      const response = await fetch('/api/salesforce/test')
      const data = await response.json()
      setResult(data)
      
      // Auto-select first opportunity if available
      if (data.opportunityData?.opportunities?.length > 0) {
        const firstOpp = data.opportunityData.opportunities[0]
        setSelectedOpportunity(firstOpp)
        setEditData(firstOpp)
      }
    } catch (error) {
      setResult({ success: false, message: `Error: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  const selectOpportunity = (opportunity: any) => {
    setSelectedOpportunity(opportunity)
    setEditData(opportunity)
    setSuccessMessage('')
  }

  const saveChanges = async () => {
    if (!selectedOpportunity?.id) {
      alert('No opportunity selected')
      return
    }

    setSaving(true)
    setSuccessMessage('')
    
    try {
      const response = await fetch('/api/salesforce/update-opportunity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          opportunityId: selectedOpportunity.id,
          updates: editData
        })
      })

      const updateResult = await response.json()
      
      if (updateResult.success) {
        let message = '✅ Successfully updated Opportunity in Salesforce!'
        if (updateResult.permissionWarning) {
          message += `\n⚠️ ${updateResult.permissionWarning}`
        }
        if (updateResult.writableFields) {
          message += `\n✅ Updated fields: ${updateResult.writableFields.join(', ')}`
        }
        setSuccessMessage(message)
        
        // Update the result with new data
        if (updateResult.updatedData) {
          setEditData(updateResult.updatedData)
          setSelectedOpportunity(updateResult.updatedData)
          
          // Update the opportunity in the list
          setResult(prev => ({
            ...prev,
            opportunityData: {
              ...prev.opportunityData,
              opportunities: prev.opportunityData.opportunities.map((opp: any) => 
                opp.id === selectedOpportunity.id ? updateResult.updatedData : opp
              )
            }
          }))
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          💼 Editable Opportunity Data
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <button
            onClick={testConnection}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors mr-4"
          >
            {loading ? '🔄 Loading...' : '📥 Load Opportunity Data'}
          </button>

          {selectedOpportunity && (
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
              </div>

              {/* Debug Information */}
              {result.opportunityData && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 mb-2">🔍 Debug Info:</h4>
                  <pre className="text-xs text-yellow-800 overflow-auto">
                    {JSON.stringify(result.opportunityData, null, 2)}
                  </pre>
                </div>
              )}

              {result.opportunityData?.opportunities && result.opportunityData.opportunities.length > 0 ? (
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Opportunity List */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">💼 Select Opportunity to Edit:</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {result.opportunityData.opportunities.map((opp: any) => (
                        <div
                          key={opp.id}
                          onClick={() => selectOpportunity(opp)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedOpportunity?.id === opp.id
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <h4 className="font-medium text-gray-900">{opp.name}</h4>
                          <p className="text-sm text-gray-600">Stage: {opp.stageName}</p>
                          <p className="text-sm text-gray-600">
                            Amount: {opp.amount ? `$${opp.amount.toLocaleString()}` : 'N/A'}
                          </p>
                          <p className="text-sm text-blue-600">
                            🎯 Trainer: {opp.onboardingTrainerName || 'N/A'}
                          </p>
                          <p className="text-sm text-green-600">
                            📅 First Revised EGLD: {opp.firstRevisedEGLD || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">{opp.id}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edit Form */}
                  {selectedOpportunity && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">✏️ Edit: {selectedOpportunity.name}</h3>
                      
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <div className="space-y-4">
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Opportunity Name
                            </label>
                            <input
                              type="text"
                              value={editData.name || ''}
                              onChange={(e) => handleFieldChange('name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Stage Name
                            </label>
                            <input
                              type="text"
                              value={editData.stageName || ''}
                              onChange={(e) => handleFieldChange('stageName', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Amount
                            </label>
                            <input
                              type="number"
                              value={editData.amount || ''}
                              onChange={(e) => handleFieldChange('amount', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Close Date
                            </label>
                            <input
                              type="date"
                              value={formatDate(editData.closeDate)}
                              onChange={(e) => handleFieldChange('closeDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              🎯 Onboarding Trainer
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
                              🎯 First Revised EGLD
                            </label>
                            <input
                              type="date"
                              value={formatDate(editData.firstRevisedEGLD)}
                              onChange={(e) => handleFieldChange('firstRevisedEGLD', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : result.opportunityData ? (
                <div className="mt-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-yellow-900 mb-2">⚠️ No Opportunities Found</h3>
                    <p className="text-yellow-800">
                      {result.opportunityData.error ?
                        `Error: ${result.opportunityData.error}` :
                        `Found ${result.opportunityData.totalCount || 0} opportunities for this account.`
                      }
                    </p>
                    {result.opportunityData.totalCount === 0 && (
                      <p className="text-yellow-700 mt-2">
                        This might mean:
                        <br />• No opportunities exist for this account
                        <br />• Opportunities exist but are linked to a different account
                        <br />• Permission issues accessing opportunity data
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
