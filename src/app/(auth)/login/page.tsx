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
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const { currentUser, signInAsGuest, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(''); // Example for email/password form
  const [password, setPassword] = useState(''); // Example

  useEffect(() => {
    if (currentUser && !currentUser.isAnonymous) { // Redirect if logged in and not anonymous
      router.push('/dashboard'); 
    }
  }, [currentUser, router]);

  const handleGuestLogin = async () => {
    try {
      await signInAsGuest();
      router.push('/dashboard'); // Redirect after guest login
    } catch (error) {
      console.error("Guest login failed", error);
      // Show error to user
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for email/password login
    alert(`Email/Password login not implemented. Email: ${email}`);
    // Example: await signInWithEmailAndPassword(auth, email, password);
    // Then redirect or handle errors
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  // If user is anonymous, allow them to proceed or show a different message
  if (currentUser && currentUser.isAnonymous) {
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
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
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
          <Button variant="outline" className="w-full" onClick={handleGuestLogin} disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In as Guest'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
