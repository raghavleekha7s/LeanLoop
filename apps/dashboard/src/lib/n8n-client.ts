// Server-side n8n REST API client. Keeps the n8n API key out of the browser —
// all calls go through Next.js server components or route handlers.
//
// Reference: https://docs.n8n.io/api/

import type {
  DashboardHealth,
  HumanReadableLogEntry,
  N8nExecution,
  N8nWorkflowSummary,
} from '@/types';

const BASE_URL = process.env.N8N_INTERNAL_URL ?? 'http://n8n:5678';
const API_KEY = process.env.N8N_API_KEY ?? '';

function headers() {
  // n8n accepts the API key via the X-N8N-API-KEY header.
  return {
    'X-N8N-API-KEY': API_KEY,
    'Content-Type': 'application/json',
  };
}

async function n8nFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    // Never cache n8n state — dashboard needs fresh numbers.
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`n8n ${path} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function listWorkflows(): Promise<N8nWorkflowSummary[]> {
  const data = await n8nFetch<{ data: N8nWorkflowSummary[] }>('/workflows');
  return data.data;
}

export async function listExecutions(limit = 100): Promise<N8nExecution[]> {
  const data = await n8nFetch<{ data: N8nExecution[] }>(
    `/executions?limit=${limit}&includeData=false`,
  );
  return data.data;
}

export async function createWorkflow(workflow: {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
}): Promise<N8nWorkflowSummary> {
  return n8nFetch<N8nWorkflowSummary>('/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow),
  });
}

export async function activateWorkflow(id: string): Promise<void> {
  await n8nFetch(`/workflows/${id}/activate`, { method: 'POST' });
}

// n8n's "Retry Execution" endpoint reruns a failed execution with the same
// input data. Used by the retry queue processor.
export async function retryExecution(executionId: string): Promise<void> {
  await n8nFetch(`/executions/${executionId}/retry`, { method: 'POST' });
}

export interface CreateCredentialInput {
  name: string;
  type: string; // n8n credential type name, e.g. "googleApi", "razorpayApi"
  data: Record<string, unknown>;
}

export async function createCredential(
  input: CreateCredentialInput,
): Promise<{ id: string; name: string }> {
  return n8nFetch('/credentials', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Aggregates the pieces a dashboard Home page needs into a single call.
export async function getDashboardHealth(): Promise<DashboardHealth> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    const [workflows, executions] = await Promise.all([
      listWorkflows(),
      listExecutions(500),
    ]);
    const today = executions.filter((e) => new Date(e.startedAt) >= startOfDay);
    return {
      n8nReachable: true,
      activeWorkflows: workflows.filter((w) => w.active).length,
      tasksToday: today.length,
      failuresToday: today.filter((e) => e.status === 'error' || e.status === 'crashed')
        .length,
      lastCheckedAt: now.toISOString(),
    };
  } catch {
    return {
      n8nReachable: false,
      activeWorkflows: 0,
      tasksToday: 0,
      failuresToday: 0,
      lastCheckedAt: now.toISOString(),
    };
  }
}

// Translates raw n8n execution rows into something a non-technical operator
// can scan. The full error payload is intentionally hidden.
export async function getHumanReadableLogs(limit = 50): Promise<HumanReadableLogEntry[]> {
  const [workflows, executions] = await Promise.all([
    listWorkflows().catch(() => [] as N8nWorkflowSummary[]),
    listExecutions(limit).catch(() => [] as N8nExecution[]),
  ]);
  const nameById = new Map(workflows.map((w) => [w.id, w.name]));

  return executions.map((e) => {
    const workflowName = nameById.get(e.workflowId) ?? `Workflow ${e.workflowId}`;
    const duration =
      e.stoppedAt && e.startedAt
        ? new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime()
        : undefined;
    return {
      id: e.id,
      workflowName,
      status: e.status,
      startedAt: e.startedAt,
      durationMs: duration,
      humanMessage: describe(e, workflowName),
      queue: classifyQueue(e),
    };
  });
}

function describe(e: N8nExecution, workflowName: string): string {
  switch (e.status) {
    case 'success':
      return `${workflowName} ran successfully.`;
    case 'error':
      return `${workflowName} failed — we'll retry automatically.`;
    case 'crashed':
      return `${workflowName} crashed — moved to the dead-letter queue for review.`;
    case 'waiting':
      return `${workflowName} is waiting for an external response.`;
    case 'running':
      return `${workflowName} is still running.`;
    case 'canceled':
      return `${workflowName} was canceled.`;
    default:
      return `${workflowName}: status ${e.status}.`;
  }
}

function classifyQueue(e: N8nExecution): HumanReadableLogEntry['queue'] {
  if (e.status === 'error') return 'retry';
  if (e.status === 'crashed') return 'dead-letter';
  return null;
}
