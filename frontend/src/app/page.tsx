'use client';

import { API_BASE_URL } from '@/lib/api';

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-xl p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
        
        <h1 className="text-[28px] font-semibold text-gray-900 mb-6 tracking-tight">Login</h1>
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-[#EAF5EC] text-gray-700 py-3 rounded-lg font-medium hover:bg-[#d8edd9] transition-colors"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
          <span className="text-sm">Login with Google</span>
        </button>

        <div className="flex items-center w-full my-6">
          <div className="flex-1 border-t border-gray-100"></div>
          <span className="px-3 text-xs text-gray-400 font-medium">or sign up through email</span>
          <div className="flex-1 border-t border-gray-100"></div>
        </div>

        <div className="w-full space-y-4">
          <input 
            type="email" 
            placeholder="Email ID" 
            className="w-full bg-[#F6F7F9] rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full bg-[#F6F7F9] rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          
          <div className="pt-2">
            <button className="w-full bg-[#00A344] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#008f3b] transition-colors">
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
