'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, ShieldAlert, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';

export default function AlertingPage() {
  const [balanceAlert, setBalanceAlert] = useState<string>('50');
  const [webhookUrl, setWebhookUrl] = useState<string>('https://hooks.slack.com/services/YOUR_WORKSPACE_ID/YOUR_WEBHOOK_KEY');

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Bell className="h-5 w-5 text-emerald-600" /> Alerting Console
        </h1>
        <p className="text-xs text-slate-400 mt-1">Configure threshold notifications for API credits, network latency spikes, or failed telephony sessions.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-3xl">
        <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold text-slate-800">Trigger Conditions</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Set limits to alert administrators on critical workspace events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-655 block">Low Balance Trigger (Credits)</label>
              <Input 
                value={balanceAlert} 
                onChange={(e) => setBalanceAlert(e.target.value)} 
                className="bg-white border-slate-200 text-slate-700 rounded-xl max-w-sm" 
              />
              <span className="text-[10px] text-slate-400">Sends alert notifications when wallet balance drops below this threshold.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-655 block">Slack Webhook notification channel URL</label>
              <div className="flex gap-2">
                <Input 
                  value={webhookUrl} 
                  onChange={(e) => setWebhookUrl(e.target.value)} 
                  className="bg-white border-slate-200 text-slate-700 rounded-xl" 
                />
                <Button variant="outline" className="text-xs border-slate-200 text-slate-700 bg-white rounded-xl">Test Link</Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 pt-4 flex justify-end bg-slate-50/50 p-4">
            <Button className="text-xs bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl">Save Alert Rules</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
