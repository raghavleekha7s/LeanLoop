import type { ICredentialType, INodeProperties } from 'n8n-workflow';

// Shiprocket uses an email/password → JWT flow. We store the login creds;
// the node exchanges them for a JWT at execute time.
export class ShiprocketApi implements ICredentialType {
  name = 'shiprocketApi';
  displayName = 'Shiprocket API';
  documentationUrl = 'https://apidocs.shiprocket.in/';

  properties: INodeProperties[] = [
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ];
}
