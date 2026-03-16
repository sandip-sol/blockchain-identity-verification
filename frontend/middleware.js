import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/', '/login'];

// JWT_SECRET must match the backend secret. In production, use a shared secret
// or switch to asymmetric keys (RS256) for proper separation.
if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function middleware(req) {
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

  // Validate the JWT signature and expiry
  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    // Token is invalid or expired — clear the cookie and redirect
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    const response = NextResponse.redirect(url);
    response.cookies.delete('kyc_token');
    return response;
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/kyc/:path*',
    '/verify/:path*',
    '/wallet/:path*',
    '/activity/:path*',
    '/envelopes/:path*',
    '/admin/:path*'
  ]
};
