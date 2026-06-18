import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

// Bypass auth in development
const authMiddleware = withAuth({
  pages: {
    signIn: '/login',
  },
});

export default function middleware(request: NextRequest) {
  // Always skip auth checks to allow direct dashboard access for testing/MVP
  return NextResponse.next();
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
