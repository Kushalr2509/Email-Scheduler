'use client';

import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface EmailRowProps {
  email: any;
  type: 'scheduled' | 'sent';
}

export default function EmailRow({ email, type }: EmailRowProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'SCHEDULED':
      case 'QUEUED':
      case 'RETRY_WAIT':
        return <Clock className="w-3.5 h-3.5 text-blue-500" />;
      case 'FAILED': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'PROCESSING': return <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />;
      default: return <Clock className="w-3.5 h-3.5 text-[#888888]" />;
    }
  };

  const dateValue = type === 'sent' ? email.sentAt : email.scheduledAt;
  const dateStr = dateValue ? new Date(dateValue).toLocaleString() : 'Pending';

  return (
    <div className="flex items-center justify-between text-sm py-1.5 group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {getStatusIcon(email.status)}
        <span className="text-[#888888] truncate flex-1">{email.recipient}</span>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <span className="text-xs font-mono text-white/30 capitalize px-2 py-0.5 rounded bg-white/5 border border-white/5">
          {email.status.toLowerCase()}
        </span>
        <span className="text-xs text-[#555555] w-32 text-right truncate">
          {dateStr}
        </span>
      </div>
    </div>
  );
}
