import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import * as api from '../api/client';
import { ApiError } from '../api/http';
import type { AuthResponse, AuthUser, UserRole } from '../api/types';
import { clearAuth, loadAuth, saveAuth } from './storage';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
};

type AuthContextValue = AuthState & {
  startOtp: (phone: string, role: UserRole) => Promise<{ otp?: string | null }>;
  verifyOtp: (phone: string, otp: string, role: UserRole) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signupWithPassword: (
    email: string,
    password: string,
    role: UserRole,
    phone?: string | null,
    displayName?: string | null,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  withAuth: <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    accessToken: null,
    refreshToken: null,
    user: null,
  });

  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<AuthResponse> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const auth = await loadAuth();
      if (cancelled) return;
      if (!auth) {
        accessRef.current = null;
        refreshRef.current = null;
        setState({ status: 'signedOut', accessToken: null, refreshToken: null, user: null });
        return;
      }
      accessRef.current = auth.accessToken;
      refreshRef.current = auth.refreshToken;
      setState({ status: 'signedIn', ...auth });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startOtp = useCallback(async (phone: string, role: UserRole) => {
    const res = await api.otpStart(phone, role);
    return { otp: res.devOtp ?? res.otp ?? null };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string, role: UserRole) => {
    const auth = await api.otpVerify(phone, otp, role);
    await saveAuth(auth);
    accessRef.current = auth.accessToken;
    refreshRef.current = auth.refreshToken;
    setState({ status: 'signedIn', ...auth });
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const auth = await api.passwordLogin(email, password);
    if (auth.user.role === 'ADMIN') {
      throw new ApiError('Admin role is not supported in mobile app.', { status: 400 });
    }
    await saveAuth(auth);
    accessRef.current = auth.accessToken;
    refreshRef.current = auth.refreshToken;
    setState({ status: 'signedIn', ...auth });
  }, []);

  const signupWithPassword = useCallback(
    async (email: string, password: string, role: UserRole, phone?: string | null, displayName?: string | null) => {
      if (role === 'ADMIN') {
        throw new ApiError('Admin role is not supported in mobile app.', { status: 400 });
      }
      const auth = await api.passwordSignup({ email, password, phone: phone || null, displayName: displayName || null, role });
      await saveAuth(auth);
      accessRef.current = auth.accessToken;
      refreshRef.current = auth.refreshToken;
      setState({ status: 'signedIn', ...auth });
    },
    [],
  );

  const signOut = useCallback(async () => {
    await clearAuth();
    accessRef.current = null;
    refreshRef.current = null;
    refreshInFlight.current = null;
    setState({ status: 'signedOut', accessToken: null, refreshToken: null, user: null });
  }, []);

  const refreshTokens = useCallback(async (): Promise<AuthResponse> => {
    const rt = refreshRef.current;
    if (!rt) throw new Error('Missing refresh token');

    if (!refreshInFlight.current) {
      refreshInFlight.current = api.refresh(rt).finally(() => {
        refreshInFlight.current = null;
      });
    }

    const auth = await refreshInFlight.current;
    await saveAuth(auth);
    accessRef.current = auth.accessToken;
    refreshRef.current = auth.refreshToken;
    setState({ status: 'signedIn', ...auth });
    return auth;
  }, []);

  const withAuth = useCallback(
    async <T,>(fn: (accessToken: string) => Promise<T>): Promise<T> => {
      const at = accessRef.current;
      if (!at) throw new Error('Not signed in');
      try {
        return await fn(at);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          try {
            const refreshed = await refreshTokens();
            return await fn(refreshed.accessToken);
          } catch {
            await signOut();
          }
        }
        throw e;
      }
    },
    [refreshTokens, signOut],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      startOtp,
      verifyOtp,
      loginWithPassword,
      signupWithPassword,
      signOut,
      withAuth,
    }),
    [state, startOtp, verifyOtp, loginWithPassword, signupWithPassword, signOut, withAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
