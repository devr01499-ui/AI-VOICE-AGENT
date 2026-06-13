'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Download, Calendar, Play } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Monitor concurrency thresholds, cost distributions, and conversation sentiment metrics.</p>
        </div>
        <Button variant="outline" className="text-xs bg-slate-900 border-slate-800 text-slate-300 hover:text-white">
          <Download className="h-3.5 w-3.5 mr-2" /> Export Report (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
          <CardContent className="p-5 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Average Call Duration</span>
            <div className="text-2xl font-bold text-white">4m 32s</div>
            <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +12% from last week
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
          <CardContent className="p-5 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Sentiment Score</span>
            <div className="text-2xl font-bold text-white">88% Positive</div>
            <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +2.4% CSAT index
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
          <CardContent className="p-5 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Platform Cost</span>
            <div className="text-2xl font-bold text-white">$452.12</div>
            <p className="text-[10px] text-slate-400">ASR + LLM + TTS tokens aggregated</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
        <CardHeader className="border-b border-slate-800/80">
          <CardTitle className="text-base text-white">Operational Latency Performance</CardTitle>
          <CardDescription className="text-xs text-slate-400">Aggregated turn-around time across ElevenLabs, OpenAI, and Deepgram.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-48 bg-slate-950/40 rounded-xl border border-slate-800/80 flex items-center justify-center text-xs text-slate-500">
            [ Interactive Chart Container - TanStack Query integration active ]
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
