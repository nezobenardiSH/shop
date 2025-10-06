export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center py-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Merchant Onboarding Portal
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Streamline your onboarding process with real-time Salesforce integration
          </p>

          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              How to Access Your Dashboard
            </h2>
            <p className="text-gray-600 mb-4">
              Navigate to your personalized merchant URL to access your onboarding dashboard:
            </p>
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <code className="text-lg font-mono text-blue-600">
                yoursite.com/[your-merchant-name]
              </code>
            </div>
            <p className="text-sm text-gray-500">
              Example: <code className="bg-gray-200 px-2 py-1 rounded">yoursite.com/bestbuy</code>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Update Information</h3>
              <p className="text-gray-600 text-sm">
                Keep your business details current with real-time updates
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-4 8a2 2 0 100-4 2 2 0 000 4zm6 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Schedule Dates</h3>
              <p className="text-gray-600 text-sm">
                Set installation and training dates that work for you
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Salesforce Sync</h3>
              <p className="text-gray-600 text-sm">
                All changes sync automatically with your Salesforce account
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Need Help?</h3>
            <p className="text-blue-700">
              Contact your Merchant Onboarding Manager for assistance or if you need your merchant URL.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}