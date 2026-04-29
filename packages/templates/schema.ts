/**
 * LeanLoop template contract.
 *
 * A template is a self-contained recipe: metadata for the UI + an n8n
 * workflow definition that gets POSTed to the engine when the user hits
 * "Activate". Credentials are injected at activation time using the OAuth
 * connections the user made in step 2 of the setup flow.
 *
 * Templates live as .json files under packages/templates/ so that non-devs
 * can contribute them without touching TypeScript.
 */

export type TemplateCategory = 'Sales' | 'Finance' | 'Logistics' | 'Support' | 'Ops';

export type AccountProvider =
  | 'whatsapp'
  | 'google-sheets'
  | 'razorpay'
  | 'tally'
  | 'shiprocket'
  | 'gst-invoice'
  | 'gmail'
  | 'generic-oauth';

export interface TemplateAccountReq {
  /** n8n credential parameter name the activator should populate. */
  key: string;
  provider: AccountProvider;
  /** User-facing label for the OAuth connect step. */
  label: string;
}

export interface LeanLoopTemplate {
  /** Stable identifier; used in URLs and activation requests. */
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  requiredAccounts: TemplateAccountReq[];

  /**
   * n8n workflow JSON — the same shape you'd get from "Export workflow" in
   * the n8n editor. Creds are referenced by placeholder keys that match
   * `requiredAccounts[].key` and get substituted at activation.
   */
  n8nWorkflow: {
    name: string;
    nodes: unknown[];
    connections: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
}
