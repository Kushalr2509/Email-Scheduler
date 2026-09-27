'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import EmailList from '@/components/EmailList';

export default function SentPage() {
  const [sent, setSent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/campaigns/sent')
      .then((data) => setSent(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-sm p-6">Loading sent emails...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pt-4">
      <EmailList campaigns={sent} type="sent" />
    </div>
  );
}
