'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Plus, Search, Activity, ExternalLink, Calendar } from 'lucide-react';

export default function AgentsPage() {
  const dummyAgents = [
    { id: 1, name: 'Customer Support Pro', status: 'Active', language: 'English', provider: 'ElevenLabs', calls: 1420 },
    { id: 2, name: 'Lead Screener Bot', status: 'Draft', language: 'Hindi', provider: 'Cartesia', calls: 0 },
    { id: 3, name: 'Clinic Scheduler', status: 'Active', language: 'Hinglish', provider: 'OpenAI', calls: 350 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Agents Library</h1>
          <p className="text-slate-400 text-sm mt-1">Configure and manage active conversational personalities and integrations.</p>
        </div>
        <Button variant="premium">
          <Plus className="h-4 w-4 mr-1.5" /> Configure Custom Agent
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Filter agents by name, language or model provider..."
          className="bg-transparent border-none text-xs focus:outline-none w-full text-slate-300 placeholder-slate-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {dummyAgents.map((agent) => (
          <Card key={agent.id} className="border-slate-800 bg-slate-900/40 backdrop-blur hover:border-slate-700 transition-all group">
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base text-white group-hover:text-blue-400 transition-colors">
                  {agent.name}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                  <Calendar className="h-3 w-3" /> Lang: {agent.language}
                </CardDescription>
              </div>
              <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase tracking-wider ${
                agent.status === 'Active' 
                  ? 'bg-emerald-950/50 border-emerald-900 text-emerald-400' 
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                {agent.status}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Voice Engine</span>
                  <span className="text-slate-300 font-medium">{agent.provider}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Calls</span>
                  <span className="text-slate-300 font-medium">{agent.calls}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="text-xs w-full bg-slate-950 border-slate-800 text-slate-400 hover:text-white">
                  Edit Config
                </Button>
                <Button variant="premium" size="icon" className="shrink-0" title="Live Test">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
