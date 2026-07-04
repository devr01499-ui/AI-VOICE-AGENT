'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Plus, Upload, Play, CheckCircle } from 'lucide-react';

export default function BatchCallPage() {
  const [recipientList, setRecipientList] = useState<string>('+919876543210\n+919176326811');

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Batch Call Campaigns
        </h1>
        <p className="text-xs text-slate-400 mt-1">Concurrently trigger lists of automated voice calls to dial leads, customers, or prospects.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden md:col-span-2">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold text-slate-800">Recipients Phone List</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Input telephone numbers in E.164 format (one per line) to execute bulk calls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <textarea
              value={recipientList}
              onChange={(e) => setRecipientList(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-slate-200 bg-white text-xs p-4 outline-none focus:border-emerald-500 font-mono resize-none stable-scrollbar"
            />
          </CardContent>
          <CardFooter className="border-t border-slate-100 pt-4 flex justify-between bg-slate-50/50 p-4">
            <span className="text-[10px] text-slate-400 font-semibold">2 numbers detected for dialing queue</span>
            <Button className="text-xs bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl">
              <Play className="h-4 w-4 mr-1.5" /> Start Campaign
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
