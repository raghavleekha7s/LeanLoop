import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class Razorpay implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Razorpay',
    name: 'razorpay',
    icon: 'file:razorpay.svg',
    group: ['transform'],
    version: 1,
    description: 'Interact with the Razorpay API',
    defaults: { name: 'Razorpay' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'razorpayApi', required: true }],
    requestDefaults: {
      baseURL: 'https://api.razorpay.com/v1',
      headers: { 'Content-Type': 'application/json' },
    },
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Payment', value: 'payment' },
          { name: 'Order', value: 'order' },
          { name: 'Refund', value: 'refund' },
        ],
        default: 'payment',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['payment'] } },
        options: [
          { name: 'Get', value: 'get', action: 'Get a payment' },
          { name: 'Capture', value: 'capture', action: 'Capture a payment' },
        ],
        default: 'get',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['order'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create an order' },
          { name: 'Get', value: 'get', action: 'Get an order' },
        ],
        default: 'create',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['refund'] } },
        options: [{ name: 'Create', value: 'create', action: 'Create a refund' }],
        default: 'create',
      },
      {
        displayName: 'Payment ID',
        name: 'paymentId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['payment', 'refund'], operation: ['get', 'capture', 'create'] },
        },
      },
      {
        displayName: 'Amount (paise)',
        name: 'amount',
        type: 'number',
        default: 0,
        required: true,
        displayOptions: {
          show: { operation: ['capture', 'create'] },
        },
        description: 'Amount in the smallest unit (paise for INR)',
      },
      {
        displayName: 'Currency',
        name: 'currency',
        type: 'string',
        default: 'INR',
        displayOptions: { show: { resource: ['order'], operation: ['create'] } },
      },
      {
        displayName: 'Order ID',
        name: 'orderId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['order'], operation: ['get'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const { keyId, keySecret } = (await this.getCredentials('razorpayApi')) as {
      keyId: string;
      keySecret: string;
    };
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;

      let method: 'GET' | 'POST' = 'GET';
      let path = '';
      let body: Record<string, unknown> | undefined;

      if (resource === 'payment' && operation === 'get') {
        path = `/payments/${this.getNodeParameter('paymentId', i)}`;
      } else if (resource === 'payment' && operation === 'capture') {
        method = 'POST';
        path = `/payments/${this.getNodeParameter('paymentId', i)}/capture`;
        body = { amount: this.getNodeParameter('amount', i), currency: 'INR' };
      } else if (resource === 'order' && operation === 'create') {
        method = 'POST';
        path = '/orders';
        body = {
          amount: this.getNodeParameter('amount', i),
          currency: this.getNodeParameter('currency', i),
        };
      } else if (resource === 'order' && operation === 'get') {
        path = `/orders/${this.getNodeParameter('orderId', i)}`;
      } else if (resource === 'refund' && operation === 'create') {
        method = 'POST';
        path = `/payments/${this.getNodeParameter('paymentId', i)}/refund`;
        body = { amount: this.getNodeParameter('amount', i) };
      } else {
        throw new NodeOperationError(
          this.getNode(),
          `Unsupported ${resource}/${operation}`,
        );
      }

      const response = await this.helpers.httpRequest({
        method,
        url: `https://api.razorpay.com/v1${path}`,
        headers: { Authorization: `Basic ${auth}` },
        body,
        json: true,
      });
      returnData.push({ json: response as IDataObject });
    }

    return [returnData];
  }
}
