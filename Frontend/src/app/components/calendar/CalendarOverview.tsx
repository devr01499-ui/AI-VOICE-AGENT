import { useState, useEffect } from 'react';
import { fetchCalendarBookings, fetchCalendarBatches } from '../../api';
import { Calendar, Clock, MapPin, User, Bot, AlertCircle } from 'lucide-react';

interface Booking {
  id: string;
  source: string;
  phoneNumber: string;
  scheduledAtUtc: string;
  timezone: string;
  status: string;
  notes?: string;
}

interface Batch {
  id: string;
  name: string;
  status: string;
  completedCount: number;
  totalContacts: number;
}

export function DashCalendar() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCalendarBookings(), fetchCalendarBatches()])
      .then(([bData, batData]) => {
        setBookings(bData || []);
        setBatches(batData || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Calculate stats
  const aiBooked = bookings.filter(b => b.source === 'ai_booked').length;
  const userBooked = bookings.filter(b => b.source === 'manual').length;
  
  // Custom Tailwind Calendar Grid Generation (simplistic week/list hybrid for aesthetics)
  // We'll show the upcoming list with beautiful glass cards
  const upcomingBookings = bookings.filter(b => b.status === 'scheduled');

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full h-full pb-10">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--nm-text)]" style={{fontFamily:"'Figtree',sans-serif"}}>Calendar & Scheduling</h2>
          <p className="text-sm text-gray-500 mt-1" style={{fontFamily:"'Figtree',sans-serif"}}>Monitor automated outreach and AI-booked follow-ups.</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="nm-raised rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">AI Scheduled</p>
              <h3 className="text-2xl font-bold text-[var(--nm-text)]">{aiBooked}</h3>
            </div>
          </div>
        </div>
        
        <div className="nm-raised rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">User Scheduled</p>
              <h3 className="text-2xl font-bold text-[var(--nm-text)]">{userBooked}</h3>
            </div>
          </div>
        </div>

        <div className="nm-raised rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Active Batches</p>
              <h3 className="text-2xl font-bold text-[var(--nm-text)]">{batches.filter(b => b.status === 'running').length}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        
        {/* Main Schedule List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-[var(--nm-text)] mb-4 flex items-center gap-2" style={{fontFamily:"'Figtree',sans-serif"}}>
            <Clock className="w-5 h-5 text-indigo-400" /> Upcoming Calls
          </h3>
          
          {upcomingBookings.length === 0 ? (
            <div className="nm-pressed rounded-2xl p-10 text-center text-gray-500 flex flex-col items-center justify-center">
              <Calendar className="w-10 h-10 mb-4 opacity-20" />
              <p>No upcoming calls scheduled.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingBookings.map(booking => {
                const isAI = booking.source === 'ai_booked';
                const d = new Date(booking.scheduledAtUtc);
                
                return (
                  <div key={booking.id} className="nm-raised rounded-2xl p-5 transition-all hover:scale-[1.01] duration-300 relative overflow-hidden border border-white/5">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isAI ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                    
                    <div className="flex justify-between items-start ml-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${isAI ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {isAI ? 'AI Booked' : 'Manual'}
                          </span>
                          <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded-md border border-gray-700/50 flex items-center gap-1">
                            <MapPin className="w-3 h-3"/> {booking.timezone}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-[var(--nm-text)] mt-2" style={{fontFamily:"'Figtree',sans-serif"}}>
                          {booking.phoneNumber}
                        </h4>
                        
                        {booking.notes && (
                          <p className="text-sm text-gray-500 mt-2 bg-black/10 p-2 rounded-lg border border-white/5 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-50" />
                            {booking.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right flex flex-col items-end justify-center nm-pressed px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-xl font-bold text-[var(--nm-text)]" style={{fontFamily:"'DM Mono',monospace"}}>
                          {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          {d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Batch Campaigns */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[var(--nm-text)] mb-4 flex items-center gap-2" style={{fontFamily:"'Figtree',sans-serif"}}>
            <Bot className="w-5 h-5 text-amber-400" /> Active Campaigns
          </h3>
          
          <div className="nm-raised rounded-3xl p-5">
            {batches.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No batch campaigns running.</p>
            ) : (
              <div className="space-y-6">
                {batches.map(batch => (
                  <div key={batch.id} className="relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-[var(--nm-text)]">{batch.name}</span>
                      <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">{batch.status}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{batch.completedCount} / {batch.totalContacts}</span>
                    </div>
                    <div className="w-full bg-black/20 rounded-full h-1.5 nm-pressed overflow-hidden">
                      <div 
                        className="bg-amber-500 h-1.5 rounded-full relative" 
                        style={{ width: `${Math.max(5, (batch.completedCount / Math.max(batch.totalContacts, 1)) * 100)}%` }}
                      >
                        <div className="absolute top-0 bottom-0 left-0 right-0 bg-white/20 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
