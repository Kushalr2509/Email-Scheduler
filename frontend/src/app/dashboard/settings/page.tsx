'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageSquare, CheckCircle2, AlertCircle, Plus, Mail } from 'lucide-react';
import { api } from '@/lib/api';

function SettingsContent() {
  const searchParams = useSearchParams();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(searchParams.get('error'));
  const [success, setSuccess] = useState<string | null>(searchParams.get('slack_connected') ? 'Slack connected successfully!' : null);

  const [senders, setSenders] = useState<any[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(true);
  
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [addingSender, setAddingSender] = useState(false);

  useEffect(() => {
    checkStatus();
    loadSenders();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/slack/status');
      setIsConnected(res.isConnected);
    } catch (err: any) {
      setError(err.message || 'Failed to check Slack status');
    } finally {
      setLoading(false);
    }
  };

  const loadSenders = async () => {
    try {
      setLoadingSenders(true);
      const data = await api.get('/senders');
      setSenders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load senders');
    } finally {
      setLoadingSenders(false);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await api.get('/slack/connect');
      window.location.href = res.url;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Slack connection');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/slack/disconnect', {});
      setIsConnected(false);
      setSuccess('Slack disconnected successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Slack');
    }
  };

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail) return;
    
    setAddingSender(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: any = { email: newSenderEmail };
      
      await api.post('/senders', payload);
      setSuccess('Sender added successfully');
      setShowAddSender(false);
      setNewSenderEmail('');
      loadSenders();
    } catch (err: any) {
      setError(err.message || 'Failed to add sender');
    } finally {
      setAddingSender(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto bg-white min-h-screen">
      <div className="px-6 py-6 border-b border-gray-100">
        <h2 className="text-[22px] font-medium text-gray-900">Settings</h2>
      </div>

      <div className="p-6 space-y-6 max-w-3xl">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Slack Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-500" />
            Slack Integration
          </h3>
          
          {loading ? (
            <div className="text-sm text-gray-500">Loading status...</div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {isConnected ? 'Slack Connected' : 'Disconnected'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Receive notifications when email sending is rate limited.
                </p>
              </div>
              
              {isConnected ? (
                <button 
                  onClick={handleDisconnect}
                  className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-red-200"
                >
                  Disconnect
                </button>
              ) : (
                <button 
                  onClick={handleConnect}
                  className="bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Connect Slack
                </button>
              )}
            </div>
          )}
        </div>

        {/* Senders Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-500" />
              Email Senders
            </h3>
            <button 
              onClick={() => setShowAddSender(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#00A344] hover:text-[#008f3b]"
            >
              <Plus className="w-4 h-4" />
              Add Sender
            </button>
          </div>

          {loadingSenders ? (
            <div className="text-sm text-gray-500">Loading senders...</div>
          ) : senders.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              No senders found. Add one to start composing emails.
            </div>
          ) : (
            <div className="space-y-3">
              {senders.map((sender) => (
                <div key={sender.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sender.name || sender.email}</p>
                    {sender.name && <p className="text-xs text-gray-500">{sender.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddSender && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Add New Sender</h4>
              <form onSubmit={handleAddSender} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={newSenderEmail}
                    onChange={e => setNewSenderEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#00A344] focus:ring-1 focus:ring-[#00A344]"
                    placeholder="hello@example.com"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => { setShowAddSender(false); setNewSenderEmail(''); }}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={addingSender}
                    className="px-3 py-1.5 bg-[#00A344] text-white rounded-lg text-sm font-medium hover:bg-[#008f3b] transition-colors disabled:opacity-50"
                  >
                    {addingSender ? 'Adding...' : 'Add Sender'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
