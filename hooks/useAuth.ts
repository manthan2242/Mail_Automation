import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

export const useAuth = () => {
  const { user, token, setAuth, logout, verify2FA } = useAuthStore();
  const router = useRouter();

  const login = async (email: string, password: string, role: 'admin' | 'employee') => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await res.json();
    if (res.ok) {
      setAuth(data.user, data.token);
      if (data.user.role === 'admin') {
        window.location.href = '/admin/dashboard';
      } else {
        if (data.user.isFirstLogin) {
          window.location.href = '/auth/change-password';
        } else {
          window.location.href = '/auth/verify-otp';
        }
      }
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  };

  const logoutUser = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    logout();
    router.push('/auth/login');
  };

  return { user, token, login, logout: logoutUser, verify2FA };
};
