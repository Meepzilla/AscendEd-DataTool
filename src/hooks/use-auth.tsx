
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInAnonymously, signOut as firebaseSignOut, IdTokenResult, signInWithCustomToken as firebaseSignInWithCustomToken } from 'firebase/auth';
import { auth as authModule } from '@/lib/firebase/config'; 
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorLog } from './use-error-log'; // Import useErrorLog

// Define a local guest user structure
const LOCAL_GUEST_USER: User = {
  uid: 'local-guest-user',
  email: 'guest@local.com',
  displayName: 'Guest (Local Mode)',
  isAnonymous: true,
};

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: Error | null; 
  isFirebaseAvailable: boolean;
  signInWithCustomToken: (token: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  getTokenResult: (forceRefresh?: boolean) => Promise<IdTokenResult | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(!!authModule);
  const { addErrorLog } = useErrorLog();

  useEffect(() => {
    if (!authModule) { 
      setIsFirebaseAvailable(false);
      setCurrentUser(LOCAL_GUEST_USER); 
      const configError = new Error("Firebase not configured. Operating in local mode. Some features like cloud sync will be unavailable.");
      setError(configError);
      addErrorLog({ message: configError.message, source: 'useAuth.init', type: 'warning', details: 'Firebase SDK (authModule) is null.' });
      setLoading(false);
      return;
    }

    setIsFirebaseAvailable(true);
    const unsubscribe = onAuthStateChanged(authModule, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isAnonymous: firebaseUser.isAnonymous,
        };
        setCurrentUser(user);
        setError(null);
      } else {
        if (isFirebaseAvailable && !authModule.currentUser) {
             try {
                await signInAnonymously(authModule);
             } catch (e: any) {
                console.error("Error signing in anonymously after initial null user:", e);
                setError(e as Error);
                addErrorLog({ message: 'Automatic anonymous sign-in failed.', source: 'useAuth.onAuthStateChanged', details: e.message, type: 'error' });
                setCurrentUser(null);
             }
        } else if (!isFirebaseAvailable) {
            setCurrentUser(LOCAL_GUEST_USER); 
        }
         else {
            setCurrentUser(null);
        }
      }
      setLoading(false);
    }, (err: Error) => {
      console.error("Auth state error:", err);
      setError(err);
      addErrorLog({ message: 'Auth state listener error.', source: 'useAuth.onAuthStateChanged', details: err.message, type: 'error' });
      setCurrentUser(null); 
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isFirebaseAvailable, addErrorLog]); 

  const signInWithCustomToken = useCallback(async (token: string) => {
    if (!authModule) {
      const noAuthError = new Error("Firebase Auth is not initialized. Cannot sign in with custom token.");
      setError(noAuthError);
      addErrorLog({ message: noAuthError.message, source: 'useAuth.signInWithCustomToken', type: 'error' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignInWithCustomToken(authModule, token);
    } catch (e: any) {
      console.error("Error signing in with custom token:", e);
      setError(e as Error);
      addErrorLog({ message: 'Custom token sign-in failed.', source: 'useAuth.signInWithCustomToken', details: e.message, type: 'error' });
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);
  
  const signInAsGuest = useCallback(async () => {
    if (!authModule) {
      setCurrentUser(LOCAL_GUEST_USER);
      const noAuthError = new Error("Firebase not configured. Operating in local mode.");
      setError(noAuthError);
      addErrorLog({ message: noAuthError.message, source: 'useAuth.signInAsGuest', type: 'warning' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInAnonymously(authModule);
    } catch (e: any) {
      console.error("Error signing in anonymously:", e);
      setError(e as Error);
      addErrorLog({ message: 'Guest sign-in failed.', source: 'useAuth.signInAsGuest', details: e.message, type: 'error' });
      setCurrentUser(null); 
      setLoading(false);
    }
  }, [addErrorLog]);

  const signOut = useCallback(async () => {
    if (!authModule) {
      setCurrentUser(null); 
      setError(null); 
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut(authModule);
    } catch (e: any) {
      console.error("Error signing out:", e);
      setError(e as Error);
      addErrorLog({ message: 'Sign-out failed.', source: 'useAuth.signOut', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);

  const getTokenResult = useCallback(async (forceRefresh: boolean = false): Promise<IdTokenResult | null> => {
    if (!authModule || !authModule.currentUser) {
      const message = !isFirebaseAvailable ? "Firebase not available for getTokenResult." : "No current Firebase user for getTokenResult.";
      addErrorLog({ message: message, source: 'useAuth.getTokenResult', type: 'warning' });
      return null;
    }
    try {
      return await authModule.currentUser.getIdTokenResult(forceRefresh);
    } catch (e: any) {
      console.error("Error getting token result:", e);
      setError(e as Error);
      addErrorLog({ message: 'Failed to get ID token result.', source: 'useAuth.getTokenResult', details: e.message, type: 'error' });
      return null;
    }
  }, [isFirebaseAvailable, addErrorLog]);

  if (loading && !currentUser && (!error || (error && error.message.includes("Firebase not configured")))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto bg-primary/20" />
            <Skeleton className="h-6 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-10 w-full mt-4" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, error, isFirebaseAvailable, signInWithCustomToken, signInAsGuest, signOut, getTokenResult }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
