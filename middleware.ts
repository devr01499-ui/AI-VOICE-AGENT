import { NextRequest, NextResponse } from 'next/server';

export default function middleware(req: NextRequest) {
  const token = req.cookies.get('sb-access-token')?.value || req.cookies.get('next-auth.session-token')?.value || req.headers.get('authorization');
  const pathname = req.nextUrl.pathname;

  // Enforce strict server-side authentication redirect for all dashboard routes and protected paths
  if ((pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname.startsWith('/calendar') || pathname.startsWith('/telephony')) && !token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/calendar/:path*', '/telephony/:path*'],
};


