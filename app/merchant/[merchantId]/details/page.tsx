'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import DatePickerModal from '@/components/DatePickerModal'
import WhatsAppButton from '@/components/WhatsAppButton'
import MerchantHeader from '@/components/MerchantHeader'
import PageHeader from '@/components/PageHeader'
import { usePageTracking } from '@/lib/useAnalytics'

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

export default function MerchantDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const merchantId = params.merchantId as string // This is now the Salesforce ID

  const [trainerData, setTrainerData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [currentBookingInfo, setCurrentBookingInfo] = useState<any>(null)
  const [isInternalUser, setIsInternalUser] = useState(false)

  const checkUserType = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()
      if (data.success && data.user) {
        setIsInternalUser(data.user.isInternalUser || false)
      }
    } catch (error) {
      console.error('Failed to check user type:', error)
    }
  }

  const loadTrainerData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/salesforce/merchant/${merchantId}`)
      const data = await response.json()
      console.log('📦 Merchant data received:', data)
      console.log('📦 Order NS Number:', data.orderNSOrderNumber)
      setTrainerData(data)

      // Update page title with merchant name
      if (data.success && data.name) {
        document.title = `${data.name} - Details - Onboarding Portal`
      }
    } catch (error) {
      setTrainerData({ success: false, message: `Error: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkUserType()
    loadTrainerData()
  }, [merchantId])

  const handleOpenBookingModal = (trainer: any) => {
    // For future use: Determine which date to use based on bookingType
    let actualTrainerName = 'Nezo'; // Default trainer

    // Option 1: Use Operation Manager name if it matches a configured trainer
    if (trainer.operationManagerContact?.name) {
      actualTrainerName = trainer.operationManagerContact.name;
    }

    // Use shipping state and country for location detection
    // This is enough to determine if within Klang Valley, Penang, Johor, or outside
    const merchantAddress = [
      trainer.shippingState,
      trainer.shippingCountry
    ].filter(Boolean).join(', ');
    
    console.log('🏢 Setting booking info with:', {
      shippingState: trainer.shippingState,
      shippingCity: trainer.shippingCity,
      shippingCountry: trainer.shippingCountry,
      merchantAddress,
      serviceType: trainer.serviceType,
      onboardingServicesBought: trainer.onboardingServicesBought
    });

    setCurrentBookingInfo({
      trainerId: trainer.id,
      trainerName: actualTrainerName, // Use the actual trainer name for Lark
      merchantName: trainerData?.account?.businessStoreName || trainerData?.account?.name || trainer.name || 'Unknown Merchant',
      merchantAddress: merchantAddress || '', // Use constructed address from shipping fields
      merchantState: (trainer.shippingCity && trainer.shippingState 
        ? `${trainer.shippingCity}, ${trainer.shippingState}`
        : trainer.shippingState || trainer.shippingCity || ''), // Include city with state for better display
      merchantPhone: trainer.phoneNumber || trainer.merchantPICContactNumber || '',
      merchantContactPerson: trainer.operationManagerContact?.name || trainer.businessOwnerContact?.name || '',
      displayName: trainer.name, // Keep the Salesforce trainer name for display
      bookingType: trainer.bookingType || 'training', // Pass the booking type
      requiredFeatures: trainer.requiredFeaturesByMerchant, // Pass required features for training bookings
      onboardingSummary: trainer.onboardingSummary, // Pass onboarding summary
      workaroundElaboration: trainer.workaroundElaboration, // Pass workaround elaboration
      onboardingServicesBought: trainer.onboardingServicesBought, // Pass the service type for location filtering
      existingBooking: null // Don't pass existing booking for now, let user select new date
    })
    setBookingModalOpen(true)
  }

  const handleBookingComplete = async () => {
    console.log('Booking completed, refreshing trainer data...')

    // Refresh the trainer data to show the new training date
    await loadTrainerData()

    // Clear booking modal state
    setBookingModalOpen(false)
    setCurrentBookingInfo(null)
  }

  // Get merchant name from API response
  const merchantName = trainerData?.success && trainerData?.name ? trainerData.name : 'Loading...'

  // Track page view
  usePageTracking(merchantId, merchantName !== 'Loading...' ? merchantName : undefined, 'details')

  return (
    <div className="min-h-screen bg-[#faf9f6] py-4">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <MerchantHeader
            onRefresh={loadTrainerData}
            loading={loading}
            merchantId={merchantId}
          />
        </div>

        <PageHeader
          merchantId={merchantId}
          merchantName={merchantName}
          lastModifiedDate={trainerData?.success ? trainerData?.onboardingTrainerData?.trainers?.[0]?.lastModifiedDate : undefined}
          currentPage="details"
          isInternalUser={isInternalUser}
        />
        
        <div>
          {trainerData && !trainerData.success && (
            <div className="mt-6">
              <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
                <p className="font-medium">{trainerData.message}</p>

                {trainerData.availableTrainers && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">Debug Information:</p>
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

          {/* Merchant Details Section */}
          {trainerData && trainerData.success && trainerData.onboardingTrainerData && trainerData.onboardingTrainerData.trainers && trainerData.onboardingTrainerData.trainers[0] && (
            <div className="mt-4">
                <h3 className="text-xl font-semibold text-[#0b0707] mb-4">Merchant Details</h3>
                <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
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
                      return parts.length > 0 ? parts.join(', ') : 'N/A';
                    };

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
                        {/* Column 1 */}
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Merchant: </span>
                            <span className="text-sm text-gray-900">{trainer.name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Account: </span>
                            <span className="text-sm text-gray-900">{trainer.accountName || 'N/A'}</span>
                          </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Industry: </span>
                            <span className="text-sm text-gray-900">{trainer.subIndustry || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Language: </span>
                            <span className="text-sm text-gray-900">{trainer.preferredLanguage || 'N/A'}</span>
                          </div>
                        </div>

                        {/* Column 3 */}
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Store Location: </span>
                            <span className="text-sm text-gray-900">
                              {(() => {
                                const city = trainer.shippingCity || '';
                                const state = trainer.shippingState || '';
                                if (city && state) return `${city}, ${state}`;
                                if (city) return city;
                                if (state) return state;
                                return 'N/A';
                              })()}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Address: </span>
                            <span className="text-sm text-gray-900">{formatAddress()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
            </div>
          )}

          {/* Services and Features Section */}
          {trainerData && trainerData.success && trainerData.onboardingTrainerData && trainerData.onboardingTrainerData.trainers && trainerData.onboardingTrainerData.trainers[0] && (
            <div className="mt-4">
              <h3 className="text-xl font-semibold text-[#0b0707] mb-4">Services & Features</h3>
              <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
                {(() => {
                  const trainer = trainerData.onboardingTrainerData.trainers[0];
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Onboarding Service</div>
                        <div className="text-sm text-gray-900">{trainer.onboardingServicesBought || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Service Type</div>
                        <div className="text-sm text-gray-900">
                          {trainer.serviceType || 'N/A'}
                          {trainer.shippingCity && trainer.shippingState && (
                            <span className="text-gray-600 ml-1">
                              • {trainer.shippingCity}, {trainer.shippingState}
                            </span>
                          )}
                          {!trainer.shippingCity && trainer.shippingState && (
                            <span className="text-gray-600 ml-1">• {trainer.shippingState}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Required Features</div>
                        <div className="text-sm text-gray-900">{trainer.requiredFeaturesByMerchant || 'N/A'}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Contacts Section */}
          {trainerData && trainerData.success && trainerData.onboardingTrainerData && trainerData.onboardingTrainerData.trainers && trainerData.onboardingTrainerData.trainers[0] && (
            <div className="mt-4">
              <h3 className="text-xl font-semibold text-[#0b0707] mb-4">Contacts</h3>
              <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
                {(() => {
                  const trainer = trainerData.onboardingTrainerData.trainers[0];
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
                      {/* Merchant PIC */}
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-500 uppercase">Merchant PIC</div>
                        <div className="text-sm text-gray-900">
                          {trainer.merchantPICName || 'N/A'}
                        </div>
                        {trainer.merchantPICContactNumber && (
                          <div className="text-sm text-gray-600">
                            {trainer.merchantPICContactNumber}
                          </div>
                        )}
                      </div>

                      {/* Business Owner */}
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-500 uppercase">Business Owner</div>
                        <div className="text-sm text-gray-900">
                          {trainer.businessOwnerContact?.name || 'N/A'}
                        </div>
                        {trainer.businessOwnerContact?.phone && (
                          <div className="text-sm text-gray-600">
                            {trainer.businessOwnerContact.phone}
                          </div>
                        )}
                      </div>

                      {/* Operation Manager */}
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-500 uppercase">Operation Manager</div>
                        <div className="text-sm text-gray-900">
                          {trainer.operationManagerContact?.name || 'N/A'}
                        </div>
                        {trainer.operationManagerContact?.phone && (
                          <div className="text-sm text-gray-600">
                            {trainer.operationManagerContact.phone}
                          </div>
                        )}
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
              <div className="mt-4">
                <h3 className="text-xl font-semibold text-[#0b0707] mb-4">Products & Payment</h3>
                <div className="space-y-3">
                  {/* Payment Summary at the top */}
                  {trainer && (
                    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
                      {/* Sales Order Number */}
                      <div className="mb-4 pb-4 border-b border-gray-200">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          Sales Order Number
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {trainerData?.orderNSOrderNumber || 'N/A'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Quote Total Amount */}
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                          <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
                            Quote Total Amount
                          </div>
                          <div className="text-xl font-bold text-orange-900">
                            {trainer.syncedQuoteTotalAmount !== null && trainer.syncedQuoteTotalAmount !== undefined
                              ? formatCurrency(trainer.syncedQuoteTotalAmount, currencyInfo)
                              : 'Not Available'}
                          </div>
                          <div className="text-xs text-orange-600">
                            Synced from quote
                          </div>
                        </div>

                        {/* Pending Payment */}
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                            Pending Payment
                          </div>
                          <div className="text-xl font-bold text-amber-900">
                            {trainer.pendingPayment !== null && trainer.pendingPayment !== undefined
                              ? formatCurrency(trainer.pendingPayment, currencyInfo)
                              : 'Not Available'}
                          </div>
                          <div className="text-xs text-amber-600">
                            Amount outstanding
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {Object.entries(groupedProducts).map(([orderType, items]: [string, any]) => (
                    <div key={orderType} className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
                      {/* Order Type as Subsection Header */}
                      <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {orderType}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">({items.length} items)</span>
                      </h4>
                      
                      {/* Products Table List */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                              <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                              <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase">Unit</th>
                              <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {items.map((item: any, index: number) => (
                              <tr key={item.id || index} className="hover:bg-gray-50">
                                <td className="px-2 py-1 text-xs text-gray-900">{item.productName || 'N/A'}</td>
                                <td className="px-2 py-1 text-xs text-gray-900 text-right">{item.quantity || 1}</td>
                                <td className="px-2 py-1 text-xs text-gray-900 text-right">{formatCurrency(item.unitPrice, currencyInfo)}</td>
                                <td className="px-2 py-1 text-xs font-semibold text-gray-900 text-right">{formatCurrency(item.totalPrice, currencyInfo)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50">
                              <td colSpan={3} className="px-2 py-1 text-xs font-medium text-gray-900 text-right">Total:</td>
                              <td className="px-2 py-1 text-xs font-bold text-gray-900 text-right">
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

        {/* Booking Modal */}
        {bookingModalOpen && currentBookingInfo && (
          <DatePickerModal
            isOpen={bookingModalOpen}
            onClose={() => setBookingModalOpen(false)}
            merchantId={currentBookingInfo.trainerId || currentBookingInfo.id}
            merchantName={currentBookingInfo.merchantName || currentBookingInfo.name}
            merchantAddress={currentBookingInfo.merchantAddress}
            merchantState={currentBookingInfo.merchantState}
            merchantPhone={currentBookingInfo.merchantPhone || currentBookingInfo.phoneNumber}
            merchantContactPerson={currentBookingInfo.merchantContactPerson}
            trainerName={currentBookingInfo.trainerName}
            bookingType={currentBookingInfo.bookingType}
            onboardingServicesBought={currentBookingInfo.onboardingServicesBought}
            requiredFeatures={currentBookingInfo.requiredFeatures}
            onboardingSummary={currentBookingInfo.onboardingSummary}
            workaroundElaboration={currentBookingInfo.workaroundElaboration}
            currentBooking={currentBookingInfo.existingBooking}
            onBookingComplete={handleBookingComplete}
          />
        )}

        {/* WhatsApp Floating Button */}
        <WhatsAppButton />
      </div>
    </div>
  )
}