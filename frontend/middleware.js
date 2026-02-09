import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/login'];

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow next internals and static
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/assets')) {
    return NextResponse.next();
  }

  // Allow api routes (frontend has none here; still safe)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('kyc_token')?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/kyc/:path*',
    '/verify/:path*',
    '/wallet/:path*',
    '/activity/:path*',
    '/envelopes/:path*'
  ]
};
