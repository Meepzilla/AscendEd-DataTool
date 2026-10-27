'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@/lib/types';

// The single local user. Data is stored in the browser's localStorage, keyed by this uid,
// so the uid must stay stable for existing data to keep loading.
const LOCAL_USER: User = {
  uid: 'local-guest-user',
  email: 'guest@local.com',
  displayName: 'Guest (Local Mode)',
  isAnonymous: true,
  createdAt: new Date().toISOString(),
};

// Defines the shape of the AuthContext, specifying what values and functions are provided.
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Creates the React Context for authentication. It will hold the authentication state and methods.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component.
 * Provides a local-only "session": the user is either signed in as the local user or signed out.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentUser(LOCAL_USER);
    setLoading(false);
  }, []);

  /**
   * Signs in as the local user.
   */
  const signInAsGuest = useCallback(async () => {
    setCurrentUser(LOCAL_USER);
  }, []);

  /**
   * Signs out the local user. Stored data is kept.
   */
  const signOut = useCallback(async () => {
    setCurrentUser(null);
  }, []);

  return (
    // Provides the authentication context values to any child components wrapped by AuthProvider.
    <AuthContext.Provider value={{ currentUser, loading, signInAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to consume the AuthContext.
 * Throws an error if used outside of an AuthProvider.
 * @returns The authentication context values.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
