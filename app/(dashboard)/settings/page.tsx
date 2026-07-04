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
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Settings className="h-5 w-5 text-emerald-600" /> Account Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">Configure your corporate account details, system credentials, and usage tiers.</p>
      </div>

      <div className="flex gap-4 border-b border-slate-200 pb-px shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-all focus:outline-none ${
                isActive 
                  ? 'border-emerald-600 text-emerald-700 font-bold' 
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && (
        <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold text-slate-800">Profile Details</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Manage your dashboard display name and email address settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Name</label>
                <Input defaultValue="Rohit Kumar Sha" className="bg-white border-slate-200 text-slate-700 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Corporate Email</label>
                <Input defaultValue="devr01499@gmail.com" className="bg-white border-slate-200 text-slate-700 rounded-xl" disabled />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 pt-4 flex justify-end bg-slate-50/50 p-4">
            <Button className="text-xs bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl">Save Changes</Button>
          </CardFooter>
        </Card>
      )}

      {activeTab === 'keys' && (
        <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold text-slate-800">M2M Integration Tokens</CardTitle>
            <CardDescription className="text-slate-400 text-xs">API keys enabling secure calls triggers from your CRMs and backends.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 gap-4">
              <div>
                <span className="text-xs font-bold text-slate-700 block">Production Client Token</span>
                <span className="text-[10px] text-slate-400 font-mono">clarity_voice_live_pk_**********************828a</span>
              </div>
              <Button size="sm" variant="outline" className="text-xs bg-white border-slate-250 text-slate-600 hover:text-emerald-700 rounded-xl">
                Reveal Key
              </Button>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 pt-4 flex justify-between items-center bg-slate-50/50 p-4">
            <span className="text-[10px] text-slate-400 flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="h-4 w-4 text-amber-600" /> Do not reveal tokens in public git repositories.
            </span>
            <Button className="text-xs bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl">Generate New Key</Button>
          </CardFooter>
        </Card>
      )}

      {activeTab === 'billing' && (
        <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold text-slate-800">Subscription Billing</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Track active pricing tiers and minute usage balances.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Active Plan</span>
                <span className="text-sm font-extrabold text-slate-800">Enterprise AI Developer (Sandbox)</span>
              </div>
              <Button className="text-xs bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl">Upgrade Plan</Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Call minutes used</span>
                <span className="text-base font-extrabold text-slate-800">184,520 / 500,000</span>
              </div>
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">API credit balance</span>
                <span className="text-base font-extrabold text-slate-850">12,450 Credits remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
