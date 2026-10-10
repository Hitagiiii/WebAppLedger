// ============================================
// DEMO AUTHENTICATION — local only.
//
// This is an explicit demo gate for a frontend-only build: accounts and
// sessions live in this browser's localStorage, passwords are stored as a
// salted SHA-256 digest (never plaintext), and there is NO server, NO
// session token and NO authorization. It must never be presented as
// production security — see README "Local demo mode vs production".
// ============================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { STORAGE_KEYS } from '../constants';

export interface AuthUser {
  name: string;
  email: string;
}

interface StoredAuth {
  account: { name: string; email: string; salt: string; hash: string } | null;
  session: AuthUser | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** false until the stored session has been read */
  ready: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): StoredAuth {
  const empty: StoredAuth = { account: null, session: null };
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEYS.auth);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed || typeof parsed !== 'object') return empty;
    return {
      account: parsed.account && typeof parsed.account.hash === 'string' ? parsed.account : null,
      session: parsed.session && typeof parsed.session.email === 'string' ? parsed.session : null,
    };
  } catch {
    return empty;
  }
}

function writeStored(value: StoredAuth): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(value));
  } catch (err) {
    console.warn('[sakura-ledger] Could not persist the demo session.', err);
  }
}

async function digest(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::${password}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic fallback for non-secure contexts (still not plaintext).
  let hash = 5381;
  const text = `${salt}::${password}`;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `fallback-${(hash >>> 0).toString(16)}`;
}

function makeSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setUser(stored.session);
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) return { ok: false, error: 'Enter a valid email address.' };
    if (!password) return { ok: false, error: 'Password is required.' };

    const stored = readStored();
    if (!stored.account) return { ok: false, error: 'No demo account yet — register first.' };
    if (stored.account.email !== trimmed) return { ok: false, error: 'Incorrect email or password.' };

    const hash = await digest(password, stored.account.salt);
    if (hash !== stored.account.hash) return { ok: false, error: 'Incorrect email or password.' };

    const session: AuthUser = { name: stored.account.name, email: stored.account.email };
    writeStored({ ...stored, session });
    setUser(session);
    return { ok: true };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const trimmedName = name.trim();
    const trimmed = email.trim().toLowerCase();
    if (trimmedName.length < 2) return { ok: false, error: 'Please enter your name.' };
    if (!EMAIL_RE.test(trimmed)) return { ok: false, error: 'Enter a valid email address.' };
    if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };

    const stored = readStored();
    if (stored.account && stored.account.email === trimmed) {
      return { ok: false, error: 'A demo account with that email already exists.' };
    }
    const salt = makeSalt();
    const hash = await digest(password, salt);
    const account = { name: trimmedName, email: trimmed, salt, hash };
    const session: AuthUser = { name: trimmedName, email: trimmed };
    writeStored({ account, session });
    setUser(session);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    const stored = readStored();
    writeStored({ ...stored, session: null });
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
