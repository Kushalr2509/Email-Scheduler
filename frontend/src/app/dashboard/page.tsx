'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import EmailList from '@/components/EmailList';

export default function ScheduledPage() {
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/campaigns/scheduled')
      .then((data) => setScheduled(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-sm p-6">Loading scheduled emails...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pt-4">
      <EmailList campaigns={scheduled} type="scheduled" />
    </div>
  );
}
