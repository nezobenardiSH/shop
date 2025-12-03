'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import MerchantHeader from '@/components/MerchantHeader'
import PageHeader from '@/components/PageHeader'
import WhatsAppButton from '@/components/WhatsAppButton'

// Context to share merchant data across pages
interface MerchantContextType {
  merchantData: any
  loading: boolean
  refreshData: () => Promise<void>
  isInternalUser: boolean
}

const MerchantContext = createContext<MerchantContextType | null>(null)

export function useMerchantContext() {
  const context = useContext(MerchantContext)
  if (!context) {
    throw new Error('useMerchantContext must be used within MerchantLayout')
  }
  return context
}

// Helper function to determine current stage based on onboarding data
const getCurrentStage = (trainerData: any): string => {
  if (!trainerData?.success) return 'welcome'

  const trainer = trainerData.onboardingTrainerData?.trainers?.[0]
  if (!trainer) return 'welcome'

  // Check completion status for each stage
  const welcomeCompleted = trainer.welcomeCallStatus === 'Welcome Call Completed' ||
                           trainer.welcomeCallStatus === 'Completed'
  const hasMenuSubmission = !!trainer.menuCollectionSubmissionTimestamp
  const hasCompletedProductSetup = trainer.completedProductSetup === 'Yes' || trainer.completedProductSetup === 'Yes - Self-serve'
  const hasVideoProof = !!trainer.videoProofLink && trainer.videoProofLink !== 'NA'
  const hasHardwareDelivery = !!trainer.trackingLink
  const hasActualInstallation = !!trainer.actualInstallationDate
  const hasPOSTraining = !!trainer.posTrainingDate
  const hasBOTraining = !!trainer.backOfficeTrainingDate
  const posQrCount = trainer.posQrDeliveryTnxCount || 0
  const isLive = posQrCount > 30

  // Determine current stage (first incomplete stage)
  if (isLive) return 'live'
  if (hasPOSTraining || hasBOTraining) return 'ready-go-live'
  if (hasActualInstallation) return 'training'

  // Check preparation completion
  const preparationComplete = hasMenuSubmission && hasCompletedProductSetup && hasVideoProof && hasHardwareDelivery
  if (preparationComplete) return 'installation'

  if (welcomeCompleted) return 'preparation'

  return 'welcome'
}

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const merchantId = params.merchantId as string

  // Determine current page from pathname
  const getCurrentPage = (): 'overview' | 'progress' | 'details' => {
    if (pathname?.endsWith('/overview')) return 'overview'
    if (pathname?.endsWith('/details')) return 'details'
    // Progress page is at /merchant/[id] (with ?stage= params)
    return 'progress'
  }

  const [merchantData, setMerchantData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
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

  const loadMerchantData = async () => {
    setLoading(true)
    try {
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/salesforce/merchant/${merchantId}?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await response.json()
      setMerchantData(data)

      // Update page title with merchant name
      if (data.success && data.name) {
        document.title = `${data.name} - Onboarding Portal`
      }
    } catch (error) {
      setMerchantData({ success: false, message: `Error: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (merchantId) {
      checkUserType()
      loadMerchantData()
    }
  }, [merchantId])

  // Get data for header
  const merchantName = merchantData?.success && merchantData?.name ? merchantData.name : 'Loading...'
  const trainer = merchantData?.onboardingTrainerData?.trainers?.[0]
  const lastModifiedDate = merchantData?.success ? trainer?.lastModifiedDate : undefined
  const plannedGoLiveDate = merchantData?.success ? trainer?.plannedGoLiveDate : undefined
  const posQrDeliveryTnxCount = merchantData?.success ? trainer?.posQrDeliveryTnxCount : undefined
  const currentOnboardingStage = getCurrentStage(merchantData)

  return (
    <MerchantContext.Provider value={{
      merchantData,
      loading,
      refreshData: loadMerchantData,
      isInternalUser
    }}>
      <div className="min-h-screen bg-[#faf9f6] py-4">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-4">
            <MerchantHeader
              onRefresh={loadMerchantData}
              loading={loading}
              merchantId={merchantId}
            />
          </div>

          <PageHeader
            merchantId={merchantId}
            merchantName={merchantName}
            lastModifiedDate={lastModifiedDate}
            currentPage={getCurrentPage()}
            isInternalUser={isInternalUser}
            currentOnboardingStage={currentOnboardingStage}
            plannedGoLiveDate={plannedGoLiveDate}
            posQrDeliveryTnxCount={posQrDeliveryTnxCount}
          />

          {children}

          <WhatsAppButton />
        </div>
      </div>
    </MerchantContext.Provider>
  )
}
