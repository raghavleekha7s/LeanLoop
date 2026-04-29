import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const API_BASE = 'https://apiv2.shiprocket.in/v1/external';

export class Shiprocket implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Shiprocket',
    name: 'shiprocket',
    icon: 'file:shiprocket.svg',
    group: ['transform'],
    version: 1,
    description: 'Create orders and track shipments on Shiprocket',
    defaults: { name: 'Shiprocket' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'shiprocketApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Create Custom Order', value: 'createOrder' },
          { name: 'Track Shipment (AWB)', value: 'trackAwb' },
          { name: 'Cancel Order', value: 'cancelOrder' },
        ],
        default: 'trackAwb',
      },
      {
        displayName: 'AWB',
        name: 'awb',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { operation: ['trackAwb'] } },
      },
      {
        displayName: 'Order ID',
        name: 'orderId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { operation: ['cancelOrder'] } },
      },
      {
        displayName: 'Order Payload (JSON)',
        name: 'orderPayload',
        type: 'json',
        default: '{}',
        required: true,
        displayOptions: { show: { operation: ['createOrder'] } },
        description: 'See Shiprocket /orders/create/adhoc docs for required fields',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const { email, password } = (await this.getCredentials('shiprocketApi')) as {
      email: string;
      password: string;
    };

    // Fresh JWT per execution. Shiprocket tokens last 10 days but we don't
    // cache across executions — keeps the node stateless.
    const auth = (await this.helpers.httpRequest({
      method: 'POST',
      url: `${API_BASE}/auth/login`,
      body: { email, password },
      json: true,
    })) as { token: string };

    if (!auth?.token) {
      throw new NodeOperationError(this.getNode(), 'Shiprocket auth failed');
    }
    const headers = { Authorization: `Bearer ${auth.token}` };

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;

      let response: unknown;
      if (operation === 'trackAwb') {
        const awb = this.getNodeParameter('awb', i) as string;
        response = await this.helpers.httpRequest({
          method: 'GET',
          url: `${API_BASE}/courier/track/awb/${encodeURIComponent(awb)}`,
          headers,
          json: true,
        });
      } else if (operation === 'createOrder') {
        const payload = this.getNodeParameter('orderPayload', i) as object;
        response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${API_BASE}/orders/create/adhoc`,
          headers,
          body: payload,
          json: true,
        });
      } else if (operation === 'cancelOrder') {
        const orderId = this.getNodeParameter('orderId', i) as string;
        response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${API_BASE}/orders/cancel`,
          headers,
          body: { ids: [orderId] },
          json: true,
        });
      } else {
        throw new NodeOperationError(this.getNode(), `Unsupported op: ${operation}`);
      }

      returnData.push({ json: response as IDataObject });
    }

    return [returnData];
  }
}
