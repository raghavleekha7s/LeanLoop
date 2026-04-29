import { NextResponse } from 'next/server';
import { getTemplate } from '@/lib/templates';
import { activateWorkflow, createWorkflow } from '@/lib/n8n-client';
import { withClient, runMigrations } from '@/lib/db';
import { CREDENTIAL_SPECS } from '@/lib/credential-specs';

// POST /api/templates/:id/activate
// Body: { credentials: Record<string, string>, variables?: Record<string, string> }
//   - credentials: n8n credential IDs keyed by requiredAccounts[].key
//   - variables:   user-supplied scalars keyed by template.variables[].key
//
// Steps:
//  1. Load the template definition.
//  2. Substitute every "__CRED__<key>" placeholder with { id } of the
//     matching n8n credential.
//  3. Substitute every "__VAR__<key>" placeholder with the user-supplied
//     scalar value (sheet IDs, Tally company name, etc.).
//  4. POST the resulting workflow to n8n, then activate it.
//  5. Record the activation so the dashboard can show what's deployed.

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const template = await getTemplate(params.id);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    credentials?: Record<string, string>;
    variables?: Record<string, string>;
  };
  const credIds = body.credentials ?? {};
  const vars = body.variables ?? {};

  const missingCreds = template.requiredAccounts.filter((a) => !credIds[a.key]);
  if (missingCreds.length > 0) {
    return NextResponse.json(
      { error: `Missing credentials: ${missingCreds.map((m) => m.label).join(', ')}` },
      { status: 400 },
    );
  }

  const requiredVars = (template.variables ?? []).filter(
    (v) => (v.required ?? true) && !vars[v.key],
  );
  if (requiredVars.length > 0) {
    return NextResponse.json(
      { error: `Missing inputs: ${requiredVars.map((v) => v.label).join(', ')}` },
      { status: 400 },
    );
  }

  const accountsByKey = new Map(template.requiredAccounts.map((a) => [a.key, a]));
  let workflow = substituteCredentials(
    template.n8nWorkflow,
    credIds,
    (key) => {
      const account = accountsByKey.get(key);
      return account ? CREDENTIAL_SPECS[account.provider]?.n8nType : undefined;
    },
  );
  workflow = substituteVariables(workflow, vars);

  try {
    const created = await createWorkflow(workflow);
    await activateWorkflow(created.id);

    // Best-effort — don't fail activation if the audit write hits a DB
    // hiccup; the user still has a live workflow.
    try {
      await runMigrations();
      await withClient((c) =>
        c.query(
          `INSERT INTO leanloop_activations (template_id, n8n_workflow_id, credentials)
           VALUES ($1, $2, $3)`,
          [template.id, created.id, JSON.stringify(credIds)],
        ),
      );
    } catch (e) {
      console.warn('[activate] audit write failed:', e);
    }

    return NextResponse.json({ workflowId: created.id, name: created.name });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function substituteCredentials(
  workflow: {
    name: string;
    nodes: unknown[];
    connections: Record<string, unknown>;
    settings?: Record<string, unknown>;
  },
  credIds: Record<string, string>,
  credTypeFor: (key: string) => string | undefined,
): typeof workflow {
  const nodes = workflow.nodes.map((node) => {
    const n = node as { credentials?: Record<string, unknown> };
    if (!n.credentials) return node;
    const newCreds: Record<string, unknown> = {};
    for (const [credName, value] of Object.entries(n.credentials)) {
      if (typeof value === 'string' && value.startsWith('__CRED__')) {
        const key = value.slice('__CRED__'.length);
        const id = credIds[key];
        if (!id) {
          throw new Error(`Missing credential for placeholder ${value}`);
        }
        // n8n accepts either a raw id or { id, name }. The latter renders
        // the credential name in the UI, which is friendlier.
        newCreds[credName] = { id };
        // Keep the credential type consistent when we can infer it.
        void credTypeFor;
      } else {
        newCreds[credName] = value;
      }
    }
    return { ...(node as object), credentials: newCreds };
  });
  return { ...workflow, nodes };
}

// Walks the workflow JSON and replaces every "__VAR__<key>" string with the
// matching value from `vars`. Recursive so it catches placeholders nested
// inside node parameters/options (where most user-supplied config lives).
function substituteVariables<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === 'string') {
    if (value.startsWith('__VAR__')) {
      const key = value.slice('__VAR__'.length);
      const v = vars[key];
      if (v === undefined) {
        throw new Error(`Missing variable for placeholder ${value}`);
      }
      return v as unknown as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => substituteVariables(v, vars)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteVariables(v, vars);
    }
    return out as unknown as T;
  }
  return value;
}
