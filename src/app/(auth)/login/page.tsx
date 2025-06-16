
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
import { LogIn, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const { currentUser, signInAsGuest, loading, error: authError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (currentUser && !currentUser.isAnonymous && !authError) { // Redirect if logged in, not anonymous, and no auth error
      router.push('/dashboard'); 
    }
  }, [currentUser, router, authError]);

  const handleGuestLogin = async () => {
    try {
      await signInAsGuest();
      // router.push will be handled by useEffect or onAuthStateChanged if successful
    } catch (error) {
      console.error("Guest login failed", error);
      // Toast or local error state can be set here if needed, useAuth already sets its own error.
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for email/password login
    alert(`Email/Password login not implemented. Email: ${email}. This app currently supports guest login for demonstration.`);
    // Example: await signInWithEmailAndPassword(auth, email, password);
    // Then redirect or handle errors
  };

  if (loading && !authError) { // Only show generic loading if no specific auth error
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  // If user is anonymous and no overriding authError, allow them to proceed or show a different message
  if (currentUser && currentUser.isAnonymous && !authError) {
     router.push('/dashboard');
     return <div className="flex items-center justify-center min-h-screen">Redirecting...</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">{APP_NAME}</CardTitle>
          <CardDescription>Sign in to manage student goals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {authError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentication Error</AlertTitle>
              <AlertDescription>
                {authError.message || "An unexpected error occurred during authentication setup."}
                 <br />
                Please ensure your Firebase environment variables (e.g., API key) are correctly set in your <code>.env</code> file.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                disabled={!!authError} // Disable form if there's a critical auth error
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
                disabled={!!authError}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !!authError}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGuestLogin} disabled={loading || !!authError}>
            {loading ? 'Signing In...' : 'Sign In as Guest'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

