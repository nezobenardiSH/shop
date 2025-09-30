'use client'

export default function MerchantDashboard({
  params
}: {
  params: { merchant: string }
}) {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">
        Merchant Dashboard
      </h1>
      <p className="text-lg text-gray-600">
        Welcome, {params.merchant}
      </p>
      <div className="mt-8 p-6 bg-white rounded-lg shadow">
        <p className="text-gray-500">Dashboard content coming soon...</p>
      </div>
    </div>
  )
}