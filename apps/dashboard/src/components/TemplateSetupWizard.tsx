'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Plug } from 'lucide-react';
import type {
  LeanLoopTemplateAccountReq,
  LeanLoopTemplateVariable,
} from '@/types';
import { CREDENTIAL_SPECS } from '@/lib/credential-specs';

type Step = 1 | 2 | 3;
type ConnectionState = { credentialId: string; name: string } | null;

export function TemplateSetupWizard({
  templateId,
  templateName,
  requiredAccounts,
  variables,
}: {
  templateId: string;
  templateName: string;
  requiredAccounts: LeanLoopTemplateAccountReq[];
  variables: LeanLoopTemplateVariable[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [connections, setConnections] = useState<Record<string, ConnectionState>>({});
  const [formValues, setFormValues] = useState<
    Record<string, Record<string, string>>
  >({});
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const router = useRouter();

  const allConnected = useMemo(
    () => requiredAccounts.every((a) => connections[a.key]),
    [connections, requiredAccounts],
  );

  const allVarsFilled = useMemo(
    () =>
      variables
        .filter((v) => v.required ?? true)
        .every((v) => (variableValues[v.key] ?? '').trim().length > 0),
    [variables, variableValues],
  );

  // Receive credential IDs back from the Google OAuth popup.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as {
        source?: string;
        credentialId?: string;
      } | null;
      if (data?.source !== 'leanloop-oauth' || !data.credentialId) return;
      if (!pending) return;
      setConnections((c) => ({
        ...c,
        [pending]: { credentialId: data.credentialId!, name: 'OAuth account' },
      }));
      setPending(null);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pending]);

  async function connectWithFields(account: LeanLoopTemplateAccountReq) {
    setError(null);
    const spec = CREDENTIAL_SPECS[account.provider];
    const data = formValues[account.key] ?? {};
    setPending(account.key);
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: account.provider,
          name: `${account.label} (${new Date().toISOString().slice(0, 10)})`,
          data,
        }),
      });
      const body = (await res.json()) as {
        credentialId?: string;
        name?: string;
        error?: string;
      };
      if (!res.ok || !body.credentialId) {
        throw new Error(body.error ?? 'Credential creation failed');
      }
      setConnections((c) => ({
        ...c,
        [account.key]: { credentialId: body.credentialId!, name: body.name ?? '' },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
    void spec;
  }

  function connectWithOAuth(account: LeanLoopTemplateAccountReq, url: string) {
    setError(null);
    setPending(account.key);
    window.open(url, 'leanloop-oauth', 'width=520,height=700');
  }

  async function activate() {
    setActivating(true);
    setError(null);
    try {
      const credentials: Record<string, string> = {};
      for (const a of requiredAccounts) {
        const c = connections[a.key];
        if (c) credentials[a.key] = c.credentialId;
      }
      const res = await fetch(`/api/templates/${templateId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials, variables: variableValues }),
      });
      const data = (await res.json()) as { workflowId?: string; error?: string };
      if (!res.ok || !data.workflowId) {
        throw new Error(data.error ?? 'Activation failed');
      }
      setWorkflowId(data.workflowId);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper step={step} />

      {step === 1 && (
        <Panel title="Review template" actionLabel="Continue" onAction={() => setStep(2)}>
          <p className="text-sm text-brand-subtle">
            You&apos;re about to set up <span className="text-white">{templateName}</span>.
            Next, connect the accounts it needs.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {requiredAccounts.map((a) => (
              <li key={a.key} className="flex items-center gap-2 text-brand-text">
                <Plug size={14} className="text-brand-subtle" /> {a.label}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {step === 2 && (
        <Panel
          title="Connect your accounts"
          actionLabel={activating ? 'Activating…' : 'Activate'}
          actionDisabled={!allConnected || !allVarsFilled || activating}
          onAction={activate}
        >
          <div className="flex flex-col gap-4">
            {requiredAccounts.map((a) => {
              const spec = CREDENTIAL_SPECS[a.provider];
              const connection = connections[a.key];
              const busy = pending === a.key;

              return (
                <div
                  key={a.key}
                  className="rounded-md border border-brand-line bg-brand-muted p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white">{a.label}</div>
                      <div className="text-xs text-brand-subtle">{a.provider}</div>
                    </div>
                    {connection ? (
                      <span className="inline-flex items-center gap-1 text-xs text-brand-accent">
                        <Check size={14} /> Connected
                      </span>
                    ) : spec.oauthStart ? (
                      <button
                        onClick={() => connectWithOAuth(a, spec.oauthStart!)}
                        disabled={busy}
                        className="rounded-md bg-brand-accent px-3 py-1.5 text-sm font-medium text-black hover:bg-brand-accentHi transition disabled:opacity-50"
                      >
                        {busy ? 'Waiting…' : 'Connect with Google'}
                      </button>
                    ) : null}
                  </div>

                  {!connection && spec.fields.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {spec.fields.map((f) => (
                        <label key={f.key} className="flex flex-col gap-1 text-xs">
                          <span className="text-brand-subtle">{f.label}</span>
                          <input
                            type={f.type === 'password' ? 'password' : 'text'}
                            className="rounded-md border border-brand-line bg-brand-ink px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-accent"
                            value={formValues[a.key]?.[f.key] ?? ''}
                            onChange={(e) =>
                              setFormValues((v) => ({
                                ...v,
                                [a.key]: { ...(v[a.key] ?? {}), [f.key]: e.target.value },
                              }))
                            }
                          />
                          {f.help && (
                            <span className="text-[10px] text-brand-subtle">{f.help}</span>
                          )}
                        </label>
                      ))}
                      <button
                        onClick={() => connectWithFields(a)}
                        disabled={busy}
                        className="mt-1 self-start rounded-md bg-brand-accent px-3 py-1.5 text-sm font-medium text-black hover:bg-brand-accentHi transition disabled:opacity-50"
                      >
                        {busy ? 'Saving…' : 'Save & connect'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {variables.length > 0 && (
              <div className="rounded-md border border-brand-line bg-brand-muted p-4">
                <div className="text-white">Configuration</div>
                <div className="text-xs text-brand-subtle">
                  Inputs the workflow needs to run.
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  {variables.map((v) => (
                    <label key={v.key} className="flex flex-col gap-1 text-xs">
                      <span className="text-brand-subtle">
                        {v.label}
                        {(v.required ?? true) && <span className="text-brand-danger"> *</span>}
                      </span>
                      <input
                        type="text"
                        placeholder={v.placeholder}
                        className="rounded-md border border-brand-line bg-brand-ink px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-accent"
                        value={variableValues[v.key] ?? ''}
                        onChange={(e) =>
                          setVariableValues((vs) => ({ ...vs, [v.key]: e.target.value }))
                        }
                      />
                      {v.description && (
                        <span className="text-[10px] text-brand-subtle">{v.description}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {error && <div className="text-sm text-brand-danger">{error}</div>}
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel
          title="Activated"
          actionLabel="View logs"
          onAction={() => router.push('/logs')}
        >
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-brand-accent">
              <Check size={16} /> {templateName} is live in n8n.
            </div>
            {workflowId && (
              <div className="text-brand-subtle">
                Workflow ID: <span className="text-brand-text">{workflowId}</span>
              </div>
            )}
          </div>
        </Panel>
      )}

      {activating && (
        <div className="flex items-center gap-2 text-sm text-brand-subtle">
          <Loader2 size={14} className="animate-spin" /> Deploying workflow to n8n…
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ['Select template', 'Connect accounts', 'Activate'];
  return (
    <ol className="flex items-center gap-4 text-sm">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const state = n < step ? 'done' : n === step ? 'current' : 'todo';
        const circle =
          state === 'done'
            ? 'bg-brand-accent text-black'
            : state === 'current'
            ? 'bg-white text-black'
            : 'bg-brand-muted text-brand-subtle';
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${circle}`}
            >
              {n}
            </span>
            <span className={state === 'todo' ? 'text-brand-subtle' : 'text-brand-text'}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Panel({
  title,
  children,
  actionLabel,
  actionDisabled,
  onAction,
}: {
  title: string;
  children: React.ReactNode;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
}) {
  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3">{children}</div>
      <div className="mt-6">
        <button
          onClick={onAction}
          disabled={actionDisabled}
          className="rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-black hover:bg-brand-accentHi transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
