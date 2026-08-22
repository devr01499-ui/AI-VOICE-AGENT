import { useState, useEffect } from 'react';
import { PhoneCall, PhoneIncoming, PhoneOutgoing, Bot, CheckCircle2, AlertCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api';

interface CallingNumberConfig {
  id: string;
  phoneNumber: string;
  status: string;
  kycStatus: string;
  assignedAgentId: string | null;
  outboundAgentName: string;
  inboundEnabled: boolean;
  inboundAgentId: string | null;
  inboundAgentName: string;
  businessHours: string;
  outsideHoursAction: string;
}

interface AgentOption {
  id: string;
  name: string;
  status: string;
}

export function DashCallingConfig() {
  const [numbers, setNumbers] = useState<CallingNumberConfig[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [numRes, agRes] = await Promise.all([
        apiClient.get('/api/v2/numbers/calling-config'),
        apiClient.get('/api/v2/agents')
      ]);

      if (numRes.data?.data) {
        setNumbers(numRes.data.data);
      }
      if (agRes.data?.data) {
        setAgents(agRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load calling configuration', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdate = async (numberId: string, updates: {
    assignedAgentId?: string;
    inboundAgentId?: string;
    inboundEnabled?: boolean;
    businessHours?: string;
  }) => {
    setSavingId(numberId);
    try {
      const res = await apiClient.post(`/api/v2/numbers/${numberId}/calling-config`, updates);
      if (res.data?.success) {
        setSuccessMsg('Calling configuration updated successfully!');
        setTimeout(() => setSuccessMsg(null), 3000);
        // Refresh local state
        await loadData();
      }
    } catch (err) {
      alert('Failed to update calling configuration: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500" style={{ fontFamily: "'Outfit', sans-serif" }}>Loading Calling Configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5" style={{ fontFamily: "'Clash Display', 'Outfit', sans-serif" }}>
            <PhoneCall className="w-6 h-6 text-emerald-600" />
            Calling Configuration
          </h1>
          <p className="text-sm text-slate-500 mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Manage outbound caller IDs and inbound AI agent routing in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Vobiz High-Precision Pipeline Active
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {numbers.length === 0 ? (
        <div className="nm-pressed rounded-3xl p-12 text-center text-slate-500 space-y-4 max-w-2xl mx-auto my-8">
          <PhoneCall className="w-12 h-12 mx-auto text-slate-400 opacity-40" />
          <h3 className="text-lg font-bold text-slate-800" style={{ fontFamily: "'Clash Display', sans-serif" }}>No Phone Numbers Provisioned</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto" style={{ fontFamily: "'Outfit', sans-serif" }}>
            You haven't claimed or purchased any phone numbers yet. Visit the Phone Numbers tab to claim your bundled number.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {numbers.map((item) => {
            const isSaving = savingId === item.id;

            return (
              <div key={item.id} className="nm-raised rounded-3xl p-6 border border-slate-200/70 shadow-sm transition-all hover:shadow-md space-y-6">
                {/* Number Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-lg">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">{item.phoneNumber}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        <span>Dedicated Voice Channel</span>
                        <span>•</span>
                        <span className="capitalize font-semibold text-slate-700">KYC Verified</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${item.inboundEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      <span className={`w-2 h-2 rounded-full ${item.inboundEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                      {item.inboundEnabled ? 'Inbound: Active' : 'Inbound: Disabled'}
                    </div>
                  </div>
                </div>

                {/* Grid: Outbound & Inbound Configurations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Outbound Config Card */}
                  <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PhoneOutgoing className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider" style={{ fontFamily: "'Outfit', sans-serif" }}>Outbound Settings</h4>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">Active</span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 block" style={{ fontFamily: "'Outfit', sans-serif" }}>Default Outbound Agent</label>
                      <select
                        value={item.assignedAgentId || ''}
                        onChange={(e) => handleUpdate(item.id, { assignedAgentId: e.target.value })}
                        disabled={isSaving}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      >
                        <option value="">None (Unassigned)</option>
                        {agents.map((ag) => (
                          <option key={ag.id} value={ag.id}>{ag.name}</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        This agent will be pre-selected when initiating single or batch calls from this caller ID.
                      </p>
                    </div>
                  </div>

                  {/* Inbound Config Card */}
                  <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PhoneIncoming className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider" style={{ fontFamily: "'Outfit', sans-serif" }}>Inbound Settings</h4>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.inboundEnabled}
                          onChange={(e) => handleUpdate(item.id, { inboundEnabled: e.target.checked })}
                          disabled={isSaving}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 block" style={{ fontFamily: "'Outfit', sans-serif" }}>Answering AI Agent</label>
                      <select
                        value={item.inboundAgentId || ''}
                        onChange={(e) => handleUpdate(item.id, { inboundAgentId: e.target.value })}
                        disabled={isSaving || !item.inboundEnabled}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      >
                        <option value="">Select AI Agent</option>
                        {agents.map((ag) => (
                          <option key={ag.id} value={ag.id}>{ag.name}</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Inbound callers dialing {item.phoneNumber} will be answered live by this AI agent.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Preferences Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    24/7 Real-Time Availability Active
                  </span>
                  <span>Instant Vobiz Answer URL Sync</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
