import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, Filter, User, ArrowUpRight, ArrowDownLeft, ChevronRight, X, Clock, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api';

interface ChatMessage {
  id: string;
  userId: string;
  agentId?: string;
  callId?: string;
  phoneNumber: string;
  direction: 'inbound' | 'outbound' | string;
  body: string;
  status: string;
  createdAt: string;
  agent?: {
    id: string;
    name: string;
  };
}

export function DashChatHistory() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [activeMessage, setActiveMessage] = useState<ChatMessage | null>(null);

  const fetchChatHistory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/v2/chat-history');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setMessages(res.data.data);
      }
    } catch {
      // Fallback empty list
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatHistory();
  }, []);

  const filteredMessages = messages.filter((m) => {
    const matchesSearch =
      m.phoneNumber.toLowerCase().includes(search.toLowerCase()) ||
      m.body.toLowerCase().includes(search.toLowerCase()) ||
      (m.agent?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesAgent = selectedAgent === 'all' || m.agentId === selectedAgent;
    return matchesSearch && matchesAgent;
  });

  const uniqueAgents = Array.from(
    new Map(
      messages
        .filter((m) => m.agent)
        .map((m) => [m.agent!.id, m.agent!])
    ).values()
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by phone, message, or agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>

          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="all">All Agents</option>
            {uniqueAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchChatHistory}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading text message logs...</div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">No Chat History Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              SMS messages and text-based conversations sent during automated voice calls will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Message Preview</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredMessages.map((msg) => (
                  <tr
                    key={msg.id}
                    onClick={() => setActiveMessage(msg)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {msg.phoneNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          msg.direction === 'inbound'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {msg.direction === 'inbound' ? (
                          <ArrowDownLeft className="w-3 h-3" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3" />
                        )}
                        {msg.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {msg.agent?.name || 'System Assistant'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {msg.body}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-mono">
                        {msg.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(msg.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMessage(msg);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail View Drawer */}
      {activeMessage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md h-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" /> Message Thread Details
                </h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{activeMessage.phoneNumber}</p>
              </div>
              <button
                onClick={() => setActiveMessage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Agent: <strong className="text-slate-800 dark:text-slate-200">{activeMessage.agent?.name || 'System Assistant'}</strong></span>
                  <span className="font-mono">{new Date(activeMessage.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Direction: <strong className="uppercase">{activeMessage.direction}</strong></span>
                  <span>Status: <strong className="uppercase font-mono">{activeMessage.status}</strong></span>
                </div>
              </div>

              <div>
                <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Message Content
                </span>
                <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs">
                  {activeMessage.body}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
