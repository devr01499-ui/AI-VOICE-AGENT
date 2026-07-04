'use client';

import React from 'react';
import { Users, Search, Plus, UserPlus, Mail, Phone, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ContactsPage() {
  const contactList = [
    { id: 'c-1', name: 'Delhi lead office representative', phone: '+919876543210', email: 'delhi.office@example.com', company: 'IndiCorp' },
    { id: 'c-2', name: 'Product distributor support', phone: '+919176326811', email: 'support@distrib.in', company: 'Apex Logistics' }
  ];

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" /> Contacts & Leads
        </h1>
        <p className="text-xs text-slate-400 mt-1">Manage target list recipients, details data, and CRM profiles synced with Hubspot.</p>
      </div>

      <div className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center bg-slate-50/50 justify-between">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-72 text-slate-400 text-xs">
            <Search className="h-4 w-4 mr-2 text-slate-400" />
            <input type="text" placeholder="Search contacts..." className="bg-transparent border-none text-xs focus:outline-none w-full text-slate-700 placeholder-slate-400" />
          </div>
          <Button className="text-xs bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl">
            <UserPlus className="h-4 w-4 mr-1.5" /> Add Contact
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Contact name</th>
                <th className="p-4">Phone Number</th>
                <th className="p-4">Email</th>
                <th className="p-4">Company</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contactList.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-bold text-slate-700">{c.name}</td>
                  <td className="p-4 font-mono text-slate-655">{c.phone}</td>
                  <td className="p-4 text-slate-500">{c.email}</td>
                  <td className="p-4 text-slate-500 font-semibold">{c.company}</td>
                  <td className="p-4 text-center">
                    <Button variant="outline" className="text-[10px] h-7 border-slate-200 text-slate-600 px-2 rounded-lg bg-white">
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
