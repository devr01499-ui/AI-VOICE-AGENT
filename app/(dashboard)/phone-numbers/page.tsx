'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Phone,
  Plus,
  Search,
  Edit2,
  Trash2,
  MoreHorizontal,
  HelpCircle,
  ChevronDown,
  Info,
  CheckCircle,
  ArrowRight,
  MessageSquare,
  Globe,
  Settings,
  X,
  PhoneCall,
  Loader2,
} from 'lucide-react';
import TestCallDialog from '@/components/TestCallDialog';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  agentType: string;
  status: string;
}

interface PhoneNumberConfig {
  id: string;
  number: string;
  nickname: string;
  provider: string;
  inboundAgentId: string;
  inboundABTesting: boolean;
  addCallback: boolean;
  allowedInboundCountries: string;
  fallbackNumber: string;
  outboundAgentId: string;
  outboundABTesting: boolean;
  allowedOutboundCountries: string;
  terminationUri: string;
  sipUsername?: string;
  sipPassword?: string;
  outboundTransport: 'TCP' | 'UDP' | 'TLS';
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function PhoneNumbersPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Phone numbers local database state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberConfig[]>([
    {
      id: 'num-1',
      number: '+911171366824',
      nickname: 'demo product',
      provider: 'Custom telephony',
      inboundAgentId: 'none',
      inboundABTesting: false,
      addCallback: false,
      allowedInboundCountries: 'all',
      fallbackNumber: '+11234567890',
      outboundAgentId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', // default seeded agent
      outboundABTesting: false,
      allowedOutboundCountries: 'all',
      terminationUri: 'sip.vobiz.ai',
      outboundTransport: 'TCP',
    }
  ]);

  const [selectedNumberId, setSelectedNumberId] = useState<string>('num-1');
  
  // Modal states
  const [isSipModalOpen, setIsSipModalOpen] = useState<boolean>(false);
  const [isTestCallOpen, setIsTestCallOpen] = useState<boolean>(false);
  const [isEditingNickname, setIsEditingNickname] = useState<boolean>(false);
  
  // SIP Form states
  const [sipNumber, setSipNumber] = useState<string>('');
  const [sipTerminationUri, setSipTerminationUri] = useState<string>('');
  const [sipUsername, setSipUsername] = useState<string>('');
  const [sipPassword, setSipPassword] = useState<string>('');
  const [sipNickname, setSipNickname] = useState<string>('');
  const [sipTransport, setSipTransport] = useState<'TCP' | 'UDP' | 'TLS'>('TCP');

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoadingAgents(true);
      const res = await fetch(`${API_BASE_URL}/api/v2/agents`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAgents(json.data);
        }
      }
    } catch (err) {
      console.error('Error loading agents in numbers page:', err);
    } finally {
      setLoadingAgents(false);
    }
  };

  const getSelectedNumber = () => {
    return phoneNumbers.find(n => n.id === selectedNumberId) || phoneNumbers[0];
  };

  const handleUpdateSelectedNumberField = (field: keyof PhoneNumberConfig, value: unknown) => {
    setPhoneNumbers(prev => prev.map(num => {
      if (num.id === selectedNumberId) {
        return { ...num, [field]: value };
      }
      return num;
    }));
  };

  const handleAddSipNumber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sipNumber) return;

    const newNum: PhoneNumberConfig = {
      id: `num-${Date.now()}`,
      number: sipNumber,
      nickname: sipNickname || 'Unnamed Number',
      provider: 'Custom telephony',
      inboundAgentId: 'none',
      inboundABTesting: false,
      addCallback: false,
      allowedInboundCountries: 'all',
      fallbackNumber: '+11234567890',
      outboundAgentId: agents[0]?.id || 'none',
      outboundABTesting: false,
      allowedOutboundCountries: 'all',
      terminationUri: sipTerminationUri || 'sip.vobiz.ai',
      sipUsername: sipUsername || undefined,
      sipPassword: sipPassword || undefined,
      outboundTransport: sipTransport,
    };

    setPhoneNumbers(prev => [...prev, newNum]);
    setSelectedNumberId(newNum.id);
    setIsSipModalOpen(false);

    // Reset fields
    setSipNumber('');
    setSipTerminationUri('');
    setSipUsername('');
    setSipPassword('');
    setSipNickname('');
    setSipTransport('TCP');
  };

  const handleDeleteNumber = (id: string) => {
    if (phoneNumbers.length <= 1) return;
    setPhoneNumbers(prev => prev.filter(n => n.id !== id));
    if (selectedNumberId === id) {
      const remaining = phoneNumbers.filter(n => n.id !== id);
      setSelectedNumberId(remaining[0].id);
    }
  };

  const filteredNumbers = phoneNumbers.filter(
    n => n.number.includes(searchQuery) || n.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedNumber = getSelectedNumber();

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-10rem)]">
      
      {/* 1. LEFT SIDEBAR PANEL (Numbers List) */}
      <div className="w-full lg:w-80 shrink-0 border border-slate-800 bg-slate-900/20 rounded-xl p-4 flex flex-col space-y-4 backdrop-blur-sm">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white tracking-wider uppercase">Phone Numbers</h2>
          <Button
            onClick={() => setIsSipModalOpen(true)}
            size="icon"
            className="h-8 w-8 bg-slate-850 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Input
            placeholder="Search phone numbers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-950/60 border-slate-800 text-white placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Search className="h-4 w-4" />
          </div>
        </div>

        {/* Numbers List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[300px] lg:max-h-none">
          {filteredNumbers.map((num) => {
            const isSelected = num.id === selectedNumberId;
            return (
              <div
                key={num.id}
                onClick={() => setSelectedNumberId(num.id)}
                className={`group flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-slate-900 border-slate-700/80 text-white'
                    : 'border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">
                    {num.nickname}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {num.number}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNumber(num.id);
                    }}
                    disabled={phoneNumbers.length <= 1}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-950 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. RIGHT CONFIGURATION PANEL (Selected Number Details) */}
      <div className="flex-1 bg-slate-900/10 border border-slate-800 rounded-xl p-6 flex flex-col space-y-6 backdrop-blur-sm">
        
        {/* Detail Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isEditingNickname ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={selectedNumber.nickname}
                    onChange={(e) => handleUpdateSelectedNumberField('nickname', e.target.value)}
                    onBlur={() => setIsEditingNickname(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingNickname(false); }}
                    className="bg-slate-950 border-slate-800 h-8 text-sm font-semibold max-w-[200px]"
                    autoFocus
                  />
                  <Button size="sm" onClick={() => setIsEditingNickname(false)}>Save</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white">{selectedNumber.nickname}</h1>
                  <button 
                    onClick={() => setIsEditingNickname(true)}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400">
              ID: <span className="font-mono text-slate-300">{selectedNumber.number}</span> | Provider: <span className="text-slate-300">{selectedNumber.provider}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsTestCallOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-white"
            >
              <Phone className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              Make an outbound call
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 bg-slate-950 border-slate-850 text-slate-500 hover:text-white"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Form Sections */}
        <div className="grid grid-cols-1 gap-6">

          {/* INBOUND CALL AGENT CARD */}
          <Card className="border-slate-800/80 bg-slate-900/30">
            <CardHeader className="pb-3 border-b border-slate-800/40">
              <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Inbound Call Agent</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              {/* Row 1: Dropdown & AB Testing */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="w-full sm:max-w-xs space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Call Agent</label>
                  <select
                    value={selectedNumber.inboundAgentId}
                    onChange={(e) => handleUpdateSelectedNumberField('inboundAgentId', e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 text-xs text-white px-3 py-2.5 outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="none">None (disable inbound)</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>

                {/* A/B Testing Switch */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">A/B Testing</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedNumber.inboundABTesting}
                      onChange={(e) => handleUpdateSelectedNumberField('inboundABTesting', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                  </label>
                </div>
              </div>

              {/* Callback Checkbox */}
              <div className="flex items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  id="callback-checkbox"
                  checked={selectedNumber.addCallback}
                  onChange={(e) => handleUpdateSelectedNumberField('addCallback', e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-0 cursor-pointer h-4 w-4"
                />
                <label htmlFor="callback-checkbox" className="text-xs text-slate-300 cursor-pointer">
                  Add an inbound callback to this number
                </label>
              </div>

              {/* Allowed Countries & Fallback Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    Allowed Inbound Countries <Globe className="h-3 w-3" />
                  </label>
                  <select
                    value={selectedNumber.allowedInboundCountries}
                    onChange={(e) => handleUpdateSelectedNumberField('allowedInboundCountries', e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 text-xs text-white px-3 py-2.5 outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="all">All countries allowed</option>
                    <option value="in">India only (+91)</option>
                    <option value="us">United States only (+1)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Fallback Number (when inbound call fails)
                  </label>
                  <Input
                    placeholder="+11234567890"
                    value={selectedNumber.fallbackNumber}
                    onChange={(e) => handleUpdateSelectedNumberField('fallbackNumber', e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs h-9.5"
                  />
                  <p className="text-[9px] text-slate-500">When inbound call fails, the call will forward to this number. (Learn more)</p>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* OUTBOUND CALL AGENT CARD */}
          <Card className="border-slate-800/80 bg-slate-900/30">
            <CardHeader className="pb-3 border-b border-slate-800/40">
              <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">Outbound Call Agent</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              {/* Row 1: Dropdown & AB Testing */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="w-full sm:max-w-xs space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Call Agent</label>
                  <select
                    value={selectedNumber.outboundAgentId}
                    onChange={(e) => handleUpdateSelectedNumberField('outboundAgentId', e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 text-xs text-white px-3 py-2.5 outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="none">None (disable outbound)</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>

                {/* A/B Testing Switch */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">A/B Testing</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedNumber.outboundABTesting}
                      onChange={(e) => handleUpdateSelectedNumberField('outboundABTesting', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                  </label>
                </div>
              </div>

              {/* Outbound Countries */}
              <div className="w-full sm:max-w-xs space-y-1.5 pt-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  Allowed Outbound Countries <Globe className="h-3 w-3" />
                </label>
                <select
                  value={selectedNumber.allowedOutboundCountries}
                  onChange={(e) => handleUpdateSelectedNumberField('allowedOutboundCountries', e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 text-xs text-white px-3 py-2.5 outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="all">All countries allowed</option>
                  <option value="in">India only (+91)</option>
                  <option value="us">United States only (+1)</option>
                </select>
              </div>

            </CardContent>
          </Card>

          {/* ADVANCED ADD-ONS (SMS) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Advanced Add-Ons</h3>
            <Card className="border-slate-800/80 bg-slate-900/20 hover:border-slate-700 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-950/40 border border-blue-900/30 flex items-center justify-center text-blue-400">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">SMS</h4>
                    <p className="text-[10px] text-slate-400">The ability to send SMS</p>
                  </div>
                </div>
                <Button variant="link" className="text-xs text-blue-400 hover:text-blue-300 p-0 h-auto font-semibold flex items-center gap-1">
                  Setup SMS Function <ArrowRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* 3. MODAL OVERLAY ("Connect to your number via SIP trunking") */}
      {isSipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsSipModalOpen(false)} />
          
          <div className="relative w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl overflow-hidden transform transition-all space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Connect to your number via SIP trunking</h3>
              <button 
                onClick={() => setIsSipModalOpen(false)}
                className="text-slate-400 hover:text-white rounded p-1 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSipNumber} className="space-y-4">
              
              {/* Phone Number */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                  <span className="text-[9px] text-slate-500 flex items-center gap-0.5 cursor-pointer hover:text-slate-300">
                    Format to E.164 <ChevronDown className="h-2.5 w-2.5" />
                  </span>
                </div>
                <Input
                  type="text"
                  placeholder="Enter phone number"
                  value={sipNumber}
                  onChange={(e) => setSipNumber(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-xs text-white"
                  required
                />
              </div>

              {/* Termination URI */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Termination URI</label>
                <Input
                  type="text"
                  placeholder="Enter termination URI (NOT Retell SIP server uri)"
                  value={sipTerminationUri}
                  onChange={(e) => setSipTerminationUri(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-xs text-white"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SIP Trunk User Name <span className="text-slate-500 font-normal">(Optional)</span></label>
                <Input
                  type="text"
                  placeholder="Enter SIP Trunk User Name"
                  value={sipUsername}
                  onChange={(e) => setSipUsername(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-xs text-white"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SIP Trunk Password <span className="text-slate-500 font-normal">(Optional)</span></label>
                <Input
                  type="password"
                  placeholder="Enter SIP Trunk Password"
                  value={sipPassword}
                  onChange={(e) => setSipPassword(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-xs text-white"
                />
              </div>

              {/* Nickname */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nickname <span className="text-slate-500 font-normal">(Optional)</span></label>
                <Input
                  type="text"
                  placeholder="Enter Nickname"
                  value={sipNickname}
                  onChange={(e) => setSipNickname(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-xs text-white"
                />
              </div>

              {/* Outbound Transport & Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800">
                <div className="relative">
                  <select
                    value={sipTransport}
                    onChange={(e) => setSipTransport(e.target.value as any)}
                    className="rounded-lg border border-slate-800 bg-slate-900 text-[11px] text-white pl-3 pr-7 py-2 outline-none appearance-none cursor-pointer"
                  >
                    <option value="TCP">Outbound Transport: TCP</option>
                    <option value="UDP">Outbound Transport: UDP</option>
                    <option value="TLS">Outbound Transport: TLS</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 border-l border-r border-t border-slate-500 border-l-transparent border-r-transparent w-0 h-0 border-t-3" />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setIsSipModalOpen(false)}
                    variant="outline"
                    className="text-xs bg-transparent border-slate-800 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Save
                  </Button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 4. Mapped Outbound Test Call Flow */}
      <TestCallDialog
        isOpen={isTestCallOpen}
        onClose={() => setIsTestCallOpen(false)}
      />

    </div>
  );
}
