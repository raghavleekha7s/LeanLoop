import { NextResponse } from 'next/server';
import { createCredential } from '@/lib/n8n-client';
import { CREDENTIAL_SPECS } from '@/lib/credential-specs';
import type { AccountProvider } from '@/types';

// POST /api/credentials
// Body: { provider: AccountProvider, name: string, data: Record<string,string> }
// Returns: { credentialId: string }
//
// Creates an n8n credential via the admin REST API. The wizard calls this
// once per required account before hitting /activate.

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    provider?: AccountProvider;
    name?: string;
    data?: Record<string, string>;
  } | null;

  if (!body?.provider || !body.name || !body.data) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const spec = CREDENTIAL_SPECS[body.provider];
  if (!spec) {
    return NextResponse.json(
      { error: `Unknown provider: ${body.provider}` },
      { status: 400 },
    );
  }

  // Reject missing fields at the boundary — n8n's error message is cryptic
  // if you send a half-populated credential.
  const missing = spec.fields
    .filter((f) => !body.data?.[f.key])
    .map((f) => f.label);
  if (missing.length > 0 && !spec.oauthStart) {
    return NextResponse.json(
      { error: `Missing fields: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const created = await createCredential({
      name: body.name,
      type: spec.n8nType,
      data: body.data,
    });
    return NextResponse.json({ credentialId: created.id, name: created.name });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
