// Shared types for the dashboard. Mirrors (a subset of) n8n's REST API shapes
// plus LeanLoop-specific template and log structures.

export interface N8nWorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string;
  createdAt: string;
  tags?: { id: string; name: string }[];
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  status: 'success' | 'error' | 'waiting' | 'running' | 'crashed' | 'canceled';
  startedAt: string;
  stoppedAt?: string;
}

export interface DashboardHealth {
  n8nReachable: boolean;
  activeWorkflows: number;
  tasksToday: number;
  failuresToday: number;
  lastCheckedAt: string;
}

export interface HumanReadableLogEntry {
  id: string;
  workflowName: string;
  status: N8nExecution['status'];
  startedAt: string;
  durationMs?: number;
  humanMessage: string;
  // If classification puts this in the retry queue vs dead-letter queue:
  queue?: 'retry' | 'dead-letter' | null;
}

export type AccountProvider =
  | 'whatsapp'
  | 'google-sheets'
  | 'razorpay'
  | 'tally'
  | 'shiprocket'
  | 'gst-invoice'
  | 'gmail'
  | 'generic-oauth';

export interface LeanLoopTemplateAccountReq {
  key: string; // node parameter name to inject credentials into
  provider: AccountProvider;
  label: string; // UI label shown to the user
}

// User-supplied configuration values (sheet IDs, Tally company names, etc.)
// that the wizard collects and the activate route substitutes into the
// workflow JSON via __VAR__<key> placeholders.
export interface LeanLoopTemplateVariable {
  key: string;        // placeholder identifier (e.g. "leanloopSheetId")
  label: string;      // UI label
  placeholder?: string;
  description?: string;
  required?: boolean;
}

export interface LeanLoopTemplate {
  id: string;
  name: string;
  description: string;
  category: 'Sales' | 'Finance' | 'Logistics' | 'Support' | 'Ops';
  requiredAccounts: LeanLoopTemplateAccountReq[];
  // Optional user-supplied scalars referenced as __VAR__<key> in the workflow.
  variables?: LeanLoopTemplateVariable[];
  // An n8n workflow definition (nodes + connections) that will be POSTed to
  // the n8n REST API at activation time. Credentials are injected at that
  // stage based on the user's OAuth connections.
  n8nWorkflow: {
    name: string;
    nodes: unknown[];
    connections: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
}
