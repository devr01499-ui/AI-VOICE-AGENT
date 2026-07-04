'use client';

import React from 'react';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Contacts & Audiences</h1>
          <p className="text-xs text-slate-400">Manage client lists, phone directory sheets, and target lead metrics.</p>
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-555 text-white font-bold rounded-xl text-xs h-9 px-4">
          <Plus className="h-4 w-4 mr-1.5" /> Add Contact
        </Button>
      </div>

      <div className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="p-12 text-center space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Users className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">No contacts listed</h4>
          <p className="text-[11px] text-slate-400">Add phone records to begin triggering automated voice screening.</p>
        </div>
      </div>
    </div>
  );
}
