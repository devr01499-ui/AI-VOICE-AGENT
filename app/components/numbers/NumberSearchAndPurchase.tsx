'use client';

import React, { useState } from 'react';
import { Loader2, Search, PhoneCall, CheckCircle2, AlertCircle, Filter, X } from 'lucide-react';
import { KycVerificationForm } from '../kyc';

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Map standard capabilities to friendly badges
const CapabilityBadge = ({ capability }: { capability: string }) => {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
      {capability}
    </span>
  );
};

export function NumberSearchAndPurchase() {
  const [country, setCountry] = useState('US');
  const [type, setType] = useState('local');
  const [region, setRegion] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<any | null>(null);
  
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedNumberData, setPurchasedNumberData] = useState<{ id: string, number: string, status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const queryParams = new URLSearchParams({ country, type });
      if (region) queryParams.append('region', region);

      const res = await fetch(`/api/v2/numbers/search?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to search');
      setResults(data.data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPurchase = async (num: any) => {
    setPurchasing(true);
    setError(null);
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) throw new Error('Payment system failed to load. Please check your connection.');

      // 1. Create a payment order first for the total checkout amount
      const totalCost = (num.setup_fee || 0) + (num.monthly_fee || 0);
      const orderRes = await fetch('/api/v2/numbers/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ baseCost: totalCost })
      });
      const orderData = await orderRes.json();
      if (!orderData.success) throw new Error(orderData.error || 'Order creation failed');

      // 2. Open Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock',
        amount: orderData.data.amount,
        currency: orderData.data.currency,
        name: 'Claritiy Voice',
        description: `Setup & 1st Month: ${num.e164}`,
        order_id: orderData.data.id,
        handler: async function (response: any) {
          try {
            // 3. Complete actual provision securely on backend
            const verifyRes = await fetch('/api/v2/numbers/purchase', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
              },
              body: JSON.stringify({
                vobizNumberId: num.id,
                expectedPrice: num.monthly_fee,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature || 'mock_signature',
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
              setError(verifyData.error || 'Payment verification failed or number unavailable.');
            } else {
              setPurchasedNumberData({
                id: verifyData.data.phoneNumberId,
                number: verifyData.data.number,
                status: verifyData.data.status
              });
              setSelectedNumber(null);
            }
          } catch (verifyErr: any) {
             setError(verifyErr.message || 'Verification error');
          }
        },
        modal: {
          ondismiss: function() {
            setPurchasing(false);
          }
        },
        theme: {
          color: '#111827' // match brand
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
      setPurchasing(false);
    }
  };

  if (purchasedNumberData) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm max-w-3xl mx-auto text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Purchase Successful!</h2>
        <p className="text-gray-600 mb-8">
          You have successfully purchased <span className="font-semibold text-gray-900">{purchasedNumberData.number}</span>.
        </p>

        {purchasedNumberData.status === 'KYC Required' ? (
          <div className="text-left bg-gray-50 p-6 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Next Step: Regulatory Verification</h3>
            <p className="text-sm text-gray-600 mb-6">
              To activate this number for outbound dialing, telecom regulations require identity verification.
            </p>
            <KycVerificationForm 
              phoneNumberId={purchasedNumberData.id} 
              onSuccess={() => window.location.href = '/dashboard/numbers'} 
            />
          </div>
        ) : (
          <button 
            onClick={() => window.location.href = '/dashboard/numbers'}
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Go to My Numbers
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
      <div className="mb-8 border-b pb-6">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Buy a Phone Number</h2>
        <p className="text-gray-500 mt-1">Search and provision live numbers instantly for your voice agents.</p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Search Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <select 
            value={country} 
            onChange={(e) => setCountry(e.target.value)}
            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black px-3 py-2 border bg-white"
          >
            <option value="US">United States (+1)</option>
            <option value="CA">Canada (+1)</option>
            <option value="GB">United Kingdom (+44)</option>
            <option value="IN">India (+91)</option>
            <option value="AU">Australia (+61)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Number Type</label>
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)}
            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black px-3 py-2 border bg-white"
          >
            <option value="local">Local</option>
            <option value="toll_free">Toll-Free</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prefix / Region</label>
          <div className="relative">
             <Filter className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
             <input 
               type="text" 
               placeholder="e.g. 415 or NY"
               value={region}
               onChange={(e) => setRegion(e.target.value)}
               className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black pl-9 pr-3 py-2 border bg-white"
             />
          </div>
        </div>

        <div className="flex items-end">
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="w-full bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center h-[42px]"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Search Inventory
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {loading && results.length === 0 && (
          <div className="animate-pulse space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl w-full"></div>
            ))}
          </div>
        )}
        
        {!loading && results.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
             <PhoneCall className="w-10 h-10 text-gray-300 mx-auto mb-3" />
             <p className="text-gray-500 font-medium">No numbers found matching your criteria.</p>
             <p className="text-sm text-gray-400">Try adjusting your filters.</p>
          </div>
        )}

        {results.map((num, i) => (
          <div key={num.id || i} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-gray-300 transition-all group">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 group-hover:bg-gray-100 transition-colors">
                <PhoneCall className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <div className="font-semibold text-lg text-gray-900 tracking-wide">{num.e164 || num.phoneNumber}</div>
                <div className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                  <span>{num.region || 'Any Region'}, {num.country || country}</span>
                  <span className="text-gray-300">•</span>
                  <span className="capitalize">{num.type || type}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-6">
              <div className="text-left sm:text-right">
                 <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Monthly</div>
                 <div className="font-bold text-gray-900">${(num.monthly_fee || 1.5).toFixed(2)}</div>
              </div>
              <button 
                onClick={() => setSelectedNumber(num)}
                className="bg-white border border-gray-300 text-gray-900 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
              >
                Select
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Modal */}
      {selectedNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h3 className="font-semibold text-lg text-gray-900">Confirm Purchase</h3>
              <button 
                onClick={() => !purchasing && setSelectedNumber(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"
                disabled={purchasing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-900 mb-1">{selectedNumber.e164 || selectedNumber.phoneNumber}</div>
                <div className="text-gray-500">{selectedNumber.region}, {selectedNumber.country}</div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                <div className="flex justify-between items-center mb-3 text-sm">
                  <span className="text-gray-600">Setup Fee (One-time)</span>
                  <span className="font-medium">${(selectedNumber.setup_fee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-3 text-sm">
                  <span className="text-gray-600">Monthly Fee</span>
                  <span className="font-medium">${(selectedNumber.monthly_fee || 1.5).toFixed(2)}</span>
                </div>
                <div className="h-px bg-gray-200 my-3"></div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Due Today</span>
                  <span className="font-bold text-lg text-gray-900">
                    ${((selectedNumber.setup_fee || 0) + (selectedNumber.monthly_fee || 1.5)).toFixed(2)}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => handleConfirmPurchase(selectedNumber)}
                disabled={purchasing}
                className="w-full bg-black text-white rounded-xl py-3.5 font-medium hover:bg-gray-900 transition-colors flex justify-center items-center disabled:opacity-70 shadow-md"
              >
                {purchasing ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing Securely...</>
                ) : (
                  'Complete Purchase'
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-4">
                By purchasing, you agree to our Acceptable Use Policy and understand that regulatory KYC may be required before outbound calls are enabled.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
