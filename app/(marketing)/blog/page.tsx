'use client';

import React, { useState } from 'react';
import { BookOpen, Calendar, Clock, ArrowRight, Search, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function BlogPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const articles = [
    {
      title: 'Solving Turn-Taking Latency in Google Multimodal Live WebSockets',
      desc: 'Deep dive into Google\'s `BidiGenerateContent` setup configurations. Learn how injecting explicit server-side `automaticActivityDetection` parameters prevents silent audio agent hangs.',
      date: 'June 30, 2026',
      readTime: '8 min read',
      author: 'Aria Chen, PM Lead',
      tag: 'WebSockets & API',
      slug: 'solving-turn-taking-gemini-live'
    },
    {
      title: 'Understanding Telephony Resampling: G.711 mu-law 8kHz to 16kHz PCM16',
      desc: 'PSTN carriers stream audio using standard 8kHz compressed codecs. Discover how linear interpolation upsampling helps generative speech models detect vocal energy cleanly without clipping.',
      date: 'June 28, 2026',
      readTime: '6 min read',
      author: 'Marcus Vance, CTO',
      tag: 'Telephony Codecs',
      slug: 'understanding-telephony-resampling'
    },
    {
      title: 'Handling Speech Barge-In Interruption in Production Voice Pipelines',
      desc: 'Explore the WebRTC and SIP engineering architectures required to trap interruption flags and immediately flush carrier playback buffers mid-syllable.',
      date: 'June 25, 2026',
      readTime: '5 min read',
      author: 'Ravi Kumar, Lead Architect',
      tag: 'Voice Engineering',
      slug: 'handling-speech-barge-in'
    },
    {
      title: 'Building High-Converting Outbound Candidate Screening Voice Campaigns',
      desc: 'Discover how white-label agency teams configure screening prompts (like the Priya HR Campaign) to pre-qualify developer technical stacks and compile reports.',
      date: 'June 20, 2026',
      readTime: '7 min read',
      author: 'Sarah Jenkins, Growth VP',
      tag: 'AI Recruitment',
      slug: 'building-outbound-voice-campaigns'
    }
  ];

  const filteredArticles = articles.filter(art => 
    art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-16 py-16 px-6 max-w-7xl mx-auto">
      {/* Blog Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/40 border border-blue-900/30 text-blue-400">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          Technical Repository
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans">
          Insights on Real-Time Voice AI
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          Deep dives into Voice Activity Detection (VAD) algorithms, telephony G.711 resampling, and carrier-grade latency optimizations written by our engineering team.
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-md mx-auto relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
        <Input
          type="text"
          placeholder="Search articles, tags or topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-900/60 border-slate-800 text-xs h-10 text-white focus:border-blue-500 focus:ring-blue-500/20"
        />
      </div>

      {/* Blog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {filteredArticles.map((art) => (
          <Card key={art.title} className="bg-slate-900/20 border-slate-900 backdrop-blur hover:border-slate-800 transition-colors flex flex-col justify-between group cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">
                <span>{art.tag}</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock className="h-3 w-3" /> {art.readTime}
                </span>
              </div>
              <CardTitle className="text-base font-bold text-white group-hover:text-blue-400 transition-colors leading-snug">
                {art.title}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                {art.desc}
              </p>
              
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-900/60">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {art.date}
                </span>
                <span className="font-semibold text-slate-400">{art.author}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredArticles.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-xs">
          No articles match your search parameters. Try searching for "VAD", "codec" or "resampling".
        </div>
      )}
    </div>
  );
}
