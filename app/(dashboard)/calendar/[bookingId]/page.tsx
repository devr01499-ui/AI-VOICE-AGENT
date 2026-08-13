'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newTime, setNewTime] = useState('');

  useEffect(() => {
    async function fetchBooking() {
      try {
        const res = await fetch(`/api/calendar/bookings/${params.bookingId}`);
        if (res.ok) {
          const data = await res.json();
          setBooking(data);
          
          // Format for datetime-local input
          const d = new Date(data.scheduledAtUtc);
          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
          setNewTime(d.toISOString().slice(0, 16));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchBooking();
  }, [params.bookingId]);

  const handleAction = async (action: 'cancel' | 'reschedule') => {
    try {
      const res = await fetch(`/api/calendar/bookings/${params.bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          scheduledAtUtc: action === 'reschedule' ? new Date(newTime).toISOString() : undefined,
          timezone: booking.timezone,
        })
      });

      if (res.ok) {
        alert(`Booking ${action}d successfully`);
        router.refresh();
        router.push('/calendar');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!booking) return <div className="p-8 text-white">Booking not found.</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto text-white">
      <button 
        onClick={() => router.push('/calendar')}
        className="text-gray-400 hover:text-white mb-6 text-sm flex items-center gap-2"
      >
        ← Back to Calendar
      </button>

      <div className="bg-[#1A1C23] p-8 rounded-xl border border-gray-800">
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-2xl font-bold">Booking Details</h1>
          <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
            {booking.status}
          </span>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
            <p className="text-lg font-medium">{booking.phoneNumber}</p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Source</label>
            <p className="text-sm bg-blue-900/30 text-blue-300 px-2 py-1 rounded inline-block">
              {booking.source === 'ai_booked' ? 'AI Extracted' : booking.source}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Current Schedule (UTC)</label>
              <p className="text-sm">{new Date(booking.scheduledAtUtc).toLocaleString()}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Timezone</label>
              <p className="text-sm">{booking.timezone}</p>
            </div>
          </div>

          {booking.status === 'scheduled' && (
            <div className="pt-6 border-t border-gray-800">
              <h3 className="text-lg font-medium mb-4">Manage Booking</h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">New Time</label>
                    <input 
                      type="datetime-local" 
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full bg-[#242730] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button 
                    onClick={() => handleAction('reschedule')}
                    className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg font-medium transition-colors h-[42px]"
                  >
                    Reschedule
                  </button>
                </div>

                <div className="pt-4 mt-2 border-t border-gray-800 border-dashed">
                  <button 
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this booking?')) {
                        handleAction('cancel');
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                  >
                    Cancel Booking
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
