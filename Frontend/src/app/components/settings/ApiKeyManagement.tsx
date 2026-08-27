import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, RefreshCw, Trash2, Plus } from 'lucide-react';
import { apiClient } from '../../api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function ApiKeyManagement() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyData, setNewKeyData] = useState<{ name: string; key: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await apiClient.get('/api/v2/apikeys');
      if (res.data?.success) {
        setKeys(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch API keys', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await apiClient.post('/api/v2/apikeys', { name: newKeyName || 'Default API Key' });
      if (res.data?.success) {
        setNewKeyData(res.data.data);
        setNewKeyName('');
        await fetchKeys();
      } else {
        alert((res.data as any)?.error || 'Failed to generate API key');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to generate API key');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone and any integrations using it will immediately break.')) return;
    
    try {
      const res = await apiClient.delete(`/api/v2/apikeys/${id}`);
      if (res.data?.success) {
        setKeys(keys.filter(k => k.id !== id));
      } else {
        alert((res.data as any)?.error || 'Failed to revoke API key');
      }

    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return <div className="p-6 text-sm">Loading API keys...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="nm-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-[var(--nm-text)]" style={{fontFamily:"'Figtree',sans-serif"}}>Active API Keys</p>
          <div className="flex gap-2 items-center">
            <input 
              type="text" 
              placeholder="Key Name (optional)" 
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="nm-input px-3 py-1.5 text-sm"
              style={{fontFamily:"'Figtree',sans-serif"}}
            />
            <button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="flex items-center gap-2 px-3 py-1.5 nm-raised hover:nm-pressed rounded-lg text-sm font-bold transition-all"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
              Generate New Key
            </button>
          </div>
        </div>

        {newKeyData && (
          <div className="p-4 bg-[var(--nm-success)]/10 border border-[var(--nm-success)] rounded-xl space-y-3">
            <p className="text-sm font-bold text-[var(--nm-success)]">Successfully generated new API Key!</p>
            <p className="text-xs text-[var(--nm-text)]">Please copy this key and store it securely. You will not be able to see it again.</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 nm-pressed bg-white/50 rounded-xl px-4 py-3 text-sm font-bold text-[var(--nm-text)] overflow-x-auto" style={{fontFamily:"'DM Mono',monospace"}}>
                {newKeyData.key}
              </div>
              <button onClick={() => copyToClipboard(newKeyData.key)} className="p-3 nm-raised rounded-xl hover:nm-pressed transition-all">
                <Copy className="w-5 h-5"/>
              </button>
            </div>
            <button onClick={() => setNewKeyData(null)} className="text-xs underline text-gray-500 mt-2 block">I have stored it securely</button>
          </div>
        )}

        {keys.length === 0 && !newKeyData && (
          <p className="text-sm text-gray-500 italic">No active API keys found. Generate one to integrate with external tools.</p>
        )}

        {keys.map(k => (
          <div key={k.id} className="space-y-3 p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-[var(--nm-text)]">{k.name}</span>
                <p className="text-xs text-gray-400 mt-1">Created: {new Date(k.createdAt).toLocaleDateString()}</p>
                {k.lastUsedAt && <p className="text-xs text-gray-400">Last Used: {new Date(k.lastUsedAt).toLocaleString()}</p>}
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-[var(--nm-success)]/20 text-[var(--nm-success)] rounded uppercase">Active</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 nm-pressed rounded-xl px-4 py-3 text-sm font-bold text-gray-400 overflow-hidden" style={{fontFamily:"'DM Mono',monospace"}}>
                {k.keyPrefix}••••••••••••••••••••••••••••
              </div>
              <button onClick={() => handleRevoke(k.id)} className="p-3 nm-raised rounded-xl hover:nm-pressed text-red-500 transition-all group" title="Revoke Key">
                <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform"/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
