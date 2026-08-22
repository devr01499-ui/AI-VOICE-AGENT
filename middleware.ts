import { NextRequest, NextResponse } from 'next/server';

export default function middleware(req: NextRequest) {
  const token = req.cookies.get('sb-access-token')?.value || req.cookies.get('next-auth.session-token')?.value || req.headers.get('authorization');
  const pathname = req.nextUrl.pathname;

  // Protect sub-routes if unauthenticated: redirect to /dashboard (Auth Gateway)
  if ((pathname.startsWith('/calendar') || pathname.startsWith('/telephony') || (pathname.startsWith('/dashboard/') && pathname !== '/dashboard')) && !token) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/calendar/:path*', '/telephony/:path*'],
};


