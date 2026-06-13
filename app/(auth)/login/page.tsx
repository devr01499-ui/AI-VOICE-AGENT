'use client';

import React, { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AudioLines, Loader2, ShieldCheck, Mail, Lock } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  
  const [email, setEmail] = useState('admin@bolna.ai');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(errorParam ? 'Invalid email or password.' : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setErrorMsg('Authentication failed. Check credentials and try again.');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setErrorMsg('An unexpected network error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background visual graphics */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-[440px] z-10 space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="h-12 w-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/5 animate-pulse">
            <AudioLines className="h-6 w-6 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans mt-2">
            Welcome to <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">bOLNA</span>
          </h1>
          <p className="text-sm text-slate-400">
            Enterprise Voice AI Agent Orchestration
          </p>
        </div>

        <Card className="border border-slate-800 bg-slate-900/50 backdrop-blur-xl text-white shadow-2xl rounded-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight text-white">Sign In</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Enter your corporate credentials or use the pre-filled demo account.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-red-950/40 border border-red-800/30 text-red-400 rounded-lg flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-slate-400" /> Corporate Email
                </label>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-slate-400" /> Password
                  </label>
                  <a href="#" className="text-xs text-blue-400 hover:underline">
                    Forgot?
                  </a>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                disabled={isLoading}
                variant="premium"
                className="w-full text-sm font-semibold h-10 rounded-lg relative overflow-hidden transition-all duration-300"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    Authenticating session...
                  </span>
                ) : (
                  'Authorize & Enter Dashboard'
                )}
              </Button>

              <div className="w-full border-t border-slate-800/80 my-2" />

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/50">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Supabase secure multi-tenant sandbox enabled</span>
              </div>
            </CardFooter>
          </form>
        </Card>

        <p className="px-8 text-center text-xs text-slate-500">
          By signing in, you agree to our{' '}
          <a href="#" className="underline underline-offset-4 hover:text-slate-300">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="underline underline-offset-4 hover:text-slate-300">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 animate-pulse" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
