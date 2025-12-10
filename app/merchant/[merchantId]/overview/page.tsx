'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations, useFormatter } from 'next-intl'
import { usePageTracking } from '@/lib/useAnalytics'
import { getStoreSetupVideoDueDate, getProductListDueDate } from '@/lib/date-utils'
import { useMerchantContext } from '../layout'

// Action item interface
interface ActionItem {
  id: string
  label: string
  completed: boolean
  stageLink: string
  dueDate?: string | null
  disabled?: boolean
  disabledReason?: string
}

// Important date interface
interface ImportantDate {
  label: string
  date: string | null
  icon: React.ReactNode
  completed: boolean
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

export default function OverviewPage() {
  const params = useParams()
  const merchantId = params.merchantId as string
  const { merchantData: trainerData, loading } = useMerchantContext()
  const t = useTranslations('overview')
  const tCommon = useTranslations('common')
  const format = useFormatter()

  // Locale-aware date formatting
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      return format.dateTime(date, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return null
    }
  }

  // Get merchant name from context
  const merchantName = trainerData?.success && trainerData?.name ? trainerData.name : 'Loading...'
  const trainer = trainerData?.onboardingTrainerData?.trainers?.[0]

  // Track page view
  usePageTracking(
    merchantId,
    merchantName !== 'Loading...' ? merchantName : undefined,
    'overview'
  )

  // Determine action items completion status
  const getActionItems = (): ActionItem[] => {
    if (!trainer) return []

    // Determine if menu/product terminology based on sub-industry
    const subIndustry = trainer.subIndustry || ''
    const isFnB = subIndustry.toLowerCase().includes('f&b') ||
                  subIndustry.toLowerCase().includes('food') ||
                  subIndustry.toLowerCase().includes('restaurant') ||
                  subIndustry.toLowerCase().includes('cafe') ||
                  subIndustry.toLowerCase().includes('coffee')

    const productLabel = isFnB ? t('actions.submitMenu') : t('actions.submitProductList')

    // Product/Menu submitted - completed when submission timestamp is filled
    const productSubmitted = !!trainer.menuCollectionSubmissionTimestamp

    // Store Setup Video completed
    const storeSetupCompleted = !!trainer.videoProofLink && trainer.videoProofLink !== 'NA'

    // Installation date set
    const installationDateSet = !!trainer.installationDate

    // Training date set
    const trainingDateSet = !!trainer.trainingDate ||
                            !!trainer.posTrainingDate ||
                            !!trainer.backOfficeTrainingDate

    // BackOffice activated
    const backOfficeActivated = !!trainer.subscriptionActivationDate

    // Get training date (prefer POS, then BackOffice, then generic)
    const trainingDateValue = trainer.posTrainingDate ||
                              trainer.backOfficeTrainingDate ||
                              trainer.trainingDate

    // Calculate due dates
    const storeSetupDueDate = trainer.installationDate
      ? getStoreSetupVideoDueDate(trainer.installationDate)
      : null
    const productListDueDate = trainingDateValue
      ? getProductListDueDate(trainingDateValue)
      : null

    // Determine disabled states for scheduling
    // Merchants need: store setup completed AND hardware fulfillment date set
    const hardwareFulfillmentDateSet = !!trainer.hardwareFulfillmentDate
    const canScheduleInstallation = storeSetupCompleted && hardwareFulfillmentDateSet
    const canScheduleTraining = productSubmitted && installationDateSet

    return [
      {
        id: 'product-setup',
        label: productLabel,
        completed: productSubmitted,
        stageLink: `/merchant/${merchantId}?stage=preparation&section=product-setup`,
        dueDate: productListDueDate
      },
      {
        id: 'store-setup',
        label: t('actions.submitStoreSetupVideo'),
        completed: storeSetupCompleted,
        stageLink: `/merchant/${merchantId}?stage=preparation&section=store-setup`,
        dueDate: storeSetupDueDate
      },
      {
        id: 'installation-date',
        label: t('actions.setInstallationDate'),
        completed: installationDateSet,
        stageLink: `/merchant/${merchantId}?stage=installation&section=installation`,
        disabled: !canScheduleInstallation && !installationDateSet,
        disabledReason: t('disabledReasons.submitStoreSetupAndWaitForHardware')
      },
      {
        id: 'training-date',
        label: t('actions.setTrainingDate'),
        completed: trainingDateSet,
        stageLink: `/merchant/${merchantId}?stage=training&section=training`,
        disabled: !canScheduleTraining && !trainingDateSet,
        disabledReason: !productSubmitted ? t('disabledReasons.submitProductListFirst') : t('disabledReasons.setInstallationFirst')
      },
      {
        id: 'backoffice-activation',
        label: t('actions.activateBackOffice'),
        completed: backOfficeActivated,
        stageLink: `/merchant/${merchantId}?stage=ready-go-live`
      }
    ]
  }

  // Get important dates
  const getImportantDates = (): ImportantDate[] => {
    if (!trainer) return []

    // Truck/delivery icon
    const truckIcon = (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    )

    // Wrench/installation icon
    const wrenchIcon = (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )

    // Training/academic icon
    const trainingIcon = (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )

    // Get training date (prefer POS, then BackOffice, then generic)
    const trainingDate = trainer.posTrainingDate ||
                         trainer.backOfficeTrainingDate ||
                         trainer.trainingDate

    // Helper to check if date is in the past
    const isPastDate = (dateStr: string | null | undefined): boolean => {
      if (!dateStr) return false
      const date = new Date(dateStr)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return date < today
    }

    // Determine completion status for each milestone
    const hardwareDelivered = !!trainer.trackingLink
    const installationCompleted = !!trainer.actualInstallationDate
    const trainingCompleted = isPastDate(trainingDate)

    return [
      {
        label: t('dates.hardwareDelivery'),
        date: formatDate(trainer.hardwareFulfillmentDate),
        icon: truckIcon,
        completed: hardwareDelivered
      },
      {
        label: t('dates.installation'),
        date: formatDate(trainer.installationDate),
        icon: wrenchIcon,
        completed: installationCompleted
      },
      {
        label: t('dates.training'),
        date: formatDate(trainingDate),
        icon: trainingIcon,
        completed: trainingCompleted
      }
    ]
  }

  const actionItems = getActionItems()
  const importantDates = getImportantDates()
  const completedCount = actionItems.filter(item => item.completed).length

  return (
    <>
      {/* Error state */}
      {trainerData && !trainerData.success && (
        <div className="mt-6">
          <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
            <p className="font-medium">{trainerData.message}</p>
          </div>
        </div>
      )}

      {/* Onboarding Stage Banner */}
      {trainerData?.success && trainer && (
        <Link
          href={`/merchant/${merchantId}?stage=${getCurrentStage(trainerData)}`}
          className="mb-4 sm:mb-6 bg-white border border-[#e5e7eb] rounded-lg px-3 py-1.5 sm:px-4 sm:py-4 flex items-center justify-between hover:border-[#ff630f] hover:bg-orange-50 transition-all duration-200 cursor-pointer block"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-[#ff630f] text-white flex items-center justify-center">
              <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="leading-tight">
              <span className="text-xs sm:text-sm text-[#6b6a6a]">{t('onboardingProgress')}</span>
              <div className="text-sm sm:text-lg font-semibold text-[#0b0707] -mt-0.5 sm:mt-0">
                {(() => {
                  const stage = getCurrentStage(trainerData)
                  const stageKeys: { [key: string]: string } = {
                    'welcome': 'welcome',
                    'preparation': 'preparation',
                    'installation': 'installation',
                    'training': 'training',
                    'ready-go-live': 'readyGoLive',
                    'live': 'live'
                  }
                  return t(`stages.${stageKeys[stage] || 'welcome'}`)
                })()}
              </div>
            </div>
          </div>
          <svg className="w-5 h-5 text-[#ff630f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* Main content */}
      {trainerData?.success && trainer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Action Items Column */}
          <div className="bg-white rounded-xl border border-[#e5e7eb] p-3 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-[#0b0707] flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold">!</span>
                {t('requiredActions')}
              </h2>
              <span className="text-sm text-[#6b6a6a]">
                {t('completedCount', { completed: completedCount, total: actionItems.length })}
              </span>
            </div>

            <div className="space-y-3">
              {actionItems.map((item) => {
                const isDisabled = item.disabled && !item.completed

                if (isDisabled) {
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[#e5e7eb] bg-gray-50 opacity-60 cursor-not-allowed"
                      title={item.disabledReason}
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center border-gray-300">
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm block text-gray-400">
                          {item.label}
                        </span>
                        {item.disabledReason && (
                          <span className="text-xs text-gray-400">
                            {item.disabledReason}
                          </span>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.id}
                    href={item.stageLink}
                    className="flex items-center gap-3 p-3 rounded-lg border border-[#e5e7eb] hover:border-[#ff630f] hover:bg-orange-50 transition-all duration-200 group"
                  >
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      item.completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 group-hover:border-[#ff630f]'
                    }`}>
                      {item.completed && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm block ${
                        item.completed
                          ? 'text-gray-500 line-through'
                          : 'text-[#0b0707] group-hover:text-[#ff630f]'
                      }`}>
                        {item.label}
                      </span>
                      {item.dueDate && !item.completed && (
                        <span className="text-xs text-orange-600 font-medium">
                          {t('dueBy', { date: item.dueDate })}
                        </span>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-[#ff630f] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Important Dates Column */}
          <div className="bg-white rounded-xl border border-[#e5e7eb] p-3 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-[#0b0707] mb-3 sm:mb-4">{t('importantDates')}</h2>

            <div className="space-y-3 sm:space-y-4">
              {importantDates.map((dateItem, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2 sm:p-3 rounded-lg bg-gray-50"
                >
                  <div className={`flex-shrink-0 w-6 h-6 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                    dateItem.completed ? 'bg-green-500 text-white' :
                    dateItem.date ? 'bg-[#ff630f] text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {dateItem.completed ? (
                      <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="[&>svg]:w-3.5 [&>svg]:h-3.5 sm:[&>svg]:w-5 sm:[&>svg]:h-5">
                        {dateItem.icon}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-[#6b6a6a] uppercase tracking-wider">
                      {dateItem.label}
                    </div>
                    <div className={`text-base font-medium ${
                      dateItem.date ? 'text-[#0b0707]' : 'text-gray-400'
                    }`}>
                      {dateItem.date || tCommon('notSet')}
                    </div>
                  </div>
                  {dateItem.completed && (
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {t('completed')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !trainerData && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff630f]"></div>
        </div>
      )}
    </>
  )
}
