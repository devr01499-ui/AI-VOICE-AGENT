import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

// Bypass auth in development
const authMiddleware = withAuth({
  pages: {
    signIn: '/login',
  },
});

export default function middleware(request: NextRequest) {
  // Skip auth check in development
  if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
    return NextResponse.next();
  }
  
  return (authMiddleware as any)(request);
}

export const config = {
  matcher: [
    '/',
    '/agents/:path*',
    '/templates/:path*',
    '/phone-numbers/:path*',
    '/analytics/:path*',
    '/integrations/:path*',
    '/settings/:path*',
  ],
};
