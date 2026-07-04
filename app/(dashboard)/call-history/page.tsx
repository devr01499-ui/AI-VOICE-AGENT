'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  History, 
  Search, 
  PhoneCall, 
  Clock, 
  DollarSign, 
  User, 
  Eye, 
  FileText, 
  PhoneIncoming, 
  PhoneOutgoing, 
  AlertCircle,
  X,
  Bot
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ai-voice-agent-backend-mv32.onrender.com');

const getAuthHeaders = (additional: Record<string, string> = {}) => {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'x-user-id': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    ...additional
  };
};

interface CallRecord {
  id: string;
  agentId: string;
  phoneNumber: string;
  status: string;
  durationSeconds: number;
  createdAt: string;
  agent?: {
    name: string;
  };
  execution?: {
    outcome: string;
    costBreakdown: string;
  };
}

interface TranscriptItem {
  id: string;
  speaker: 'user' | 'agent' | 'system';
  content: string;
  createdAt: string;
}

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterPhone, setFilterPhone] = useState<string>('');
  
  // Modal for transcripts
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v2/calls`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCalls(json.data);
        }
      }
    } catch (err) {
      console.error('Error fetching calls list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTranscript = async (call: CallRecord) => {
    setSelectedCall(call);
    setIsModalOpen(true);
    setLoadingTranscript(true);
    setTranscripts([]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/calls/${call.id}/transcript`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTranscripts(json.data);
        }
      }
    } catch (err) {
      console.error('Error fetching transcript:', err);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const filteredCalls = calls.filter((c) =>
    c.phoneNumber.includes(filterPhone)
  );

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-800 border-emerald-250 text-emerald-800 font-bold';
      case 'ringing': return 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse';
      case 'in_progress':
      case 'connected': return 'bg-blue-50 text-blue-800 border-blue-205';
      case 'failed': return 'bg-rose-50 text-rose-800 border-rose-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getCostAmount = (call: CallRecord) => {
    try {
      if (call.execution?.costBreakdown) {
        const cost = JSON.parse(call.execution.costBreakdown);
        return `₹${Number(cost.total).toFixed(3)}`;
      }
    } catch {
      // Ignore
    }
    return '₹0.00';
  };

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <History className="h-5 w-5 text-emerald-600" /> Historical Session Logs
        </h1>
        <p className="text-xs text-slate-400">
          Monitor real-time status updates, absolute durations, accumulated wallet deductions, and full transcript conversations.
        </p>
      </div>

      <div className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center bg-slate-50/50 justify-between">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-72 text-slate-400 text-xs">
            <Search className="h-4 w-4 mr-2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter by phone number..." 
              value={filterPhone}
              onChange={(e) => setFilterPhone(e.target.value)}
              className="bg-transparent border-none text-xs focus:outline-none w-full text-slate-700 placeholder-slate-400" 
            />
          </div>
          <Button onClick={fetchCalls} variant="outline" className="text-xs border-slate-200 text-slate-700 bg-white">
            Refresh logs
          </Button>
        </div>

        {loading ? (
          <div className="p-20 text-center text-xs text-slate-400">
            Loading historical call sessions...
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <History className="h-5 w-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800">No matches found</h4>
            <p className="text-[11px] text-slate-400">Initiate calls from the Agent Configuration Studio playground to log telemetry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Recipient</th>
                  <th className="p-4">Voice Persona</th>
                  <th className="p-4">Session Status</th>
                  <th className="p-4">Call Duration</th>
                  <th className="p-4">Accumulated Cost</th>
                  <th className="p-4">Created Time</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-mono font-medium text-slate-800">{call.phoneNumber}</td>
                    <td className="p-4 font-semibold text-slate-700">{call.agent?.name || 'Reception Agent'}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(call.status)}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-mono">{formatSeconds(call.durationSeconds)}</td>
                    <td className="p-4 text-emerald-700 font-bold font-mono">{getCostAmount(call)}</td>
                    <td className="p-4 text-slate-400">{new Date(call.createdAt).toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <Button 
                        onClick={() => handleViewTranscript(call)} 
                        variant="outline" 
                        className="text-[10px] h-7 border-slate-200 text-slate-655 hover:text-emerald-700 px-2 rounded-lg bg-white"
                      >
                        <Eye className="h-3 w-3 mr-1" /> View Dialogue
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transcript Details Overlay Dialog */}
      {isModalOpen && selectedCall && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <PhoneOutgoing className="h-4 w-4 text-emerald-600" /> Dialogue Log: {selectedCall.phoneNumber}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Call ID: {selectedCall.id} • Cost: {getCostAmount(selectedCall)}
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-750 p-1 bg-white border border-slate-200 rounded-lg animate-in"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Transcript Timeline Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 stable-scrollbar bg-[#FDFBF7]/30 min-h-[300px]">
              {loadingTranscript ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Retrieving transcript conversation...
                </div>
              ) : transcripts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" /> No speech segments recorded for this session.
                </div>
              ) : (
                transcripts.map((item) => {
                  const isAgent = item.speaker === 'agent';
                  return (
                    <div 
                      key={item.id} 
                      className={`flex gap-3 max-w-[85%] ${isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                    >
                      <div className={`h-7 w-7 rounded-xl flex items-center justify-center font-bold text-[9px] shrink-0 ${
                        isAgent ? 'bg-slate-100 text-slate-755' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isAgent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                      </div>
                      
                      <div className={`rounded-2xl px-3 py-2 border text-xs leading-relaxed ${
                        isAgent 
                          ? 'bg-slate-50 border-slate-150 text-slate-700' 
                          : 'bg-emerald-50 border-emerald-250 text-emerald-850 font-semibold'
                      }`}>
                        <p>{item.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <Button onClick={() => setIsModalOpen(false)} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl">
                Close View
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
