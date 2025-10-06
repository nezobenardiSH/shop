'use client'

import { useState } from 'react'

export default function TestSalesforce() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🧪 Salesforce Connection Test
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <button
            onClick={testConnection}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? '🔄 Testing...' : '🚀 Test Salesforce Connection'}
          </button>

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
                {result.accountCount !== undefined && (
                  <p className="text-sm">Total Accounts: {result.accountCount}</p>
                )}
              </div>

              {result.accounts && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Sample Accounts:</h3>
                  <ul className="space-y-1">
                    {result.accounts.map((account: any) => (
                      <li key={account.id} className="text-sm">
                        <span className="font-mono text-xs text-gray-500">{account.id}</span>
                        <span className="ml-2">{account.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.customFieldsData && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">🎯 Custom Onboarding Fields Analysis:</h3>

                  {result.customFieldsData.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-red-700 font-medium">Error:</p>
                      <p className="text-red-600">{result.customFieldsData.error}</p>
                    </div>
                  ) : null}

                  {result.customFieldsData.account && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-green-900 mb-2">
                        ✅ Account Data: {result.customFieldsData.account.name}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div><strong>Business Store Name:</strong> {result.customFieldsData.account.businessStoreName || 'N/A'}</div>
                        <div><strong>Onboarding Trainer:</strong> {result.customFieldsData.account.onboardingTrainer || 'N/A'}</div>
                        <div><strong>Services Bought:</strong> {result.customFieldsData.account.servicesBought || 'N/A'}</div>
                        <div><strong>Latest SF Stage:</strong> {result.customFieldsData.account.latestSFStage || 'N/A'}</div>
                        <div><strong>Trainer Stage:</strong> {result.customFieldsData.account.onboardingTrainerStage || 'N/A'}</div>
                        <div><strong>Latest Stage Date:</strong> {result.customFieldsData.account.latestStageDate || 'N/A'}</div>
                        <div><strong>Planned Go Live:</strong> {result.customFieldsData.account.plannedGoLiveDate || 'N/A'}</div>
                        <div><strong>Finalised Go Live:</strong> {result.customFieldsData.account.finalisedGoLiveDate || 'N/A'}</div>
                        <div><strong>Go Live Timestamp:</strong> {result.customFieldsData.account.goLiveStageTimestamp || 'N/A'}</div>
                        <div><strong>Completed Timestamp:</strong> {result.customFieldsData.account.onboardingCompletedTimestamp || 'N/A'}</div>
                      </div>
                    </div>
                  )}

                  {result.customFieldsData.fieldTestResults && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-blue-900 mb-2">🔍 Field Existence Check:</h4>
                      <div className="space-y-1 text-sm">
                        {result.customFieldsData.fieldTestResults.map((test: any, index: number) => (
                          <div key={index} className="flex items-center">
                            <span className={`mr-2 ${test.exists ? 'text-green-600' : 'text-red-600'}`}>
                              {test.exists ? '✅' : '❌'}
                            </span>
                            <span className="font-mono text-xs">{test.field}</span>
                            {!test.exists && test.error && (
                              <span className="ml-2 text-red-500 text-xs">({test.error.substring(0, 50)}...)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.customFieldsData.availableCustomFields && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">📋 Available Custom Fields (first 20):</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs font-mono">
                        {result.customFieldsData.availableCustomFields.map((field: string, index: number) => (
                          <div key={index} className="text-gray-600">{field}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.opportunityData && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">💼 Opportunity Data:</h3>
                  {result.opportunityData.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700">{result.opportunityData.error}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Found {result.opportunityData.totalCount} opportunities for this account
                      </p>
                      <div className="space-y-3">
                        {result.opportunityData.opportunities.map((opp: any) => (
                          <div key={opp.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-semibold text-blue-900 mb-2">
                              {opp.name}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              <div><strong>Stage:</strong> {opp.stageName || 'N/A'}</div>
                              <div><strong>Amount:</strong> {opp.amount ? `$${opp.amount.toLocaleString()}` : 'N/A'}</div>
                              <div><strong>Close Date:</strong> {opp.closeDate || 'N/A'}</div>
                              <div><strong>Created:</strong> {opp.createdDate ? new Date(opp.createdDate).toLocaleDateString() : 'N/A'}</div>
                              <div className="md:col-span-2">
                                <strong>ID:</strong> <span className="font-mono text-xs text-gray-500">{opp.id}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
