'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail, Clock, Send, LogOut, ChevronDown, Settings } from 'lucide-react';
import { api } from '@/lib/api';

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {});
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Scheduled', icon: Clock, count: '12' },
    { href: '/dashboard/sent', label: 'Sent', icon: Send, count: '785' },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-[280px] bg-white h-full flex flex-col justify-between py-6 border-r border-gray-200">
      <div>


        <div className="px-4 mb-6">
          <div className="bg-[#F6F7F9] rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-white shadow-sm flex-shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 bg-gray-200">{user.name?.[0]}</div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate">{user.name || 'Oliver Brown'}</span>
                <span className="text-[11px] text-gray-500 truncate">{user.email || 'oliver.brown@domain.io'}</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        <div className="px-4 mb-8">
          <Link href="/dashboard/compose" className="w-full flex items-center justify-center gap-2 bg-white text-[#00A344] border border-[#00A344] py-2.5 rounded-full text-sm font-medium hover:bg-[#EAF5EC] transition-colors">
            Compose
          </Link>
        </div>

        <div className="px-4 mb-2">
          <span className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase">CORE</span>
        </div>

        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active 
                    ? 'bg-[#EAF5EC] text-gray-900' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-gray-900' : 'text-gray-500'}`} />
                  {item.label}
                </div>
                {item.count && <span className={`text-xs ${active ? 'text-gray-900' : 'text-gray-400'}`}>{item.count}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-4">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors px-3 py-2.5 rounded-lg hover:bg-red-50 w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
