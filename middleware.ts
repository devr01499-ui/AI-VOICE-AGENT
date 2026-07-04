import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    
    // Redirect legacy /dashboard to /agents
    if (pathname === '/dashboard') {
      return NextResponse.redirect(new URL('/agents', req.url));
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/dashboard',
    '/agents/:path*',
    '/knowledge-base/:path*',
    '/phone-numbers/:path*',
    '/batch-call/:path*',
    '/call-history/:path*',
    '/chat-history/:path*',
    '/contacts/:path*',
    '/analytics/:path*',
    '/live-monitoring/:path*',
    '/ai-qa/:path*',
    '/alerting/:path*',
    '/integrations/:path*',
    '/billing/:path*',
    '/settings/:path*',
  ],
};
