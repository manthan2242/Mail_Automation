'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { token, setAuth } = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initializeAuth() {
      // If Zustand doesn't have the token, attempt to hydrate it using the cookie session.
      if (!token) {
        try {
          const res = await fetch('/api/auth/session');
          if (res.ok) {
            const data = await res.json();
            setAuth(data.user, data.token);
            console.log('[AUTH INITIALIZER] Zustand store successfully hydrated from session cookie.');
          }
        } catch (e) {
          console.error('[AUTH INITIALIZER] Failed to fetch session:', e);
        }
      }
      setInitialized(true);
    }
    initializeAuth();
  }, [token, setAuth]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366f1]" />
      </div>
    );
  }

  return <>{children}</>;
}
