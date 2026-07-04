import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

const authMiddleware = withAuth({
  pages: {
    signIn: '/login',
  },
});

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Redirect /dashboard to /agents
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/agents', req.url));
  }

  // Handle protected inner dashboard views
  return (authMiddleware as any)(req);
}

export const config = {
  matcher: [
    '/dashboard',
    '/agents/:path*',
    '/phone-numbers/:path*',
    '/analytics/:path*',
    '/integrations/:path*',
    '/settings/:path*',
  ],
};
