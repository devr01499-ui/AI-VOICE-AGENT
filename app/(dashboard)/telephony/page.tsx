'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// Interfaces for our data
interface InventoryNumber {
  id: string;
  e164: string;
  country: string;
  region: string;
  setupFee: number;
  monthlyFee: number;
  currency: string;
  capabilities: { voice: boolean; sms: boolean };
}

interface SubAccount {
  api_id: string;
  auth_id: string;
  auth_token: string;
  message: string;
}

export default function TelephonyMarketplace() {
  const { data: session } = useSession();
  const userId = (session as any)?.user?.id || (session as any)?.userId || '';

  const [inventory, setInventory] = useState<InventoryNumber[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  
  const [subAccount, setSubAccount] = useState<SubAccount | null>(null);
  const [provisioning, setProvisioning] = useState<boolean>(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  // Fetch inventory on mount
  useEffect(() => {
    if (userId) {
      fetchInventory();
      fetchSubAccount();
    }
  }, [userId]);

  const fetchSubAccount = async () => {
    try {
      const url = new URL('/api/v2/telephony/sub-accounts', window.location.origin);
      const res = await fetch(url.toString(), {
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        }
      });
      const data = await res.json();
      if (res.ok && data.success && data.subAccount) {
        setSubAccount(data.subAccount);
      }
    } catch (err) {
      // It's okay if they don't have one yet
    }
  };

  const fetchInventory = async (searchQuery: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/v2/telephony/inventory', window.location.origin);
      if (searchQuery) url.searchParams.append('search', searchQuery);

      const res = await fetch(url.toString(), {
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        }
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch inventory');
      
      setInventory(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInventory(search);
  };

  const handleProvisionSubAccount = async () => {
    setProvisioning(true);
    setError(null);
    try {
      const res = await fetch('/api/v2/telephony/sub-accounts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Provisioning failed');
      
      setSubAccount(data.subAccount);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  const handlePurchase = async (numberId: string) => {
    if (!subAccount?.auth_id) {
      setError('Please provision a Sub-Account first before purchasing.');
      return;
    }

    setPurchasingId(numberId);
    setError(null);
    setPurchaseSuccess(null);
    try {
      const res = await fetch('/api/v2/telephony/purchase', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          numberId,
          subAuthId: subAccount.auth_id
        }),
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Purchase failed');
      
      setPurchaseSuccess(`Successfully purchased and assigned DID: ${data.purchasedE164}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">DID Marketplace</h1>
            <p className="text-gray-500 mt-1">Browse, purchase, and assign phone numbers instantly.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {!subAccount ? (
              <button
                onClick={handleProvisionSubAccount}
                disabled={provisioning}
                className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {provisioning ? 'Provisioning...' : 'Provision Sub-Account'}
              </button>
            ) : (
              <div className="inline-flex items-center px-4 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                Active: {subAccount.api_id || 'Sub-Account'}
              </div>
            )}
          </div>
        </header>

        {/* Error / Success Banners */}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
        {purchaseSuccess && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
            {purchaseSuccess}
          </div>
        )}

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
            placeholder="Search by prefix, region, or capability..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="hidden">Search</button>
        </form>

        {/* Inventory Grid */}
        <main>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="animate-pulse bg-white rounded-2xl border border-gray-100 p-6 h-48 shadow-sm"></div>
              ))}
            </div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 border-dashed">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No numbers found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your search filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {inventory.map((num) => (
                <div 
                  key={num.id} 
                  className="group relative bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 flex flex-col justify-between overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl" title={num.country}>
                          {num.country === 'IN' ? '🇮🇳' : num.country === 'US' ? '🇺🇸' : '🌐'}
                        </span>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 tracking-tight">{num.e164}</h3>
                          <p className="text-xs text-gray-500 font-medium">{num.region}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Setup Fee</span>
                        <span className="font-semibold text-gray-900">{num.setupFee} {num.currency}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Monthly</span>
                        <span className="font-semibold text-gray-900">{num.monthlyFee} {num.currency}</span>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        {num.capabilities.voice && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            Voice
                          </span>
                        )}
                        {num.capabilities.sms && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                            SMS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(num.id)}
                    disabled={purchasingId === num.id || !subAccount}
                    className="w-full mt-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {purchasingId === num.id ? 'Purchasing...' : 'Buy Number'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
