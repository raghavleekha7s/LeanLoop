import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { buildAuthUrl } from '@/lib/oauth-google';

// GET /api/oauth/google/start?scope=sheets
// Kicks off the Google consent flow; stashes the caller-provided `scope`
// and a CSRF state token in short-lived cookies so the callback can match
// them up.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') ?? 'sheets';
  const state = randomBytes(16).toString('hex');

  const authUrl = buildAuthUrl(scope, state);
  const res = NextResponse.redirect(authUrl);
  res.cookies.set('ll_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  res.cookies.set('ll_oauth_scope', scope, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
