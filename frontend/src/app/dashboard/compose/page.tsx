'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function ComposePage() {
  const router = useRouter();
  
  // Form state
  const [senders, setSenders] = useState<any[]>([]);
  const [senderId, setSenderId] = useState('');
  
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsInput, setRecipientsInput] = useState('');
  
  const [startAt, setStartAt] = useState('');
  const [delayMs, setDelayMs] = useState(5000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  
  // UI state
  const [loadingSenders, setLoadingSenders] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // CSV state
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  
  // Attachments state
  const [attachments, setAttachments] = useState<{ filename: string, content: string, contentType: string, size: number }[]>([]);

  // Schedule Popup state
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);
  const [tempStartAt, setTempStartAt] = useState('');

  useEffect(() => {
    loadSenders();
  }, []);

  const loadSenders = async () => {
    try {
      const data = await api.get('/senders');
      setSenders(data);
      if (data.length > 0) setSenderId(data[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSenders(false);
    }
  };



  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n');
      
      const valid: string[] = [];
      const invalid: string[] = [];
      
      // Simple email regex for client-side validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      rows.forEach((row, index) => {
        // Assume email might be anywhere or it's a single column CSV
        // For simplicity, let's extract all emails from the row
        const parts = row.split(/[,;]/);
        parts.forEach(part => {
          const clean = part.trim().toLowerCase();
          if (clean) {
            if (emailRegex.test(clean)) {
              valid.push(clean);
            } else if (part.includes('@')) {
              // rough guess it was meant to be an email
              invalid.push(`Row ${index + 1}: ${part.trim()}`);
            }
          }
        });
      });
      
      const uniqueValid = Array.from(new Set(valid));
      setParsedRecipients(uniqueValid);
      setCsvErrors(invalid.slice(0, 5)); // show up to 5 errors
      setCsvErrors(invalid.slice(0, 5)); // show up to 5 errors
      e.target.value = ''; // clear input
    };
    reader.readAsText(file);
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        setError(`File ${file.name} is too large (max 5MB)`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        if (base64String) {
          setAttachments(prev => [...prev, {
            filename: file.name,
            content: base64String,
            contentType: file.type,
            size: file.size
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const setQuickTime = (daysFromNow: number, hour?: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    if (hour !== undefined) {
      d.setHours(hour, 0, 0, 0);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    setTempStartAt(`${y}-${m}-${day}T${h}:${min}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSuccess(false);

    // Combine manual and CSV recipients
    const manualList = recipientsInput.split(/[\n,;]+/).map(r => r.trim().toLowerCase()).filter(Boolean);
    const finalRecipients = Array.from(new Set([...manualList, ...parsedRecipients]));

    if (finalRecipients.length === 0) {
      setError('At least one valid recipient is required.');
      return;
    }

    if (!senderId) {
      setError('A sender is required.');
      return;
    }

    if (delayMs < 0) {
      setError('Delay must be >= 0.');
      return;
    }

    if (hourlyLimit < 1) {
      setError('Hourly limit must be >= 1.');
      return;
    }

    setSubmitting(true);

    try {
      const idempotencyKey = `compose-${Date.now()}-${crypto.randomUUID()}`;
      
      const payload: any = {
        senderId,
        subject,
        body,
        recipients: finalRecipients,
        delayMs: Number(delayMs),
        hourlyLimit: Number(hourlyLimit),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      if (startAt) {
        const parsedDate = new Date(startAt);
        if (isNaN(parsedDate.getTime())) {
          setError('Please enter a valid start time, or leave it empty to start immediately.');
          setSubmitting(false);
          return;
        }
        payload.startAt = parsedDate.toISOString();
      }

      await api.post('/campaigns', payload, {
        'Idempotency-Key': idempotencyKey
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to schedule campaign');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto bg-white min-h-screen">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-4 text-gray-900">
          <button onClick={() => router.back()} className="hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h2 className="text-[22px] font-medium">Compose New Email</h2>
        </div>
        
        <div className="flex items-center gap-4 relative">
          <label className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer relative" title="Attach file">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <input type="file" multiple className="hidden" onChange={handleAttachmentUpload} />
          </label>
          
          <button 
            type="button" 
            onClick={() => {
              setTempStartAt(startAt);
              setShowSchedulePopup(true);
            }}
            className={`text-gray-400 hover:text-gray-600 transition-colors ${startAt ? 'text-[#00A344]' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>

          {showSchedulePopup && (
            <div className="absolute top-12 right-0 w-80 bg-white border border-gray-100 shadow-2xl rounded-xl z-50 p-4">
              <h3 className="font-medium text-gray-900 mb-4">Send Later</h3>
              
              <div className="relative mb-4">
                <input 
                  type="datetime-local" 
                  value={tempStartAt}
                  onChange={e => setTempStartAt(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#00A344] focus:ring-1 focus:ring-[#00A344]"
                />
              </div>

              <div className="space-y-2 mb-6">
                <button type="button" onClick={() => setQuickTime(1)} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-1">Tomorrow</button>
                <button type="button" onClick={() => setQuickTime(1, 10)} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-1">Tomorrow, 10:00 AM</button>
                <button type="button" onClick={() => setQuickTime(1, 11)} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-1">Tomorrow, 11:00 AM</button>
                <button type="button" onClick={() => setQuickTime(1, 15)} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-1">Tomorrow, 3:00 PM</button>
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowSchedulePopup(false)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setStartAt(tempStartAt);
                    setShowSchedulePopup(false);
                  }}
                  className="text-sm font-medium text-[#00A344] border border-[#00A344] rounded-full px-6 py-2 hover:bg-[#EAF5EC] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          <button 
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 bg-white text-[#00A344] border border-[#00A344] rounded-full text-sm font-medium hover:bg-[#EAF5EC] transition-colors disabled:opacity-50 ml-2"
          >
            {submitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {error && (
        <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="m-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <p className="text-sm text-green-700">Campaign scheduled successfully! Redirecting...</p>
        </div>
      )}

      <div className="px-6 py-2">
        {/* From */}
        <div className="flex items-center py-4 border-b border-gray-100">
          <span className="w-24 text-sm font-medium text-gray-900">From</span>
          <select 
            value={senderId}
            onChange={e => setSenderId(e.target.value)}
            className="bg-[#F6F7F9] border-none rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
          >
            {senders.map(s => (
              <option key={s.id} value={s.id}>{s.name ? `${s.name} <${s.email}>` : s.email}</option>
            ))}
          </select>
        </div>

        {/* To */}
        <div className="flex items-center py-4 border-b border-gray-100 relative group">
          <span className="w-24 text-sm font-medium text-gray-900">To</span>
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            {parsedRecipients.map((r, i) => (
              <div key={i} className="px-3 py-1 bg-[#EAF5EC] border border-[#A5D6A7] text-[#00A344] text-xs font-medium rounded-full">
                {r}
              </div>
            ))}
            <input 
              type="text" 
              placeholder={parsedRecipients.length === 0 ? "recipient@example.com (comma separated)" : ""}
              value={recipientsInput}
              onChange={e => setRecipientsInput(e.target.value)}
              className="flex-1 min-w-[200px] border-none bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-[#00A344] text-sm font-medium cursor-pointer hover:text-[#008f3b] transition-colors ml-4">
            <UploadCloud className="w-4 h-4" />
            Upload List
            <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
          </label>
        </div>

        {/* Subject */}
        <div className="flex items-center py-4 border-b border-gray-100">
          <span className="w-24 text-sm font-medium text-gray-900">Subject</span>
          <input 
            type="text" 
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="flex-1 border-none bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            placeholder="Subject"
          />
        </div>

        {/* Settings */}
        <div className="flex items-center py-4 border-b border-gray-100 gap-8">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-900">Delay between 2 emails</span>
            <input 
              type="number" 
              value={delayMs}
              onChange={e => setDelayMs(Number(e.target.value))}
              className="w-20 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-300"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-900">Hourly Limit</span>
            <input 
              type="number" 
              value={hourlyLimit}
              onChange={e => setHourlyLimit(Number(e.target.value))}
              className="w-20 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-300"
            />
          </div>
        </div>

        {/* Attachments Display */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 py-4">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm">
                <span className="text-gray-700 truncate max-w-[200px]">{att.filename}</span>
                <span className="text-gray-400 text-xs">{(att.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => removeAttachment(idx)} className="text-gray-400 hover:text-red-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Body Editor */}
        <div className="mt-6 bg-[#F9FAFB] rounded-xl border border-gray-100 overflow-hidden min-h-[400px] flex flex-col">
          {/* Fake Toolbar */}
          <div className="flex items-center gap-4 p-3 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2 text-gray-400">
              <button className="p-1.5 hover:bg-gray-100 rounded">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
              </button>
              <button className="p-1.5 hover:bg-gray-100 rounded">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 17v-6h-6"/><path d="M3 7a9 9 0 019 9 9 9 0 016-2.3l3 4"/></svg>
              </button>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2 text-gray-600 font-serif">
              <button className="p-1.5 hover:bg-gray-100 rounded font-bold">B</button>
              <button className="p-1.5 hover:bg-gray-100 rounded italic">I</button>
              <button className="p-1.5 hover:bg-gray-100 rounded underline">U</button>
            </div>
          </div>
          
          <textarea 
            value={body}
            onChange={e => setBody(e.target.value)}
            className="flex-1 w-full p-6 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none"
            placeholder="Type Your Reply..."
          />
        </div>
      </div>
    </div>
  );
}
