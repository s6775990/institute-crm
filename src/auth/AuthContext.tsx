import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Profile } from '../core/types';
import { useData } from '../data/DataContext';
import { Loading } from '../ui/common';
import { authEvents } from './authEvents';

export type SignedOutReason = 'idle' | 'expired' | null;

interface AuthContextValue {
  user: Profile | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Re-reads the current user (after changing name or password). */
  refresh(): Promise<void>;
  signedOutReason: SignedOutReason;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
const HEARTBEAT_MS = 60_000;
export const IDLE_LIMIT_MINUTES = 30;
const IDLE_LIMIT_MS = IDLE_LIMIT_MINUTES * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const data = useData();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [signedOutReason, setSignedOutReason] = useState<SignedOutReason>(null);
  const lastActivity = useRef(Date.now());

  const endSession = useCallback(
    (reason: SignedOutReason) => {
      setUser(null);
      setSignedOutReason(reason);
      queryClient.clear();
    },
    [queryClient],
  );

  useEffect(() => {
    data.getSession().then((s) => {
      setUser(s?.user ?? null);
      setReady(true);
    });
  }, [data]);

  useEffect(() => authEvents.onExpired(() => endSession('expired')), [endSession]);

  // Keep the session alive while the person is actually using the screen
  // (e.g. typing a long meeting summary), and end it after inactivity.
  useEffect(() => {
    if (!user) return;
    const mark = () => (lastActivity.current = Date.now());
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = window.setInterval(async () => {
      const idleMs = Date.now() - lastActivity.current;
      if (idleMs < HEARTBEAT_MS) {
        // getSession() also extends the session on the data side.
        if (!(await data.getSession())) endSession('expired');
      } else if (idleMs >= IDLE_LIMIT_MS) {
        await data.signOut();
        endSession('idle');
      }
    }, HEARTBEAT_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, mark));
      window.clearInterval(timer);
    };
  }, [user, data, endSession]);

  const value: AuthContextValue = {
    user,
    signedOutReason,
    async signIn(email, password) {
      const session = await data.signIn(email, password);
      queryClient.clear();
      lastActivity.current = Date.now();
      setSignedOutReason(null);
      setUser(session.user);
    },
    async signOut() {
      await data.signOut();
      endSession(null);
    },
    async refresh() {
      const session = await data.getSession();
      if (!session) endSession('expired');
      else setUser(session.user);
    },
  };

  if (!ready) return <Loading label="טוען את המערכת..." />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The signed-in user; only for screens behind the login guard. */
export function useCurrentUser(): Profile {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user;
}
