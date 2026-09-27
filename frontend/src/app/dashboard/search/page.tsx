'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Search, AlertCircle } from 'lucide-react';
import EmailRow from '@/components/EmailRow';

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(q)}`)
      .then(setResults)
      .catch((err) => {
        setError(err.message || 'Search failed');
      })
      .finally(() => setLoading(false));
  }, [q]);

  if (loading) {
    return <div className="text-white/50 text-sm">Searching...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <p className="text-sm text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-white flex items-center gap-2">
        <Search className="w-5 h-5 text-blue-500" />
        Search Results for "{q}"
      </h2>

      {results.length === 0 ? (
        <div className="bg-[#1C1C1C] border border-white/5 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <p className="text-[#888888] text-sm">No emails found matching your query.</p>
        </div>
      ) : (
        <div className="bg-[#1C1C1C] border border-white/5 rounded-xl overflow-hidden shadow-xl divide-y divide-white/5 p-2">
          {results.map((email: any) => (
            <EmailRow key={email.id} email={email} type="scheduled" />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <Suspense fallback={<div className="text-white/50 text-sm">Loading search...</div>}>
        <SearchContent />
      </Suspense>
    </div>
  );
}
