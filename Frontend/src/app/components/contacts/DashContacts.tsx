import React, { useState, useEffect } from 'react';
import { Search, Plus, User, Phone, Tag, Calendar, Edit3, Trash2, ChevronRight, X, Check, PhoneIncoming, MessageSquare, RefreshCw } from 'lucide-react';
import { apiClient, fetchCalls, type ApiCall } from '../../api';

interface Contact {
  id: string;
  userId: string;
  phoneNumber: string;
  name?: string;
  tags?: string; // JSON string
  notes?: string;
  lastContactedAt?: string;
  createdAt: string;
}

export function DashContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Contact Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    phoneNumber: '',
    name: '',
    tags: '',
    notes: '',
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Contact Detail Drawer State
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [contactCalls, setContactCalls] = useState<ApiCall[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);

  const fetchContactsList = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/v2/contacts');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setContacts(res.data.data);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactsList();
  }, []);

  useEffect(() => {
    if (activeContact) {
      setLoadingCalls(true);
      fetchCalls({ limit: 50 })
        .then((allCalls) => {
          const filtered = allCalls.filter(
            (c) =>
              c.recipientPhoneNumber.includes(activeContact.phoneNumber) ||
              (c.fromPhoneNumber && c.fromPhoneNumber.includes(activeContact.phoneNumber))
          );
          setContactCalls(filtered);
        })
        .catch(() => setContactCalls([]))
        .finally(() => setLoadingCalls(false));
    }
  }, [activeContact]);

  const openAddModal = () => {
    setEditingContact(null);
    setFormData({ phoneNumber: '', name: '', tags: '', notes: '' });
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    let parsedTags = '';
    try {
      const arr = JSON.parse(contact.tags || '[]');
      if (Array.isArray(arr)) parsedTags = arr.join(', ');
    } catch {
      parsedTags = contact.tags || '';
    }
    setFormData({
      phoneNumber: contact.phoneNumber,
      name: contact.name || '',
      tags: parsedTags,
      notes: contact.notes || '',
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveContact = async () => {
    if (!formData.phoneNumber.trim()) {
      setModalError('Phone number is required');
      return;
    }

    try {
      setSubmitting(true);
      const tagArray = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload = {
        phoneNumber: formData.phoneNumber.trim(),
        name: formData.name.trim() || undefined,
        tags: tagArray,
        notes: formData.notes.trim() || undefined,
      };

      if (editingContact) {
        await apiClient.put(`/api/v2/contacts/${editingContact.id}`, payload);
      } else {
        await apiClient.post('/api/v2/contacts', payload);
      }

      setIsModalOpen(false);
      fetchContactsList();
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Failed to save contact');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await apiClient.delete(`/api/v2/contacts/${id}`);
      if (activeContact?.id === id) setActiveContact(null);
      fetchContactsList();
    } catch {
      alert('Failed to delete contact');
    }
  };

  const parseTagArray = (tagsJson?: string): string[] => {
    if (!tagsJson) return [];
    try {
      const parsed = JSON.parse(tagsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return tagsJson.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    }
  };

  const allTags = Array.from(
    new Set(contacts.flatMap((c) => parseTagArray(c.tags)))
  );

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.phoneNumber.toLowerCase().includes(search.toLowerCase()) ||
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.notes || '').toLowerCase().includes(search.toLowerCase());
    const tags = parseTagArray(c.tags);
    const matchesTag = selectedTag === 'all' || tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Search bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search contacts by name, number, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>

          {allTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="all">All Tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchContactsList}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading contacts directory...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <User className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">No Contacts Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Contacts are automatically populated when calls occur, or you can add them manually.
            </p>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add First Contact
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4">Contact Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4">Last Contacted</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredContacts.map((c) => {
                  const tags = parseTagArray(c.tags);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setActiveContact(c)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                          {(c.name || c.phoneNumber).charAt(0).toUpperCase()}
                        </div>
                        {c.name || <span className="text-slate-400 italic font-normal">Unnamed Contact</span>}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {c.phoneNumber}
                      </td>
                      <td className="py-3 px-4">
                        {tags.length === 0 ? (
                          <span className="text-slate-400 italic text-[10px]">No tags</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md text-[10px] font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {c.lastContactedAt ? new Date(c.lastContactedAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{c.notes || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="Edit Contact"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(c.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Delete Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setActiveContact(c)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="View History"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name / Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe, Acme Corp Sales"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="VIP, Lead, Inbound"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Context, preferences, or account notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContact}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> {submitting ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Call History Drawer */}
      {activeContact && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg h-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" /> {activeContact.name || 'Unnamed Contact'}
                </h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{activeContact.phoneNumber}</p>
              </div>
              <button
                onClick={() => setActiveContact(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Last Contacted:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {activeContact.lastContactedAt ? new Date(activeContact.lastContactedAt).toLocaleString() : 'Never'}
                  </span>
                </div>
                {activeContact.notes && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    <span className="font-semibold block mb-0.5 text-slate-500">Notes:</span>
                    <p>{activeContact.notes}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                  <PhoneIncoming className="w-4 h-4 text-indigo-600" /> Call History ({contactCalls.length})
                </h4>

                {loadingCalls ? (
                  <div className="p-8 text-center text-slate-400">Loading call history...</div>
                ) : contactCalls.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl text-slate-400 italic">
                    No recorded calls found for this contact number.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contactCalls.map((call) => (
                      <div
                        key={call.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span>Status: {call.status}</span>
                            <span className="px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded text-[9px] uppercase">
                              {call.callDirection}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(call.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {call.durationSeconds && (
                          <span className="font-mono text-slate-500 text-[11px]">{call.durationSeconds}s</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
