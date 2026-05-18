'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authenticateWithPin } from '@/lib/change-request-api';

const SESSION_KEY = 'showcase_session';

// Safari ITP can aggressively purge localStorage; defer writes to idle time
// to avoid blocking the main thread. Reads remain synchronous (needed for init).
const idleWrite = (fn: () => void): void => {
  if (typeof window === 'undefined') return;
  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => void })
      .requestIdleCallback(fn, { timeout: 1000 });
  } else {
    setTimeout(fn, 0);
  }
};

interface Session {
  token: string;
  expiresAt: number;
}

interface ShowcaseAuthContextValue {
  isUnlocked: boolean;
  isAuthenticating: boolean;
  errorMessage: string | null;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  showPinModal: boolean;
  openPinModal: () => void;
  closePinModal: () => void;
}

const ShowcaseAuthContext = createContext<ShowcaseAuthContextValue | null>(null);

export function useShowcaseAuth() {
  const ctx = useContext(ShowcaseAuthContext);
  if (!ctx) throw new Error('useShowcaseAuth must be used within ShowcaseAuthProvider');
  return ctx;
}

export function ShowcaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);

  // Check for existing valid session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session: Session = JSON.parse(raw);
        if (Date.now() < session.expiresAt) {
          setIsUnlocked(true);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const result = await authenticateWithPin(pin);
      const session: Session = {
        token: result.token,
        expiresAt: Date.now() + result.expires_in * 1000,
      };
      idleWrite(() => localStorage.setItem(SESSION_KEY, JSON.stringify(session)));
      setIsUnlocked(true);
      setShowPinModal(false);
      return true;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Authenticatie mislukt');
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const lock = useCallback(() => {
    idleWrite(() => localStorage.removeItem(SESSION_KEY));
    setIsUnlocked(false);
  }, []);

  const openPinModal = useCallback(() => {
    setErrorMessage(null);
    setShowPinModal(true);
  }, []);

  const closePinModal = useCallback(() => {
    setShowPinModal(false);
    setErrorMessage(null);
  }, []);

  return (
    <ShowcaseAuthContext.Provider
      value={{
        isUnlocked,
        isAuthenticating,
        errorMessage,
        unlock,
        lock,
        showPinModal,
        openPinModal,
        closePinModal,
      }}
    >
      {children}
    </ShowcaseAuthContext.Provider>
  );
}
