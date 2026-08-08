'use client';

import React, { useState } from 'react';
import { Loader2, Search, PhoneCall } from 'lucide-react';
import { KycVerificationForm } from '../kyc';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function NumberSearchAndPurchase() {
  const [country, setCountry] = useState('IN');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<any | null>(null);
  const [purchasedNumberId, setPurchasedNumberId] = useState<string | null>(null);
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
    try {
      const res = await fetch(`/api/v2/numbers/search?country=${country}&type=local`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to search');
      setResults(data.data.mockResults || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (num: any) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load Razorpay script
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) throw new Error('Razorpay SDK failed to load');

      // 2. Create Order
      const orderRes = await fetch('/api/v2/numbers/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ baseCost: num.monthlyCost })
      });
      const orderData = await orderRes.json();
      if (!orderData.success) throw new Error(orderData.error || 'Order creation failed');

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock',
        amount: orderData.data.amount,
        currency: orderData.data.currency,
        name: 'Claritiy Voice',
        description: `Phone Number: ${num.phoneNumber}`,
        order_id: orderData.data.id,
        handler: async function (response: any) {
          // 3. Verify Payment and Provision
          const verifyRes = await fetch('/api/v2/numbers/purchase', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
            },
            body: JSON.stringify({
              phoneNumber: num.phoneNumber,
              countryCode: num.region,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature || 'mock_signature', // Mock sig for dev
            })
          });
          const verifyData = await verifyRes.json();
          if (!verifyData.success) {
            setError(verifyData.error || 'Payment verification failed');
          } else {
            setPurchasedNumberId(verifyData.data.phoneNumberId);
          }
        },
        theme: {
          color: '#2563EB'
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  if (purchasedNumberId) {
    return (
      <div className="mt-8">
        <KycVerificationForm 
          phoneNumberId={purchasedNumberId} 
          onSuccess={() => console.log('KYC submitted')} 
        />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Search & Purchase Numbers</h2>
      
      {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}

      <div className="flex gap-4 mb-6">
        <select 
          value={country} 
          onChange={(e) => setCountry(e.target.value)}
          className="border rounded-md px-3 py-2 flex-1"
        >
          <option value="IN">India (+91)</option>
          <option value="US">United States (+1)</option>
          <option value="AE">UAE (+971)</option>
        </select>
        <button 
          onClick={handleSearch}
          disabled={loading}
          className="bg-gray-900 text-white px-4 py-2 rounded-md flex items-center hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Search
        </button>
      </div>

      <div className="space-y-4">
        {results.map((num, i) => (
          <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-3">
              <PhoneCall className="w-5 h-5 text-gray-400" />
              <div>
                <div className="font-medium text-lg">{num.phoneNumber}</div>
                <div className="text-sm text-gray-500">Region: {num.region}</div>
              </div>
            </div>
            <div className="text-right flex items-center gap-4">
              <div className="font-semibold text-gray-900">
                ${num.monthlyCost + 2.0}/mo
              </div>
              <button 
                onClick={() => handlePurchase(num)}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Buy Number
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
