'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Database, DollarSign, ArrowUpRight, History, ShieldCheck, CheckCircle2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3001';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  billingBalance: number;
}

export default function BillingPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/agents/me/profile`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setProfile(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const transactions = [
    { id: 'tx-1', amount: '-₹18.40', desc: 'Call session: +919876543210 (Puck Agent)', time: 'Today, 2:30 PM' },
    { id: 'tx-2', amount: '-₹4.15', desc: 'Call session: +919176326811 (Delhi Office)', time: 'Yesterday, 11:15 AM' },
    { id: 'tx-3', amount: '+₹1,000.00', desc: 'Credit Topup via Stripe Payment Gateway', time: '02 July, 9:00 AM' }
  ];

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-emerald-600" /> Billing Studio
        </h1>
        <p className="text-xs text-slate-400 mt-1">Manage API credit transactions, checkout top-ups, and review wallet statements.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden md:col-span-1">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Wallet Balance</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-baseline gap-1 text-slate-850">
              <span className="text-3xl font-extrabold font-mono">
                {loading ? '...' : `₹${profile?.billingBalance.toFixed(2) ?? '1000.00'}`}
              </span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Credits</span>
            </div>
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200/50 p-3.5 rounded-2xl text-[11px] flex gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
              <span>Multi-tenant isolation active. Wallet balance updates in real-time.</span>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-555 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-sm">
              <ArrowUpRight className="h-4 w-4 mr-1" /> Add Credits
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden md:col-span-2">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-bold text-slate-800">API Wallet Transactions Log</CardTitle>
              <CardDescription className="text-[10px] text-slate-400">Statement history of recent credit allocations and outbound calls deductions.</CardDescription>
            </div>
            <History className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-700 block">{tx.desc}</span>
                  <span className="text-[10px] text-slate-400">{tx.time}</span>
                </div>
                <span className={`text-xs font-extrabold font-mono ${
                  tx.amount.startsWith('-') ? 'text-rose-600' : 'text-emerald-700'
                }`}>{tx.amount}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
