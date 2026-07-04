import { NextRequest, NextResponse } from 'next/server';

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Redirect /dashboard to /agents
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/agents', req.url));
  }

  // Always skip auth checks to allow direct dashboard access for testing/console bypass
  return NextResponse.next();
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
