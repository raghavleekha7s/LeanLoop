import type { ICredentialType, INodeProperties } from 'n8n-workflow';

// Tally's HTTP-XML gateway runs locally (LAN) on port 9000 by default.
// There's no API key — reachability is the "credential".
export class TallyApi implements ICredentialType {
  name = 'tallyApi';
  displayName = 'Tally Gateway';
  documentationUrl = 'https://tallysolutions.com/tally/tally-odbc-and-http-integration/';

  properties: INodeProperties[] = [
    {
      displayName: 'Host',
      name: 'host',
      type: 'string',
      default: 'http://localhost:9000',
      required: true,
      description: 'URL of the Tally ERP HTTP-XML gateway',
    },
    {
      displayName: 'Company Name',
      name: 'companyName',
      type: 'string',
      default: '',
      required: true,
      description: 'Exact Tally company name to post vouchers into',
    },
  ];
}
