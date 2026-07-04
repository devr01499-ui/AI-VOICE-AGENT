import { NextRequest, NextResponse } from 'next/server';

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Redirect legacy /dashboard to /agents
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
