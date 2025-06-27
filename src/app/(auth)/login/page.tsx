'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle }
  from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { APP_NAME } from '@/lib/constants';
import { LogIn, AlertCircle, WifiOff, UserPlus } from "lucide-react"; // Added UserPlus
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const { currentUser, signInAsGuest, signInWithEmail, signUpWithEmail, loading, error: authError, isFirebaseAvailable } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pageError, setPageError] = useState<string | null>(null); // For local errors or to echo authError

  useEffect(() => {
    if (currentUser && !loading) { 
      router.replace('/dashboard');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    if (authError) {
      setPageError(authError.message);
    } else {
      setPageError(null);
    }
  }, [authError]);

  const handleGuestLogin = async () => {
    setPageError(null);
    await signInAsGuest();
    // Redirection handled by useEffect
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseAvailable) {
      setPageError("Email/Password login is not available in local mode. Please use Guest Sign In.");
      return;
    }
    setPageError(null);
    await signInWithEmail(email, password);
    // Redirection handled by useEffect or error displayed via authError
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
     if (!isFirebaseAvailable) {
      setPageError("Email/Password sign-up is not available in local mode. Please use Guest Sign In.");
      return;
    }
    setPageError(null);
    // For simplicity, display name will be derived from email in useAuth
    await signUpWithEmail(email, password); 
    // Redirection handled by useEffect or error displayed via authError
  };


  if (loading && !currentUser && !pageError && !authError) { 
    return <div className="flex items-center justify-center min-h-screen">Loading authentication...</div>;
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">{APP_NAME}</CardTitle>
          <CardDescription>Sign in or create an account to manage student goals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pageError && (
            <Alert variant={pageError.includes("Firebase not configured") || pageError.includes("local mode") ? "default" : "destructive"} 
                   className={pageError.includes("Firebase not configured") || pageError.includes("local mode") ? "border-yellow-500 bg-yellow-50/50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700" : ""}>
              {pageError.includes("Firebase not configured") || pageError.includes("local mode") ? <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-500" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{pageError.includes("Firebase not configured") || pageError.includes("local mode") ? "Local Mode Active / Info" : "Authentication Error"}</AlertTitle>
              <AlertDescription>
                {pageError}
                 {!pageError.includes("Firebase not configured") && !pageError.includes("local mode") && isFirebaseAvailable &&
                 <br/> Please check your credentials or ensure your Firebase environment is correctly set up.
                }
              </AlertDescription>
            </Alert>
          )}
          <form className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                disabled={loading || !isFirebaseAvailable} 
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                disabled={loading || !isFirebaseAvailable}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" onClick={handleEmailSignIn} className="flex-1" disabled={loading || !isFirebaseAvailable}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {loading && isFirebaseAvailable ? 'Signing In...' : 'Sign In'}
                </Button>
                <Button type="submit" onClick={handleEmailSignUp} variant="secondary" className="flex-1" disabled={loading || !isFirebaseAvailable}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {loading && isFirebaseAvailable ? 'Signing Up...' : 'Sign Up'}
                </Button>
            </div>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGuestLogin} disabled={loading && isFirebaseAvailable}>
            {loading && isFirebaseAvailable ? 'Processing...' : 'Continue as Guest'}
            {!isFirebaseAvailable && " (Local Mode)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
