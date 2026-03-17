'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\[\]\\\/\+^]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`;
}

function clearCookie(name) {
  document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [account, setAccount] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const t = getCookie('kyc_token') || (typeof window !== 'undefined' ? window.localStorage.getItem('kyc_token') : null);
    const a = typeof window !== 'undefined' ? window.localStorage.getItem('kyc_account') : null;
    if (t) setToken(t);
    if (a) {
      try { setAccount(JSON.parse(a)); } catch { /* ignore */ }
    }
    setHydrated(true);
  }, []);

  const value = useMemo(() => ({
    token,
    account,
    hydrated,
    isAuthenticated: !!token,
    login: (newToken, newAccount) => {
      setToken(newToken);
      setAccount(newAccount);
      setCookie('kyc_token', newToken);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('kyc_token', newToken);
        if (newAccount) window.localStorage.setItem('kyc_account', JSON.stringify(newAccount));
      }
    },
    setAccountData: (nextAccount) => {
      setAccount(nextAccount);
      if (typeof window !== 'undefined') {
        if (nextAccount) window.localStorage.setItem('kyc_account', JSON.stringify(nextAccount));
        else window.localStorage.removeItem('kyc_account');
      }
    },
    logout: () => {
      setToken(null);
      setAccount(null);
      clearCookie('kyc_token');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('kyc_token');
        window.localStorage.removeItem('kyc_account');
      }
    },
  }), [token, account, hydrated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
