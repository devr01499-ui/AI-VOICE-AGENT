'use client';

import React, { useState } from 'react';
import { 
  Mail, 
  MapPin, 
  Phone, 
  Sparkles, 
  CheckCircle, 
  Send,
  Loader2,
  Bot
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function ContactUsPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    org: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;

    setLoading(true);
    // Simulate API lead ingestion
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({ name: '', email: '', org: '', message: '' });
    }, 1500);
  };

  return (
    <div className="space-y-16 py-16 px-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/40 border border-blue-900/30 text-blue-400">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          Connect With Us
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans">
          Schedule a Voice Architecture Demo
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          Need a compliant SIP bridge configuration or dedicated model pipeline? Speak to our team of Voice AI integration architects.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {/* Contact Info Sidebar */}
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-slate-900/20 border-slate-900 backdrop-blur">
            <CardHeader className="pb-3 border-b border-slate-900/80">
              <CardTitle className="text-sm font-semibold text-white">Global Offices</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs text-slate-400">
              <div className="space-y-1.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider block">Headquarters</span>
                <span className="text-white font-medium flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  120 Hawthorne St, Suite 400<br />San Francisco, CA 94107
                </span>
              </div>
              
              <div className="space-y-1.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider block">APAC Cluster</span>
                <span className="text-white font-medium flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  Plot No. 16, Sector 20A<br />Faridabad, HR 121003, India
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/20 border-slate-900 backdrop-blur">
            <CardHeader className="pb-3 border-b border-slate-900/80">
              <CardTitle className="text-sm font-semibold text-white">Direct Channels</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                <span className="text-white font-semibold">architects@clarityvoice.ai</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-500" />
                <span className="text-white font-semibold">+1 (888) 555-VOIP</span>
              </div>
            </CardContent>
          </Card>

          {/* Test Call promo widget */}
          <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-blue-400" />
              Live Interactive Test
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Don\'t want to wait? You can immediately trigger a test call to see our sub-200ms latency, VAD, and barge-in in action.
            </p>
            <Link href="/test-hr" className="block pt-1">
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-8">
                Call My Phone Now
              </Button>
            </Link>
          </div>
        </div>

        {/* Lead Form */}
        <div className="md:col-span-2">
          <Card className="bg-slate-900/20 border-slate-900 backdrop-blur shadow-2xl relative overflow-hidden h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-white">Trigger Architecture Consultation</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Submit your query below. Our lead integration engineer will contact you in under 4 hours with compliance details and network latency charts.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4 pb-6 flex-grow">
              {submitted ? (
                <div className="p-6 rounded-lg border border-emerald-950/30 bg-emerald-950/20 text-emerald-400 text-center space-y-2 max-w-md mx-auto my-6">
                  <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold">Request Logged Successfully!</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Thank you. A calendar link has been sent to your inbox to schedule a live session with our engineering leads.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                      <Input
                        type="text"
                        placeholder="Sarah Connor"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-slate-950/80 border-slate-800 text-xs h-10 text-white focus:border-blue-500"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Work Email</label>
                      <Input
                        type="email"
                        placeholder="sarah@cyberdyne.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-slate-950/80 border-slate-800 text-xs h-10 text-white focus:border-blue-500"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Organization Name</label>
                    <Input
                      type="text"
                      placeholder="Cyberdyne Systems"
                      value={formData.org}
                      onChange={(e) => setFormData({ ...formData, org: e.target.value })}
                      className="bg-slate-950/80 border-slate-800 text-xs h-10 text-white focus:border-blue-500"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Integration Notes / Query</label>
                    <textarea
                      placeholder="We need to connect 20 concurrent lines from our Vobiz trunk to Gemini Live..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="flex min-h-[100px] w-full rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                      disabled={loading}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold h-10 text-xs"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Transmitting Lead...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Demo Request
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
