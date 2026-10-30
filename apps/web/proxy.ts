import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64'),
    dev = process.env.NODE_ENV !== 'production';
  const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || '/api', request.nextUrl.origin).origin;
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "' 'strict-dynamic'" + (dev ? " 'unsafe-eval'" : ''),
    "style-src 'self' 'nonce-" + nonce + "'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: " +
      new URL(process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
        .origin,
    "font-src 'self'",
    "connect-src 'self' " + apiOrigin + (dev ? ' ws://localhost:3000' : ''),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  if (request.nextUrl.pathname.startsWith('/espace'))
    response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|icon.svg|.*\\.(?:png|jpg|jpeg|woff2|txt)$).*)'],
};
