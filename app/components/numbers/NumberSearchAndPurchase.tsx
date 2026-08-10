'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { KycVerificationForm } from '../kyc';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function NumberSearchAndPurchase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  
  const [purchasing, setPurchasing] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<any | null>(null);
  const [purchasedNumberData, setPurchasedNumberData] = useState<{ id: string, number: string, status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default fetch just US numbers for the demo
  const handleSearch = async (query: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const qParams = new URLSearchParams({ country: 'US', type: 'local' });
      if (query) {
        qParams.append('region', query);
      }

      const res = await fetch(`/api/v2/numbers/search?${qParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to search');
      setResults(data.data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    handleSearch('');
  }, []);

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleProvision = async (num: any) => {
    setPurchasing(true);
    setError(null);
    setSelectedNumber(num);
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) throw new Error('Payment system failed to load.');

      const totalCost = (num.setup_fee || 0) + (num.monthly_fee || 2.0);
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

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock',
        amount: orderData.data.amount,
        currency: orderData.data.currency,
        name: 'Claritiy Voice',
        description: `Provision ${num.e164}`,
        order_id: orderData.data.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('/api/v2/numbers/purchase', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
              },
              body: JSON.stringify({
                vobizNumberId: num.id,
                expectedPrice: num.monthly_fee || 2.0,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature || 'mock_signature',
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
              setError(verifyData.error || 'Provisioning failed.');
            } else {
              setPurchasedNumberData({
                id: verifyData.data.phoneNumberId,
                number: verifyData.data.number,
                status: verifyData.data.status
              });
            }
          } catch (verifyErr: any) {
             setError(verifyErr.message || 'Verification error');
          }
        },
        modal: {
          ondismiss: function() {
            setPurchasing(false);
            setSelectedNumber(null);
          }
        },
        theme: {
          color: '#059669' // Match the green Provision button
        }
      };

      const paymentObject = new window.Razorpay(options);
      
      paymentObject.on('payment.failed', function (response: any) {
        setError(`Payment failed: ${response.error.description || 'Unknown error'}`);
        setPurchasing(false);
        setSelectedNumber(null);
      });

      paymentObject.open();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
      setPurchasing(false);
      setSelectedNumber(null);
    }
  };

  if (purchasedNumberData) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-[#e5e5e5]">
        <div className="bg-white p-8 rounded-[32px] w-full max-w-[600px] shadow-sm text-center">
          <div className="w-16 h-16 bg-[#d1fae5] text-[#059669] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#2d3748] mb-2 tracking-tight">Number Provisioned!</h2>
          <p className="text-[#4a5568] mb-8">
            Successfully secured <span className="font-bold text-[#2d3748]">{purchasedNumberData.number}</span>.
          </p>

          {purchasedNumberData.status === 'KYC Required' ? (
            <div className="text-left bg-[#f7fafc] p-6 rounded-2xl border border-[#e2e8f0]">
              <h3 className="text-lg font-bold mb-4 text-[#2d3748]">Regulatory Verification</h3>
              <p className="text-sm text-[#718096] mb-6">
                To activate this number for outbound dialing, please complete verification.
              </p>
              <KycVerificationForm 
                phoneNumberId={purchasedNumberData.id} 
                onSuccess={() => window.location.href = '/dashboard/numbers'} 
              />
            </div>
          ) : (
            <button 
              onClick={() => window.location.href = '/dashboard/numbers'}
              className="bg-[#059669] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#047857] transition-colors"
            >
              Go to My Numbers
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fallback UI to show when empty or loading to maintain structure
  const renderSkeletons = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between p-5 rounded-[32px] border border-[#f0ebe1] bg-white animate-pulse">
           <div className="flex flex-col gap-2">
             <div className="w-32 h-5 bg-gray-200 rounded-md"></div>
             <div className="w-24 h-4 bg-gray-100 rounded-md"></div>
           </div>
           <div className="flex items-center gap-6">
             <div className="w-12 h-5 bg-gray-200 rounded-md"></div>
             <div className="w-24 h-10 bg-[#e5e5e5] rounded-full"></div>
           </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-[#e5e5e5] font-sans">
      <div className="bg-white w-full max-w-[600px] rounded-[32px] p-8 shadow-sm">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#2d3748] tracking-tight">Buy phone number</h1>
          <button 
            className="w-10 h-10 flex items-center justify-center bg-[#f7fafc] hover:bg-[#edf2f7] rounded-full text-[#718096] transition-colors"
            onClick={() => window.history.back()}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl flex items-start gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Search Input */}
        <div className="mb-8">
          <label className="block text-[11px] font-bold text-[#718096] tracking-[0.1em] uppercase mb-3 ml-2">
            Search by area code or city
          </label>
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a0aec0]" />
            <input
              type="text"
              placeholder="212, Austin, 800..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-2 border-[#059669] rounded-full py-4 pl-14 pr-6 text-[#2d3748] placeholder:text-[#a0aec0] focus:outline-none focus:ring-4 focus:ring-[#059669]/20 text-lg shadow-sm transition-all bg-white"
            />
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            renderSkeletons()
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-[#a0aec0]">
               No numbers found.
            </div>
          ) : (
            results.map((num, idx) => (
              <div key={num.id || idx} className="flex items-center justify-between p-5 rounded-[32px] border border-[#f0ebe1] bg-white hover:border-[#d1d5db] transition-colors">
                
                <div className="flex flex-col">
                  {/* Formatted Number */}
                  <div className="font-mono text-lg font-medium text-[#2d3748] tracking-tight mb-1">
                    {num.e164 || num.phoneNumber}
                  </div>
                  
                  {/* Location & Badge */}
                  <div className="flex items-center gap-2 text-[13px] text-[#718096]">
                    <span>{num.region || 'Anywhere, US'}</span>
                    <span className="text-[#cbd5e0]">•</span>
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-[#d1fae5] text-[#059669] rounded-full font-semibold tracking-wide">
                      {num.type || 'local'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Price */}
                  <div className="text-[15px] font-medium text-[#4a5568]">
                    ${num.monthly_fee || 2.0}/mo
                  </div>
                  
                  {/* Provision Button */}
                  <button
                    onClick={() => handleProvision(num)}
                    disabled={purchasing && selectedNumber?.id === num.id}
                    className="bg-[#059669] hover:bg-[#047857] text-white px-6 py-2.5 rounded-full font-semibold text-sm transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2 min-w-[110px] justify-center"
                  >
                    {purchasing && selectedNumber?.id === num.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Provision'
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e0;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
