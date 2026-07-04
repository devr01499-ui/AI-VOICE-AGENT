'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckSquare, ShieldAlert, Award, Star, ThumbsUp } from 'lucide-react';

export default function AiQaPage() {
  const reviews = [
    { id: '1', agent: 'Delhi Office Receptionist', number: '+919876543210', score: '94/100', rating: 'Excellent', comment: 'Clear audio clamping, zero jitter latency, and immediate turn-taking.' },
    { id: '2', agent: 'Intake Screener', number: '+919176326811', score: '88/100', rating: 'Good', comment: 'Successfully answered product FAQs and collected caller email address details.' }
  ];

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-emerald-600" /> AI Quality Assurance
        </h1>
        <p className="text-xs text-slate-400 mt-1">Review speech transcription quality grading, NLP intent extraction scores, and sentiment metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reviews.map((r) => (
          <Card key={r.id} className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{r.agent}</span>
                <span className="text-xs font-bold text-slate-700 block font-mono mt-0.5">{r.number}</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold text-emerald-700 block font-mono">{r.score}</span>
                <span className="text-[9px] font-bold text-slate-500 uppercase">{r.rating}</span>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-655">
                <Star className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                <span>{r.comment}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
