'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, CheckCircle } from 'lucide-react'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  merchantId: string
  merchantName: string
  merchantAddress?: string
  merchantPhone?: string
  merchantContactPerson?: string
  trainerName: string
  currentBooking?: {
    eventId: string
    date: string
    time: string
  }
  onBookingComplete: () => void
}

interface TimeSlot {
  start: string
  end: string
  available: boolean
}

interface DayAvailability {
  date: string
  slots: TimeSlot[]
}

export default function BookingModal({
  isOpen,
  onClose,
  merchantId,
  merchantName,
  merchantAddress,
  merchantPhone,
  merchantContactPerson,
  trainerName,
  currentBooking,
  onBookingComplete
}: BookingModalProps) {
  const [availability, setAvailability] = useState<DayAvailability[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [assignedTrainer, setAssignedTrainer] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      fetchAvailability()
    }
  }, [isOpen, trainerName])

  const fetchAvailability = async () => {
    setLoading(true)
    setMessage('') // Clear any previous messages
    try {
      console.log('Fetching availability for trainer:', trainerName)
      const response = await fetch(`/api/lark/availability?trainerName=${encodeURIComponent(trainerName)}`)
      const data = await response.json()
      
      console.log('Availability response:', response.status, data)
      
      if (response.ok) {
        setAvailability(data.availability || [])
        if (!data.availability || data.availability.length === 0) {
          setMessage('No availability data returned')
        }
      } else {
        setMessage(data.error || 'Failed to fetch availability')
        console.error('Error response:', data)
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
      setMessage(`Failed to fetch availability: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleBooking = async () => {
    if (!selectedDate || !selectedSlot) return

    setBookingStatus('loading')
    try {
      const response = await fetch('/api/lark/book-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          merchantName,
          merchantAddress,
          merchantPhone,
          merchantContactPerson,
          trainerName,
          date: selectedDate,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setBookingStatus('success')
        setAssignedTrainer(data.assignedTrainer || '')
        
        let successMsg = data.assignedTrainer 
          ? `Training session booked successfully!\nAssigned to: ${data.assignedTrainer}`
          : 'Training session booked successfully!'
        
        if (!data.salesforceUpdated) {
          successMsg += '\n⚠️ Note: Salesforce update pending'
        }
        
        setMessage(successMsg)
        
        // Call onBookingComplete immediately to refresh data
        onBookingComplete()
        
        // Keep modal open for 3 seconds to show success message
        setTimeout(() => {
          onClose()
        }, 3000)
      } else {
        setBookingStatus('error')
        const errorMsg = data.error || 'Failed to book training'
        const details = data.details ? ` - ${data.details}` : ''
        const hint = data.hint ? `\n${data.hint}` : ''
        setMessage(errorMsg + details + hint)
        console.error('Booking failed:', data)
      }
    } catch (error) {
      console.error('Error booking training:', error)
      setBookingStatus('error')
      setMessage('Failed to book training')
    }
  }

  const handleCancellation = async () => {
    if (!currentBooking) return

    setBookingStatus('loading')
    try {
      const response = await fetch('/api/lark/cancel-training', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          merchantName,
          trainerName,
          eventId: currentBooking.eventId
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setBookingStatus('success')
        setMessage('Training session cancelled successfully')
        setTimeout(() => {
          onBookingComplete()
          onClose()
        }, 2000)
      } else {
        setBookingStatus('error')
        setMessage(data.error || 'Failed to cancel training')
      }
    } catch (error) {
      console.error('Error cancelling training:', error)
      setBookingStatus('error')
      setMessage('Failed to cancel training')
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    }
    return date.toLocaleDateString('en-US', options)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            Book Training Session
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : currentBooking ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Current Booking</h3>
                <p className="text-gray-700 mb-2">
                  Date: <span className="font-medium">{currentBooking.date}</span>
                </p>
                <p className="text-gray-700 mb-4">
                  Time: <span className="font-medium">{currentBooking.time}</span>
                </p>
                <button
                  onClick={handleCancellation}
                  disabled={bookingStatus === 'loading'}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400"
                >
                  {bookingStatus === 'loading' ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Select Date</h3>
                <div className="grid grid-cols-7 gap-2">
                  {availability.slice(0, 28).map((day) => {
                    const hasAvailableSlots = day.slots.some(slot => slot.available)
                    return (
                      <button
                        key={day.date}
                        onClick={() => setSelectedDate(day.date)}
                        disabled={!hasAvailableSlots}
                        className={`
                          p-3 rounded-lg text-center transition-colors
                          ${selectedDate === day.date
                            ? 'bg-blue-600 text-white'
                            : hasAvailableSlots
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          }
                        `}
                      >
                        <div className="text-xs">{formatDate(day.date).split(',')[0]}</div>
                        <div className="font-semibold">{new Date(day.date + 'T00:00:00').getDate()}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedDate && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select Time Slot</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availability
                      .find(day => day.date === selectedDate)
                      ?.slots.map((slot: any) => (
                        <button
                          key={`${slot.start}-${slot.end}`}
                          onClick={() => setSelectedSlot(slot)}
                          disabled={!slot.available}
                          className={`
                            p-3 rounded-lg flex flex-col items-start gap-1 transition-colors
                            ${selectedSlot === slot
                              ? 'bg-blue-600 text-white'
                              : slot.available
                              ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                              : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {formatTime(slot.start)} - {formatTime(slot.end)}
                            </span>
                          </div>
                          {slot.availableTrainers && slot.availableTrainers.length > 0 && (
                            <span className="text-xs opacity-75">
                              {slot.availableTrainers.length === 1 
                                ? `${slot.availableTrainers[0]} available`
                                : `${slot.availableTrainers.length} trainers available`}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {selectedDate && selectedSlot && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Booking Summary</h4>
                  <p className="text-sm text-gray-600">
                    Date: <span className="font-medium text-gray-900">{formatDate(selectedDate)}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Time: <span className="font-medium text-gray-900">
                      {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Trainer: <span className="font-medium text-gray-900">{trainerName}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {message && (
            <div className={`
              mt-4 p-4 rounded-lg
              ${bookingStatus === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : ''}
              ${bookingStatus === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : ''}
            `}>
              <div className="flex items-start gap-2">
                {bookingStatus === 'success' && <CheckCircle className="h-5 w-5 mt-0.5" />}
                <div className="flex-1">
                  <div className="whitespace-pre-line">{message}</div>
                  {assignedTrainer && bookingStatus === 'success' && (
                    <div className="mt-2 text-sm font-semibold">
                      🎯 Trainer: {assignedTrainer}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          {!currentBooking && (
            <button
              onClick={handleBooking}
              disabled={!selectedDate || !selectedSlot || bookingStatus === 'loading'}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {bookingStatus === 'loading' ? 'Booking...' : 'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}