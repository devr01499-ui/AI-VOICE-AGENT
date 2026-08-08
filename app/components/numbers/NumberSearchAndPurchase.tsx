'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Search, ShoppingCart, Loader2, CheckCircle2, AlertCircle, X, ChevronDown } from 'lucide-react';
import { KycVerificationForm } from '../kyc';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function NumberSearchAndPurchase() {
  const [country, setCountry] = useState('IN');
  const [type, setType] = useState('local');
  const [region, setRegion] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<any | null>(null);
  
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedNumberData, setPurchasedNumberData] = useState<{ id: string, number: string, status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { id: 'local', label: 'Local', count: 5739 },
    { id: 'national', label: 'National' },
    { id: 'mobile', label: 'Mobile' },
    { id: 'toll_free', label: 'Toll-free' },
    { id: 'shared_cost', label: 'Shared Cost' },
    { id: 'global', label: 'Global / UIFN' },
  ];

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSearch = async (overrideType?: string) => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const activeType = overrideType || type;
      // map frontend tabs to api type
      let apiType = activeType;
      if (apiType === 'national') apiType = 'local';
      if (apiType === 'toll_free') apiType = 'toll_free';
      if (apiType === 'shared_cost' || apiType === 'global') apiType = 'local'; // Fallback
      
      const queryParams = new URLSearchParams({ country, type: apiType });
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

  useEffect(() => {
    handleSearch();
  }, [country, type]);

  const handleConfirmPurchase = async (num: any) => {
    setPurchasing(true);
    setError(null);
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) throw new Error('Payment system failed to load. Please check your connection.');

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

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock',
        amount: orderData.data.amount,
        currency: orderData.data.currency,
        name: 'Claritiy Voice',
        description: `Setup & 1st Month: ${num.e164}`,
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
          color: '#EA580C' // Vobiz Orange
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
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm max-w-3xl mx-auto text-center mt-12">
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
            className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Go to My Numbers
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen text-gray-900 font-sans">
      {/* Header Area */}
      <div className="border-b border-gray-200 pt-6 px-8 bg-white sticky top-0 z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Numbers Inventory</h1>
              <p className="text-sm text-gray-500 mt-1">Browse 20,000+ numbers across 90+ countries — filter to find your perfect match.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative">
               <select 
                 value={country}
                 onChange={(e) => setCountry(e.target.value)}
                 className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-full pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 w-48 shadow-sm font-medium cursor-pointer"
               >
                 <option value="IN">Country India</option>
                 <option value="US">Country USA</option>
                 <option value="GB">Country UK</option>
                 <option value="AU">Country Australia</option>
               </select>
               <span className="absolute left-3 top-2.5 font-semibold text-gray-500 text-sm">{country}</span>
               <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3" />
              <input 
                type="text" 
                placeholder="Search numbers..." 
                className="w-full bg-gray-50 border border-gray-200 rounded-full pl-10 pr-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors shadow-sm placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-8 overflow-x-auto no-scrollbar pt-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setType(tab.id);
              }}
              className={`pb-4 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                type === tab.id 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  type === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative">
            <select 
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="appearance-none border border-gray-200 text-gray-600 text-sm rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-gray-300 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
            >
              <option value="">Region: Any</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Delhi">Delhi</option>
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select className="appearance-none border border-gray-200 text-gray-600 text-sm rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-gray-300 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
              <option>Series: Any</option>
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select className="appearance-none border border-gray-200 text-gray-600 text-sm rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-gray-300 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
              <option>Supported Features: Any</option>
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Data Table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[11px] font-bold tracking-wider text-gray-400 uppercase border-b border-gray-200">
                  <th className="py-4 px-6 font-semibold">PREFIX / AREA</th>
                  <th className="py-4 px-6 font-semibold">E.164</th>
                  <th className="py-4 px-6 font-semibold">SUPPORTED FEATURES</th>
                  <th className="py-4 px-6 font-semibold">SERIES</th>
                  <th className="py-4 px-6 text-right font-semibold">MONTHLY + SETUP</th>
                  <th className="py-4 px-6 text-right font-semibold">CART</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-6"><div className="h-4 bg-gray-100 rounded w-24 mb-1"></div><div className="h-3 bg-gray-100 rounded w-16"></div></td>
                      <td className="py-4 px-6"><div className="h-4 bg-gray-100 rounded w-28"></div></td>
                      <td className="py-4 px-6"><div className="h-6 bg-gray-100 rounded-md w-16"></div></td>
                      <td className="py-4 px-6"><div className="h-4 bg-gray-100 rounded w-8"></div></td>
                      <td className="py-4 px-6 text-right"><div className="h-4 bg-gray-100 rounded w-20 ml-auto mb-1"></div><div className="h-3 bg-gray-100 rounded w-16 ml-auto"></div></td>
                      <td className="py-4 px-6 text-right"><div className="h-8 bg-gray-200 rounded-lg w-20 ml-auto"></div></td>
                    </tr>
                  ))
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-500">
                      No numbers found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  results.map((num, i) => (
                    <tr key={num.id || i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{country}</span>
                          <span className="text-sm font-bold text-gray-900">
                            {num.region_code || (num.e164 ? num.e164.substring(1, 3) + '-' + num.e164.substring(3, 5) : '91-80')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{num.region || 'Karnataka'}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-medium text-gray-600">{num.e164 || num.phoneNumber}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-600">
                          Voice
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-400">—</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="text-sm font-bold text-gray-900">
                          ${(num.monthly_fee || 1.5).toFixed(2)}<span className="font-medium text-xs">/mo</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">+${(num.setup_fee || 0).toFixed(2)} setup</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => setSelectedNumber(num)}
                          className="inline-flex items-center justify-center gap-2 bg-[#EA580C] hover:bg-[#c24106] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Buy
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Purchase Modal (Kept for safe checkout flow) */}
      {selectedNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-lg text-gray-900">Confirm Purchase</h3>
              <button 
                onClick={() => !purchasing && setSelectedNumber(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1.5 hover:bg-gray-200 transition-colors"
                disabled={purchasing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-black text-gray-900 mb-1">{selectedNumber.e164 || selectedNumber.phoneNumber}</div>
                <div className="text-sm font-semibold text-gray-500">{selectedNumber.region || 'Karnataka'}, {country}</div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                <div className="flex justify-between items-center mb-3 text-sm">
                  <span className="text-gray-600 font-medium">Setup Fee (One-time)</span>
                  <span className="font-semibold text-gray-900">${(selectedNumber.setup_fee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-3 text-sm">
                  <span className="text-gray-600 font-medium">Monthly Fee</span>
                  <span className="font-semibold text-gray-900">${(selectedNumber.monthly_fee || 1.5).toFixed(2)}</span>
                </div>
                <div className="h-px bg-gray-200 my-4"></div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">Due Today</span>
                  <span className="font-black text-xl text-[#EA580C]">
                    ${((selectedNumber.setup_fee || 0) + (selectedNumber.monthly_fee || 1.5)).toFixed(2)}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => handleConfirmPurchase(selectedNumber)}
                disabled={purchasing}
                className="w-full bg-[#EA580C] text-white rounded-xl py-3.5 font-bold hover:bg-[#c24106] transition-colors flex justify-center items-center disabled:opacity-70 shadow-lg shadow-orange-500/30 active:scale-[0.98]"
              >
                {purchasing ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing Securely...</>
                ) : (
                  'Complete Purchase'
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-4 font-medium leading-relaxed">
                By purchasing, you agree to our Acceptable Use Policy. Regulatory KYC verification may be required before outbound calls are enabled.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
