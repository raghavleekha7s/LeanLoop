import type {
  ICredentialType,
  INodeProperties,
  ICredentialTestRequest,
} from 'n8n-workflow';

export class RazorpayApi implements ICredentialType {
  name = 'razorpayApi';
  displayName = 'Razorpay API';
  documentationUrl = 'https://razorpay.com/docs/api/';

  properties: INodeProperties[] = [
    {
      displayName: 'Key ID',
      name: 'keyId',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Key Secret',
      name: 'keySecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
  ];

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://api.razorpay.com',
      url: '/v1/payments?count=1',
      method: 'GET',
    },
  };
}
