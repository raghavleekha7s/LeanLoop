import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode } from '@/lib/oauth-google';
import { createCredential } from '@/lib/n8n-client';

// GET /api/oauth/google/callback?code=...&state=...
// Exchanges the authorization code for tokens, stores them as an n8n
// googleApi credential, then redirects the popup back to a page that posts
// the credential ID to window.opener so the wizard can pick it up.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stored = cookies().get('ll_oauth_state')?.value;
  const scope = cookies().get('ll_oauth_scope')?.value ?? 'sheets';

  if (!code || !state || state !== stored) {
    return html('<h1>OAuth state mismatch</h1><p>Refresh and try again.</p>', 400);
  }

  try {
    const tokens = await exchangeCode(code);

    // n8n's OAuth2 credentials store the token bundle under `oauthTokenData`.
    // Pick the right credential type based on which scope the user requested.
    const n8nType =
      scope === 'gmail' ? 'gmailOAuth2' : 'googleSheetsOAuth2Api';

    const oauthTokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      // n8n stores expiry as a Unix-ish epoch field; tokens.expires_in is
      // seconds-from-now, so add to current time.
      expires_in: tokens.expires_in,
      expiry_date: Date.now() + tokens.expires_in * 1000,
    };

    const cred = await createCredential({
      name: `Google ${scope} (${new Date().toISOString().slice(0, 10)})`,
      type: n8nType,
      data: {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        oauthTokenData,
      },
    });

    return html(
      `<!doctype html><meta charset="utf-8"><title>Connected</title>
       <p>Google account connected. You can close this window.</p>
       <script>
         if (window.opener) {
           window.opener.postMessage(
             { source: 'leanloop-oauth', credentialId: ${JSON.stringify(cred.id)} },
             '*'
           );
           window.close();
         }
       </script>`,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return html(`<h1>OAuth failed</h1><pre>${escape(message)}</pre>`, 500);
  }
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}
