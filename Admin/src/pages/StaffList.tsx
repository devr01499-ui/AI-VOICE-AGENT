import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Shield, UserPlus, AlertCircle } from 'lucide-react';

export const StaffList: React.FC = () => {
  const { staff } = useAuth();
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('support');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminFetch<{ success: boolean; data: any[] }>('/api/v2/admin/staff');
      if (res.success) setStaffUsers(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setModalError(null);
      await adminFetch('/api/v2/admin/staff/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
        }),
      });
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('support');
      await fetchStaff();
    } catch (err: any) {
      setModalError(err.message || 'Failed to invite staff member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: any) => {
    const isDisabling = user.status !== 'disabled';
    const action = isDisabling ? 'disable' : 'enable';
    if (!confirm(`Are you sure you want to ${action} ${user.name} (${user.email})?`)) return;

    try {
      await adminFetch(`/api/v2/admin/staff/${user.id}/${action}`, { method: 'POST' });
      await fetchStaff();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} staff member`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-white" />
            <span>Staff Governance & RBAC</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage administrative personnel, assign role boundaries, and control console access
          </p>
        </div>

        {staff?.role === 'owner' && (
          <button
            onClick={() => setInviteModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite New Staff</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-white shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Staff Name & Email</th>
                <th className="px-4 py-3.5 font-semibold">Role</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Invited By</th>
                <th className="px-4 py-3.5 font-semibold">Last Login</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-500">
                    <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading staff directory...</span>
                  </td>
                </tr>
              ) : staffUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-500">
                    No staff members found.
                  </td>
                </tr>
              ) : (
                staffUsers.map((u) => {
                  const isSelf = u.id === staff?.id;
                  const isTargetOwner = u.role === 'owner';
                  const isCurrentOwner = staff?.role === 'owner';
                  const canModify = !isSelf && (!isTargetOwner || isCurrentOwner);

                  return (
                    <tr key={u.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 text-white border border-zinc-700 font-mono">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">{u.email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold bg-zinc-900 text-zinc-300 border border-zinc-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold ${
                            u.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : u.status === 'invited'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                        {u.createdBy || 'System'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {canModify ? (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                              u.status === 'disabled'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                            }`}
                          >
                            {u.status === 'disabled' ? 'Re-enable' : 'Disable'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Invite Staff Member</h3>
            <p className="text-xs text-slate-400">
              New staff receive access upon authenticated login with matching email and TOTP MFA setup.
            </p>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4 text-xs">
              <div>
                <label className="block font-mono uppercase text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Sarah Connor"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-mono uppercase text-slate-400 mb-1">Staff Work Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="sarah@claritiy.com"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-mono uppercase text-slate-400 mb-1">Role Boundary</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white capitalize cursor-pointer"
                >
                  <option value="support">Support (Grant cap: 50m, No Deduct)</option>
                  <option value="sales">Sales (Grant cap: 100m, No Deduct)</option>
                  <option value="admin">Admin (Grant cap: 500m, Deduct allowed)</option>
                  <option value="finance">Finance (Payments view, No Grants)</option>
                  <option value="owner">Owner (Full unrestricted root access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
