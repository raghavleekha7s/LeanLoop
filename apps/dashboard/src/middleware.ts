import { NextRequest, NextResponse } from 'next/server';

// Lightweight admin gate. Set LEANLOOP_ADMIN_PASSWORD in .env; leaving it
// unset disables the gate (useful for local dev). On first visit we prompt
// for HTTP Basic auth, then set a signed cookie so subsequent requests are
// transparent.
//
// Not a full auth system — this exists to keep the self-hosted dashboard
// from being public on the internet before proper user accounts land.

const COOKIE_NAME = 'll_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function middleware(req: NextRequest) {
  const password = process.env.LEANLOOP_ADMIN_PASSWORD;
  if (!password) return NextResponse.next(); // gate disabled

  // Allow OAuth callbacks through — Google won't send basic-auth headers.
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/oauth/')) return NextResponse.next();
  // Allow the alert webhook (n8n posts here with its own auth).
  if (pathname.startsWith('/api/alerts/')) return NextResponse.next();
  // Allow inbound webhooks from third parties (Meta, Razorpay, Shiprocket).
  // Each route handles its own signature/token verification.
  if (pathname.startsWith('/api/webhooks/')) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie && cookie === expectedCookie(password)) {
    return NextResponse.next();
  }

  const basic = req.headers.get('authorization');
  if (basic?.startsWith('Basic ')) {
    const decoded = atob(basic.slice(6));
    const [, supplied] = decoded.split(':');
    if (supplied === password) {
      const res = NextResponse.next();
      res.cookies.set(COOKIE_NAME, expectedCookie(password), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
      return res;
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="LeanLoop"' },
  });
}

// Derive a stable cookie value from the password so it invalidates when the
// operator rotates the password. Not cryptographically strong — this is a
// gate, not a session system.
function expectedCookie(password: string): string {
  let h = 0;
  for (let i = 0; i < password.length; i++) h = (h * 31 + password.charCodeAt(i)) | 0;
  return `v1-${Math.abs(h).toString(36)}`;
}

export const config = {
  // Skip Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
