'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  PhoneCall,
  Clock,
  CheckCircle,
  Plus,
  Play,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Volume2,
} from 'lucide-react';

export default function DashboardHome() {
  const [activeCallCount, setActiveCallCount] = useState(14);
  const [successRate, setSuccessRate] = useState(98.4);

  // Stats configs
  const stats = [
    {
      label: 'Total Agents',
      value: '24',
      subtext: '+4 configured this month',
      icon: Users,
      color: 'text-blue-400 bg-blue-950/40 border-blue-900/30',
    },
    {
      label: 'Active Calls',
      value: activeCallCount.toString(),
      subtext: 'Live on Plivo & Twilio',
      icon: PhoneCall,
      color: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30 animate-pulse',
    },
    {
      label: 'Minutes Consumed',
      value: '184,520',
      subtext: 'ASR + TTS dynamic billing',
      icon: Clock,
      color: 'text-amber-400 bg-amber-950/40 border-amber-900/30',
    },
    {
      label: 'Call Success Rate',
      value: `${successRate}%`,
      subtext: 'Target 95.0% threshold',
      icon: CheckCircle,
      color: 'text-purple-400 bg-purple-950/40 border-purple-900/30',
    },
  ];

  // Activities logs
  const activities = [
    {
      id: 1,
      type: 'agent_deploy',
      msg: 'Agent "Customer Support" successfully compiled to ElevenLabs V2 TTS',
      time: '2 mins ago',
      badge: 'Success',
      badgeColor: 'bg-emerald-950/50 border-emerald-900 text-emerald-400',
    },
    {
      id: 2,
      type: 'webhook_trigger',
      msg: 'HubSpot webhook map triggered on campaign COD Confirmation',
      time: '14 mins ago',
      badge: 'API Link',
      badgeColor: 'bg-blue-950/50 border-blue-900 text-blue-400',
    },
    {
      id: 3,
      type: 'call_complete',
      msg: 'Outbound qualification completed on +1 (555) 019-2834',
      time: '28 mins ago',
      badge: 'Completed',
      badgeColor: 'bg-slate-900 border-slate-800 text-slate-300',
    },
    {
      id: 4,
      type: 'system_alert',
      msg: 'Deepgram whisper-large translation latency latency stabilized (142ms)',
      time: '1 hour ago',
      badge: 'Optimized',
      badgeColor: 'bg-purple-950/50 border-purple-900 text-purple-400',
    },
  ];

  const handleTestTrigger = () => {
    setActiveCallCount(prev => prev + 1);
    setSuccessRate(prev => Math.min(100, Number((prev + 0.1).toFixed(2))));
  };

  return (
    <div className="space-y-6">
      {/* Top dashboard presentation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans">
            AI Operations Console
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time status overview of active voice agents, telephony networks, and latency distributions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleTestTrigger}
            variant="outline"
            className="text-xs bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
          >
            <Activity className="h-3.5 w-3.5 mr-2 text-emerald-400" />
            Simulate Active Call
          </Button>
          <Button variant="premium" className="text-xs">
            <Plus className="h-4 w-4 mr-1.5" /> Create New Agent
          </Button>
        </div>
      </div>

      {/* Grid: Stat indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="border-slate-800 bg-slate-900/40 backdrop-blur hover:border-slate-700 transition-all group cursor-pointer relative overflow-hidden"
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                  {stat.label}
                </span>
                <div className="text-2xl font-bold text-white font-sans tracking-tight">
                  {stat.value}
                </div>
                <span className="text-[11px] text-slate-400 leading-none">{stat.subtext}</span>
              </div>
              <div className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 ${stat.color} transition-transform group-hover:scale-105`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Core analytics graphs & timeline grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Quick Actions and System Telemetry */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
            <CardHeader className="pb-3 border-b border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-white">System Telemetry & Health</CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Live operational metrics for voice translation pipelines.
                  </CardDescription>
                </div>
                <span className="flex items-center gap-1 bg-emerald-950 border border-emerald-900 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  <Zap className="h-3 w-3" /> Operational
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">ASR Latency</span>
                  <div className="text-xl font-bold text-white">124ms</div>
                  <div className="h-1.5 w-full bg-slate-900 rounded overflow-hidden">
                    <div className="h-full bg-blue-500 rounded" style={{ width: '40%' }} />
                  </div>
                  <span className="text-[10px] text-slate-400">Deepgram Nova-2 Whisper</span>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">LLM TTFT</span>
                  <div className="text-xl font-bold text-white">182ms</div>
                  <div className="h-1.5 w-full bg-slate-900 rounded overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded" style={{ width: '65%' }} />
                  </div>
                  <span className="text-[10px] text-slate-400">GPT-4o / Claude 3.5 Sonnet</span>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">TTS Latency</span>
                  <div className="text-xl font-bold text-white">98ms</div>
                  <div className="h-1.5 w-full bg-slate-900 rounded overflow-hidden">
                    <div className="h-full bg-purple-500 rounded" style={{ width: '30%' }} />
                  </div>
                  <span className="text-[10px] text-slate-400">ElevenLabs Turbo v2</span>
                </div>
              </div>

              {/* Graphic simulated diagram */}
              <div className="p-4 bg-slate-950/30 rounded-lg border border-slate-800/80 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-blue-400 animate-pulse" />
                  <div>
                    <div className="text-xs font-semibold text-white">Primary Pipeline: Webhook Orchestrator</div>
                    <div className="text-[10px] text-slate-400">Dynamic routing active from Twilio numbers to LLM endpoints.</div>
                  </div>
                </div>
                <Button className="text-xs shrink-0" variant="outline">
                  Configure Routing <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Action Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur hover:border-slate-700 transition-colors">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-950 border border-blue-900/40 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-blue-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Explore Templates</h4>
                  <p className="text-xs text-slate-400">Browse 15+ production-ready Voice AI workflows.</p>
                  <Button variant="link" className="text-blue-400 p-0 h-auto text-xs font-semibold hover:underline">
                    View templates gallery &rarr;
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur hover:border-slate-700 transition-colors">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-purple-950 border border-purple-900/40 flex items-center justify-center shrink-0">
                  <PhoneCall className="h-5 w-5 text-purple-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Provision Numbers</h4>
                  <p className="text-xs text-slate-400">Claim, purchase and link Twilio and Plivo numbers.</p>
                  <Button variant="link" className="text-purple-400 p-0 h-auto text-xs font-semibold hover:underline">
                    Provision a number &rarr;
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right column: Recent Activity timeline */}
        <div>
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-800/80 shrink-0">
              <CardTitle className="text-lg text-white">Live Event Logs</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Operational records of API triggers, builds, and calls.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="relative border-l border-slate-800/80 pl-4 space-y-5">
                {activities.map((activity) => (
                  <div key={activity.id} className="relative">
                    {/* Circle icon on the timeline */}
                    <span className="absolute left-[-21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 border text-[9px] font-bold rounded ${activity.badgeColor} uppercase tracking-wider`}>
                          {activity.badge}
                        </span>
                        <span className="text-[10px] text-slate-500">{activity.time}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed">
                        {activity.msg}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Simple fallback components just to resolve standard React type bindings if needed
function Bot({ className }: { className?: string }) {
  return <Volume2 className={className} />;
}
