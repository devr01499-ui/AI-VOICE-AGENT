'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TestCallDialog from '@/components/TestCallDialog';
import api from '@/lib/api-client';
import {
  PhoneCall,
  Briefcase,
  MapPin,
  FileText,
  User,
  Loader2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

export default function HrTestPage() {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  const HR_AGENT_ID = 'd80a11e0-ebc9-4ef8-bb6d-6bb9bd380a13';
  const DEV_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  const handleLaunchCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      setError('Please enter a phone number.');
      return;
    }
    if (!phoneNumber.match(/^\+?[1-9]\d{6,14}$/)) {
      setError('Please enter a valid phone number in E.164 format (e.g., +919876543210).');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/api/v2/calls', {
        phoneNumber,
        agentId: HR_AGENT_ID,
        userId: DEV_USER_ID,
        userData: { source: 'delhi-hr-recruiter-page' }
      });

      if (response.data?.success && response.data?.data) {
        setActiveCallId(response.data.data.callId);
        setIsDialogOpen(true);
      } else {
        throw new Error('Invalid response structure from backend.');
      }
    } catch (err: any) {
      console.error('Failed to trigger HR call:', err);
      setError(err?.message || 'Failed to place the call. Ensure the backend server is running and Vobiz is connected.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">
      {/* Back button */}
      <div className="flex items-center">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Header section with gradient */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/50 border border-blue-900/50 text-blue-400">
          <Sparkles className="w-3.5 h-3.5" />
          Delhi Campaign Portal
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 font-sans">
          Delhi HR Recruiter — Job Opening Call Test
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl">
          Instantly request a live test call from Priya, our AI HR Recruiter, calling regarding a Software Engineer job opening in Delhi.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Campaign info block */}
        <div className="md:col-span-1 space-y-4">
          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-slate-800/60">
              <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-400" />
                Job Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 block font-medium uppercase tracking-wider">Position</span>
                <span className="text-slate-300 font-medium">Software Engineer</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block font-medium uppercase tracking-wider">Location</span>
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Delhi, India (On-site)
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block font-medium uppercase tracking-wider">Requirements</span>
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  React, TypeScript
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block font-medium uppercase tracking-wider">AI Recruiter</span>
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Priya (Voice: Alloy)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Form */}
        <div className="md:col-span-2">
          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md shadow-2xl relative overflow-hidden h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-blue-400" />
                Trigger Live Call
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Enter your phone number below. The AI agent will call your phone shortly to run through the recruitment interview script.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4 flex-grow flex flex-col justify-between pb-6">
              <form onSubmit={handleLaunchCall} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-xs font-semibold text-slate-300">
                    Recipient Phone Number (E.164 format)
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+919876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20"
                    disabled={loading}
                  />
                  <p className="text-[10px] text-slate-500">
                    Format: + [Country Code] [Number] (e.g. +91 for India, +1 for US). No spaces or dashes.
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-lg border border-rose-950/30 bg-rose-950/20 text-rose-400 text-xs font-medium">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium shadow-lg hover:shadow-blue-500/10 transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Initiating Connection...
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-4 h-4 mr-2" />
                      Call My Phone Now
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Live Call dialog tracker */}
      <TestCallDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setActiveCallId(null);
        }}
        initialCallId={activeCallId}
      />
    </div>
  );
}
