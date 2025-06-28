'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { APP_NAME } from '@/lib/constants';
import { UserPlus, AlertCircle, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

export default function SignUpPage() {
  const { currentUser, signUpWithEmail, loading, error: authError, isFirebaseAvailable } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);

    if (password !== confirmPassword) {
      setPageError("Passwords do not match.");
      return;
    }
    if (!isFirebaseAvailable) {
      setPageError("Sign-up is not available in local mode.");
      return;
    }

    await signUpWithEmail(email, password, displayName);
    // Redirection is handled by the useEffect above
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Create an Account</CardTitle>
          <CardDescription>Join {APP_NAME} to start tracking student progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pageError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sign-Up Error</AlertTitle>
              <AlertDescription>{pageError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input 
                id="displayName" 
                type="text" 
                placeholder="e.g., Jane Doe" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required 
                disabled={loading || !isFirebaseAvailable}
              />
            </div>
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
             <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
                disabled={loading || !isFirebaseAvailable}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !isFirebaseAvailable}>
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="underline hover:text-primary">
              <LogIn className="inline-block h-4 w-4 mr-1" />
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
