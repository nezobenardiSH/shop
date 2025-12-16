'use client'

import { useState } from 'react'
import { X, AlertTriangle, Calendar, User, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface CancelBookingDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  bookingType: 'training' | 'installation'
  merchantName: string
  scheduledDate: string
  scheduledTime?: string
  assigneeName: string
  location?: string
  isExternal?: boolean
  isLoading?: boolean
}

export default function CancelBookingDialog({
  isOpen,
  onClose,
  onConfirm,
  bookingType,
  merchantName,
  scheduledDate,
  scheduledTime,
  assigneeName,
  location,
  isExternal = false,
  isLoading = false,
}: CancelBookingDialogProps) {
  const t = useTranslations('cancelDialog')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError(t('reasonRequired'))
      return
    }
    setError('')
    try {
      await onConfirm(reason.trim())
      setReason('')
    } catch (err) {
      // Error handling is done in parent
    }
  }

  const handleClose = () => {
    if (isLoading) return // Prevent closing while loading
    setReason('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  const bookingTypeLabel = bookingType === 'training'
    ? t('trainingLabel')
    : t('installationLabel')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-95 rounded-2xl flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
              <div className="text-lg font-semibold text-gray-700">{t('cancelling')}</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('title')} - {bookingTypeLabel}
            </h2>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-gray-600 mt-2">{t('confirmTitle')}</p>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-4">
          {/* Booking Details */}
          <div className="space-y-3 py-4 border-y border-gray-200">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900">{merchantName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>{scheduledDate}{scheduledTime && ` at ${scheduledTime}`}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>{assigneeName}</span>
            </div>
            {location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{location}</span>
              </div>
            )}
          </div>

          {/* External Vendor Warning */}
          {isExternal && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{t('externalWarning')}</span>
              </div>
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-2">
            <label htmlFor="cancel-reason" className="block text-sm font-medium text-gray-700">
              {t('reasonLabel')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="cancel-reason"
              placeholder={t('reasonPlaceholder')}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError('')
              }}
              rows={3}
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('keepButton')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('cancelButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
