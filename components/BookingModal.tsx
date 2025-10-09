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
  bookingType?: string
  currentBooking?: {
    eventId: string
    date: string
    time: string
  }
  onBookingComplete: (selectedDate?: string) => void
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
  bookingType = 'training',
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
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English'])

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
          endTime: selectedSlot.end,
          bookingType: bookingType,
          languages: (bookingType === 'pos-training' || bookingType === 'backoffice-training') ? selectedLanguages : undefined
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
        
        // Call onBookingComplete with the selected date to update Salesforce
        onBookingComplete(selectedDate)
        
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
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-[#e5e7eb] flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-[#0b0707] flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[#ff630f]" />
            {(() => {
              switch(bookingType) {
                case 'hardware-fulfillment':
                  return 'Schedule Hardware Fulfillment Date'
                case 'installation':
                  return 'Schedule Installation Date'
                case 'training':
                  return 'Book Training Session'
                case 'go-live':
                  return 'Schedule Go-Live Date'
                default:
                  return 'Schedule Date'
              }
            })()}
          </h2>
          <button
            onClick={onClose}
            className="text-[#6b6a6a] hover:text-[#0b0707] transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff630f]"></div>
            </div>
          ) : currentBooking ? (
            <div className="space-y-6">
              <div className="bg-[#fff4ed] border border-[#ff630f] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-[#0b0707] mb-4">Current Booking</h3>
                <p className="text-[#6b6a6a] mb-2">
                  Date: <span className="font-medium">{currentBooking.date}</span>
                </p>
                <p className="text-[#6b6a6a] mb-4">
                  Time: <span className="font-medium">{currentBooking.time}</span>
                </p>
                <button
                  onClick={handleCancellation}
                  disabled={bookingStatus === 'loading'}
                  className="bg-red-500 hover:bg-red-600 text-white font-medium rounded-full px-6 py-2.5 transition-all duration-200 transform hover:scale-105 disabled:bg-gray-400"
                >
                  {bookingStatus === 'loading' ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-[#0b0707] mb-4">Select Date</h3>
                <div className="grid grid-cols-7 gap-2">
                  {availability.slice(0, 28).map((day) => {
                    const hasAvailableSlots = day.slots.some(slot => slot.available)
                    return (
                      <button
                        key={day.date}
                        onClick={() => setSelectedDate(day.date)}
                        disabled={!hasAvailableSlots}
                        className={`
                          p-3 rounded-xl text-center transition-colors
                          ${selectedDate === day.date
                            ? 'bg-[#ff630f] text-white'
                            : hasAvailableSlots
                            ? 'bg-gray-100 hover:bg-[#fff4ed] text-[#0b0707]'
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
                  <h3 className="text-lg font-semibold text-[#0b0707] mb-4">Select Time Slot</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availability
                      .find(day => day.date === selectedDate)
                      ?.slots.map((slot: any) => (
                        <button
                          key={`${slot.start}-${slot.end}`}
                          onClick={() => setSelectedSlot(slot)}
                          disabled={!slot.available}
                          className={`
                            p-3 rounded-xl flex flex-col items-start gap-1 transition-colors
                            ${selectedSlot === slot
                              ? 'bg-[#ff630f] text-white'
                              : slot.available
                              ? 'bg-gray-100 hover:bg-[#fff4ed] text-[#0b0707]'
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
                <>
                  {/* Language Selection for Training */}
                  {(bookingType === 'pos-training' || bookingType === 'backoffice-training') && (
                    <div className="bg-[#fff4ed] rounded-xl p-4 border border-[#ff630f]/20">
                      <h4 className="font-semibold text-[#0b0707] mb-3">Select Training Language(s)</h4>
                      <div className="space-y-2">
                        {['English', 'Bahasa Malaysia', 'Chinese'].map((language) => (
                          <label
                            key={language}
                            className="flex items-center gap-3 cursor-pointer hover:bg-white/50 p-2 rounded-lg transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedLanguages.includes(language)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLanguages([...selectedLanguages, language])
                                } else {
                                  setSelectedLanguages(selectedLanguages.filter(l => l !== language))
                                }
                              }}
                              className="w-4 h-4 text-[#ff630f] border-gray-300 rounded focus:ring-[#ff630f]"
                            />
                            <span className="text-sm font-medium text-[#0b0707]">{language}</span>
                          </label>
                        ))}
                      </div>
                      {selectedLanguages.length === 0 && (
                        <p className="text-xs text-red-600 mt-2">Please select at least one language</p>
                      )}
                    </div>
                  )}

                  <div className="bg-[#faf9f6] rounded-xl p-4">
                    <h4 className="font-semibold text-[#0b0707] mb-2">Booking Summary</h4>
                    <p className="text-sm text-[#6b6a6a]">
                      Date: <span className="font-medium text-[#0b0707]">{formatDate(selectedDate)}</span>
                    </p>
                    <p className="text-sm text-[#6b6a6a]">
                      Time: <span className="font-medium text-[#0b0707]">
                        {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                      </span>
                    </p>
                    <p className="text-sm text-[#6b6a6a]">
                      Trainer: <span className="font-medium text-[#0b0707]">{trainerName}</span>
                    </p>
                    {(bookingType === 'pos-training' || bookingType === 'backoffice-training') && selectedLanguages.length > 0 && (
                      <p className="text-sm text-[#6b6a6a] mt-1">
                        Language(s): <span className="font-medium text-[#0b0707]">{selectedLanguages.join(', ')}</span>
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {message && (
            <div className={`
              mt-4 p-4 rounded-2xl
              ${bookingStatus === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : ''}
              ${bookingStatus === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : ''}
            `}>
              <div className="flex items-start gap-2">
                {bookingStatus === 'success' && <CheckCircle className="h-5 w-5 mt-0.5" />}
                <div className="flex-1">
                  <div className="whitespace-pre-line">{message}</div>
                  {assignedTrainer && bookingStatus === 'success' && (
                    <div className="mt-2 text-sm font-semibold">
                      Trainer: {assignedTrainer}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#e5e7eb] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-white hover:bg-gray-50 text-[#0b0707] font-medium rounded-full px-6 py-2.5 border border-[#e5e7eb] transition-all duration-200"
          >
            Cancel
          </button>
          {!currentBooking && (
            <button
              onClick={handleBooking}
              disabled={
                !selectedDate || 
                !selectedSlot || 
                bookingStatus === 'loading' ||
                ((bookingType === 'pos-training' || bookingType === 'backoffice-training') && selectedLanguages.length === 0)
              }
              className="bg-[#ff630f] hover:bg-[#fe5b25] text-white font-medium rounded-full px-6 py-2.5 transition-all duration-200 transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {bookingStatus === 'loading' ? 'Booking...' : 'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}