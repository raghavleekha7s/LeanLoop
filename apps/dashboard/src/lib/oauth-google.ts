// Google OAuth2 helper — runs the "installed app" flow from the dashboard.
//
// Flow:
//  1. /api/oauth/google/start — redirect to Google's consent screen with our
//     client_id + scope + state (state = random token we sign & stash).
//  2. Google redirects back to /api/oauth/google/callback with ?code=...
//  3. Exchange the code for tokens; stash the refresh_token as an n8n
//     googleApi credential.
//
// Env vars (set in .env):
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   LEANLOOP_PUBLIC_URL   — public URL of the dashboard (for redirect_uri)

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const SCOPES: Record<string, string[]> = {
  sheets: ['https://www.googleapis.com/auth/spreadsheets'],
  gmail: ['https://www.googleapis.com/auth/gmail.send'],
};

function publicUrl(): string {
  return process.env.LEANLOOP_PUBLIC_URL ?? 'http://localhost:3000';
}

export function redirectUri(): string {
  return `${publicUrl()}/api/oauth/google/callback`;
}

export function buildAuthUrl(scopeKey: string, state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
  const scopes = SCOPES[scopeKey] ?? SCOPES.sheets;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: 'Bearer';
}

export async function exchangeCode(code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}
