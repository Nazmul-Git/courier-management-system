import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request) {
  const path = request.nextUrl.pathname;
  const token = request.cookies.get('auth_token')?.value || '';

  // Public paths
  if (path.startsWith('/auth')) {
    if (token) {
      const decoded = jwt.decode(token);
      return NextResponse.redirect(new URL(
        decoded.role === 'admin' ? '/admin/dashboard' :
        decoded.role === 'agent' ? '/agent/deliveries' : '/customer/parcels',
        request.url
      ));
    }
    return NextResponse.next();
  }

  // Protected paths
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Admin routes
    if (path.startsWith('/admin') && decoded.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    
    // Agent routes
    if (path.startsWith('/agent') && decoded.role !== 'agent') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    
    // Customer routes
    if (path.startsWith('/customer') && decoded.role !== 'customer') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/agent/:path*',
    '/customer/:path*',
    '/auth/:path*',
  ],
};