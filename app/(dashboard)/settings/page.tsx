'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings, User, Key, Users, CreditCard, ShieldAlert } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'keys' | 'billing'>('profile');

  const tabs = [
    { id: 'profile', label: 'Account Profile', icon: User },
    { id: 'keys', label: 'Developer API Keys', icon: Key },
    { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Configure your corporate account details, system credentials, and usage tiers.</p>
      </div>

      <div className="flex gap-4 border-b border-slate-800/80 pb-px shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-all focus:outline-none ${
                isActive 
                  ? 'border-blue-500 text-blue-400 font-bold' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-white">Profile Details</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Manage your dashboard display name and email address settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Name</label>
                <Input defaultValue="Rohit Kumar Sha" className="bg-slate-950 border-slate-800 text-slate-300" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Corporate Email</label>
                <Input defaultValue="admin@bolna.ai" className="bg-slate-950 border-slate-800 text-slate-300" disabled />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-800/50 pt-4 flex justify-end">
            <Button variant="premium" className="text-xs">Save Changes</Button>
          </CardFooter>
        </Card>
      )}

      {activeTab === 'keys' && (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-white">M2M Integration Tokens</CardTitle>
            <CardDescription className="text-slate-400 text-xs">API keys enabling secure calls triggers from your CRMs and backends.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-lg border border-slate-800/80 gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Production Client Token</span>
                <span className="text-[10px] text-slate-500 font-mono">bolna_live_pk_**********************828a</span>
              </div>
              <Button size="sm" variant="outline" className="text-xs bg-slate-950 border-slate-800 text-slate-400 hover:text-white">
                Reveal Key
              </Button>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-800/50 pt-4 flex justify-between items-center flex-wrap gap-4">
            <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Do not reveal tokens in public git repositories.
            </span>
            <Button variant="premium" className="text-xs">Generate New Key</Button>
          </CardFooter>
        </Card>
      )}

      {activeTab === 'billing' && (
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-white">Subscription Billing</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Track active pricing tiers and minute usage balances.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-lg flex items-center justify-between flex-wrap gap-4">
              <div>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Active Plan</span>
                <span className="text-base font-bold text-white">Enterprise AI Developer (Sandbox)</span>
              </div>
              <Button size="sm" variant="premium">Upgrade Plan</Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/20 p-4 border border-slate-800/60 rounded-lg space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Call minutes used</span>
                <span className="text-lg font-bold text-white">184,520 / 500,000</span>
              </div>
              <div className="bg-slate-950/20 p-4 border border-slate-800/60 rounded-lg space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">API credit balance</span>
                <span className="text-lg font-bold text-white">$1,245.00 remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
