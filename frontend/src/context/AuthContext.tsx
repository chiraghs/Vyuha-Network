import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthAPI } from '../api/endpoints';
import { TOKEN_STORAGE_KEY, extractErrorMessage, setUnauthorizedHandler } from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  /** True while a stored token is being validated on boot. */
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState<boolean>(
    () => localStorage.getItem(TOKEN_STORAGE_KEY) !== null,
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) return;
    let cancelled = false;
    AuthAPI.me()
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const data = await AuthAPI.login(username, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      const profile = await AuthAPI.me().catch(() => null);
      setUser(
        profile ?? {
          id: data.username,
          username: data.username,
          email: '',
          role: data.role,
        },
      );
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Sign-in failed. Please try again.'));
    }
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, logout }),
    [user, initializing, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
