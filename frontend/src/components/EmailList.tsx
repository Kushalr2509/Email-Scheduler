'use client';

import { Clock, Star } from 'lucide-react';

interface EmailListProps {
  campaigns: any[];
  type: 'scheduled' | 'sent';
}

export default function EmailList({ campaigns, type }: EmailListProps) {
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <p className="text-gray-400 text-sm">
          No {type} emails found.
        </p>
      </div>
    );
  }

  // Flatten the emails from campaigns
  const emails = campaigns.flatMap(c => c.emails.map((e: any) => ({ ...e, campaignSubject: c.subject, campaignBody: c.body })));

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <div className="divide-y divide-gray-100">
        {emails.map((email, i) => {
          const dateValue = type === 'sent' ? email.sentAt : email.scheduledAt;
          
          let dateStr = 'Pending';
          if (dateValue) {
            const d = new Date(dateValue);
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            dateStr = `${days[d.getDay()]} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`;
          }

          const isSent = type === 'sent';

          return (
            <div key={i} className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors group">
              <div className="w-[200px] flex-shrink-0">
                <span className="text-sm font-medium text-gray-900 truncate pr-4 block">To: {email.recipient.split('@')[0]}</span>
              </div>
              
              <div className="w-[180px] flex-shrink-0">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isSent ? 'bg-gray-100 text-gray-600' : 'bg-[#FFF3E0] text-[#E65100]'}`}>
                  {!isSent && <Clock className="w-3 h-3" />}
                  {isSent && <span className="uppercase text-[10px]">Sent</span>}
                  {dateStr}
                </span>
              </div>

              <div className="flex-1 min-w-0 flex items-center pr-4">
                <p className="text-sm text-gray-900 truncate">
                  <span className="font-medium">{email.subject}</span>
                  <span className="text-gray-400 mx-2">-</span>
                  <span className="text-gray-400">...</span>
                </p>
              </div>

              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 text-gray-400 hover:text-yellow-400 transition-colors">
                  <Star className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

