// Single source of truth for how the wizard collects credentials and how
// they're shipped to n8n.
//
// Each provider declares:
//   - n8nType: the credential `type` name n8n expects
//   - fields:  the inputs the wizard renders in Step 2
//   - oauth:   (optional) if the provider needs an OAuth round-trip
//
// The wizard posts the collected field values to `/api/credentials`, which
// calls n8n's `POST /credentials` endpoint with `{ name, type, data }`.

import type { AccountProvider } from '@/types';

export type FieldType = 'text' | 'password' | 'email';

export interface CredentialField {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
}

export interface CredentialSpec {
  n8nType: string;
  fields: CredentialField[];
  // If set, the wizard opens this URL in a popup instead of showing fields.
  // The callback route then creates the credential server-side.
  oauthStart?: string;
}

export const CREDENTIAL_SPECS: Record<AccountProvider, CredentialSpec> = {
  whatsapp: {
    n8nType: 'whatsAppApi',
    fields: [
      { key: 'accessToken', label: 'Access token', type: 'password' },
      { key: 'phoneNumberId', label: 'Phone number ID', type: 'text' },
      { key: 'businessAccountId', label: 'Business account ID', type: 'text' },
    ],
  },
  'google-sheets': {
    n8nType: 'googleApi',
    fields: [],
    oauthStart: '/api/oauth/google/start?scope=sheets',
  },
  gmail: {
    n8nType: 'googleApi',
    fields: [],
    oauthStart: '/api/oauth/google/start?scope=gmail',
  },
  razorpay: {
    n8nType: 'razorpayApi',
    fields: [
      { key: 'keyId', label: 'Key ID', type: 'text' },
      { key: 'keySecret', label: 'Key Secret', type: 'password' },
    ],
  },
  tally: {
    n8nType: 'tallyApi',
    fields: [
      {
        key: 'host',
        label: 'Tally host URL',
        type: 'text',
        help: 'Usually http://<LAN-IP>:9000',
      },
      { key: 'companyName', label: 'Company name', type: 'text' },
    ],
  },
  shiprocket: {
    n8nType: 'shiprocketApi',
    fields: [
      { key: 'email', label: 'Shiprocket email', type: 'email' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
  },
  'gst-invoice': {
    n8nType: 'gstInvoiceApi',
    fields: [
      { key: 'gstin', label: 'Seller GSTIN', type: 'text' },
      { key: 'legalName', label: 'Legal name', type: 'text' },
      { key: 'addr1', label: 'Address', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'stateCode', label: 'State code (2-digit)', type: 'text' },
      { key: 'pin', label: 'PIN', type: 'text' },
    ],
  },
  'generic-oauth': {
    n8nType: 'httpHeaderAuth',
    fields: [
      { key: 'name', label: 'Header name', type: 'text' },
      { key: 'value', label: 'Header value', type: 'password' },
    ],
  },
};
