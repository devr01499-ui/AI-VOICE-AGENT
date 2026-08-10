'use client';

import React, { useEffect, useState } from 'react';
import { Phone, Trash2, Clock, Activity, Loader2 } from 'lucide-react';

export function DashboardOverview() {
  const getRuntimeUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    return envUrl || (isLocal ? 'http://localhost:3001' : 'https://ai-voice-agent-backend-mv32.onrender.com');
  };

  const [numbers, setNumbers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const apiBase = getRuntimeUrl();
      // Fetch user for billing info
      const userRes = await fetch(`${apiBase}/api/v2/user`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const userData = await userRes.json();
      if (userData.success) setUser(userData.data);

      // Fetch provisioned numbers
      const numRes = await fetch(`${apiBase}/api/v2/numbers`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const numData = await numRes.json();
      if (numData.success) setNumbers(numData.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRelease = async (id: string) => {
    if (!confirm('Are you sure you want to release this number? This action cannot be undone.')) return;
    setReleasingId(id);
    try {
      const apiBase = getRuntimeUrl();
      const res = await fetch(`${apiBase}/api/v2/numbers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        setNumbers(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      alert('Failed to release number');
    } finally {
      setReleasingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Billing Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center">
          <div className="bg-blue-100 p-3 rounded-lg mr-4">
            <Activity className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500 font-medium">Billing Balance</div>
            <div className="text-2xl font-bold text-gray-900">${user?.billingBalance?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center">
          <div className="bg-green-100 p-3 rounded-lg mr-4">
            <Clock className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500 font-medium">Total Minutes Consumed</div>
            <div className="text-2xl font-bold text-gray-900">{user?.totalMinutesConsumed || 0} mins</div>
          </div>
        </div>
      </div>

      {/* Numbers List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Your Active Numbers</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {numbers.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No active phone numbers.</div>
          ) : (
            numbers.map((num) => (
              <div key={num.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${num.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-lg">{num.phoneNumber}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${num.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      {num.status === 'active' ? 'Active' : 'Pending KYC'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRelease(num.id)}
                  disabled={releasingId === num.id}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  {releasingId === num.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Release
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
