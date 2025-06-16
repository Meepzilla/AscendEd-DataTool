
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
import { LogIn, AlertCircle, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const { currentUser, signInAsGuest, loading, error: authError, isFirebaseAvailable } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Redirect if already logged in (either to Firebase or as local guest)
    if (currentUser && !loading) { 
      router.push('/dashboard'); 
    }
  }, [currentUser, loading, router]);

  const handleGuestLogin = async () => {
    try {
      await signInAsGuest();
      // router.push will be handled by useEffect if successful
    } catch (error) {
      console.error("Guest login failed", error);
      // Toast or local error state can be set here if needed, useAuth already sets its own error.
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseAvailable) {
        alert("Email/Password login is not available in local mode. Please use Guest Sign In.");
        return;
    }
    // Placeholder for email/password login
    alert(`Email/Password login not implemented. Email: ${email}. This app currently supports guest login for demonstration.`);
    // Example: await signInWithEmailAndPassword(auth, email, password);
    // Then redirect or handle errors
  };

  // Specific loading state for this page if needed, distinct from global auth loading
  if (loading && !currentUser && !authError) { 
    return <div className="flex items-center justify-center min-h-screen">Loading authentication...</div>;
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
            <Alert variant={authError.message.includes("Firebase not configured") ? "default" : "destructive"} className={authError.message.includes("Firebase not configured") ? "border-yellow-500 bg-yellow-50/50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700" : ""}>
              {authError.message.includes("Firebase not configured") ? <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-500" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{authError.message.includes("Firebase not configured") ? "Local Mode Active" : "Authentication Error"}</AlertTitle>
              <AlertDescription>
                {authError.message.includes("Firebase not configured") 
                  ? "Firebase is not configured. You are operating in local mode. Data will not be saved to the cloud."
                  : authError.message || "An unexpected error occurred."
                }
                {!authError.message.includes("Firebase not configured") && isFirebaseAvailable &&
                 <br/> Please ensure your Firebase environment variables (e.g., API key) are correctly set in your <code>.env</code> file if you intend to use Firebase.
                }
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
            <Button type="submit" className="w-full" disabled={loading || !isFirebaseAvailable}>
              {loading ? 'Signing In...' : 'Sign In with Email'}
            </Button>
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
            {loading && isFirebaseAvailable ? 'Signing In...' : 'Sign In as Guest'}
            {!isFirebaseAvailable && " (Local Mode)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
