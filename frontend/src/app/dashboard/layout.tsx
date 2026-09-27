'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Search, Filter, RefreshCw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    api.get('/auth/me')
      .then(setUser)
      .catch(() => {
        router.push('/');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white text-gray-900 overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 flex flex-col h-full bg-white relative">
        <header className="h-20 flex items-center px-8 border-b border-gray-100">
          <div className="flex items-center gap-4 flex-1">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery)}`);
                }
              }}
              className="w-full max-w-2xl relative"
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-2.5 border-none rounded-lg bg-[#F6F7F9] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-200 text-sm transition-colors"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <button className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <button className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-white">
          {children}
        </div>
      </main>
    </div>
  );
}
