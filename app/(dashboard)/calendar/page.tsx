'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CalendarDashboard() {
  const [bookings, setBookings] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const [bookingsRes, batchesRes] = await Promise.all([
          fetch('/api/calendar/bookings'),
          fetch('/api/calendar/batches')
        ]);

        if (bookingsRes.ok) setBookings(await bookingsRes.json());
        if (batchesRes.ok) setBatches(await batchesRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading Calendar...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-8">Calendar & Scheduling</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Bookings Section */}
        <section className="bg-[#1A1C23] p-6 rounded-xl border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Scheduled Calls</h2>
            <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              New Booking
            </button>
          </div>
          
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <p className="text-gray-500 text-sm">No scheduled calls found.</p>
            ) : (
              bookings.map((booking: any) => (
                <div 
                  key={booking.id} 
                  className="bg-[#242730] p-4 rounded-lg flex justify-between items-center cursor-pointer hover:bg-gray-700 transition"
                  onClick={() => router.push(`/calendar/${booking.id}`)}
                >
                  <div>
                    <p className="font-medium">{booking.phoneNumber}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(booking.scheduledAtUtc).toLocaleString()} • {booking.timezone}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      booking.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' : 
                      booking.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                      booking.status === 'failed' ? 'bg-red-500/20 text-red-400' : 
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {booking.status}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{booking.source}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Batches Section */}
        <section className="bg-[#1A1C23] p-6 rounded-xl border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Batch Campaigns</h2>
            <button className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              New Batch
            </button>
          </div>
          
          <div className="space-y-4">
            {batches.length === 0 ? (
              <p className="text-gray-500 text-sm">No active batch campaigns.</p>
            ) : (
              batches.map((batch: any) => (
                <div key={batch.id} className="bg-[#242730] p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">{batch.name}</h3>
                      <p className="text-xs text-gray-400">
                        Starts: {new Date(batch.startAtUtc).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      batch.status === 'running' ? 'bg-green-500/20 text-green-400' : 
                      batch.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' : 
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {batch.status}
                    </span>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Progress</span>
                      <span>{batch.completedCount + batch.failedCount} / {batch.totalContacts}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full" 
                        style={{ width: `${(batch.completedCount / Math.max(batch.totalContacts, 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
