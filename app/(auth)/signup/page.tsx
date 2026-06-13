'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AudioLines } from 'lucide-react';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-[440px] z-10 space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="h-12 w-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
            <AudioLines className="h-6 w-6 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans mt-2">
            Create Account
          </h1>
          <p className="text-sm text-slate-400">
            Join the Voice AI Platforms Sandbox
          </p>
        </div>

        <Card className="border border-slate-800 bg-slate-900/50 backdrop-blur-xl text-white shadow-2xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Registration Restricted</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              To support secure RBAC multi-tenant workspaces, self-registration is closed. Contact your tenant admin for credentials invitations.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-300">
            Demo credentials are fully prepared for review.
          </CardContent>
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button className="w-full" variant="premium">
                Go to Sign In
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
