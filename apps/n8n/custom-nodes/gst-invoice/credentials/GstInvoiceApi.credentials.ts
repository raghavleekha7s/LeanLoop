import type { ICredentialType, INodeProperties } from 'n8n-workflow';

// Seller identity used on every invoice — stored as a credential so it's
// filled once per account instead of per workflow.
export class GstInvoiceApi implements ICredentialType {
  name = 'gstInvoiceApi';
  displayName = 'GST Invoice (Seller)';

  properties: INodeProperties[] = [
    {
      displayName: 'Seller GSTIN',
      name: 'gstin',
      type: 'string',
      default: '',
      required: true,
      description: '15-char GSTIN',
    },
    {
      displayName: 'Legal Name',
      name: 'legalName',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Address Line 1',
      name: 'addr1',
      type: 'string',
      default: '',
      required: true,
    },
    { displayName: 'City', name: 'city', type: 'string', default: '', required: true },
    {
      displayName: 'State Code (2-digit)',
      name: 'stateCode',
      type: 'string',
      default: '',
      required: true,
      description: 'e.g. 27 for Maharashtra, 29 for Karnataka',
    },
    { displayName: 'PIN', name: 'pin', type: 'string', default: '', required: true },
  ];
}
