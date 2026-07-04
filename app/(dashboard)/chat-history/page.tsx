'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MessageSquare, Calendar, ChevronRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ChatHistoryPage() {
  const sessions = [
    { id: 'chat-1', user: 'Visitor 8219', messagesCount: 12, rating: 'Satisfied', time: 'Today, 4:10 PM' },
    { id: 'chat-2', user: 'Delhi Lead #42', messagesCount: 8, rating: 'Neutral', time: 'Yesterday, 3:00 PM' }
  ];

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-emerald-600" /> Chat Logs Timeline
        </h1>
        <p className="text-xs text-slate-400 mt-1">Review text logs, transcripts histories, and outcomes of online chat assistant interactions.</p>
      </div>

      <div className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Visitor/Lead</th>
                <th className="p-4">Message Count</th>
                <th className="p-4">Outcome Status</th>
                <th className="p-4">Session Date</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-bold text-slate-700">{s.user}</td>
                  <td className="p-4 text-slate-500 font-mono">{s.messagesCount} replies</td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                      {s.rating}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400">{s.time}</td>
                  <td className="p-4 text-center">
                    <Button variant="outline" className="text-[10px] h-7 border-slate-200 text-slate-600 px-2 rounded-lg bg-white">
                      <Eye className="h-3.5 w-3.5 mr-1" /> View History
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
