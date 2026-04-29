import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Tally integration via its HTTP-XML gateway. We post a Sales Voucher XML
// envelope — the minimum needed to register a payment as revenue in the books.
//
// Full voucher schema: https://help.tallysolutions.com/article/Tally.ERP9/Tally_Integration/XML_Format/Sales_Voucher_XML_Format.htm

export class Tally implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Tally',
    name: 'tally',
    icon: 'file:tally.svg',
    group: ['transform'],
    version: 1,
    description: 'Post vouchers to Tally ERP via the HTTP-XML gateway',
    defaults: { name: 'Tally' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'tallyApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Post Sales Voucher', value: 'postSalesVoucher' },
        ],
        default: 'postSalesVoucher',
      },
      {
        displayName: 'Voucher Date',
        name: 'date',
        type: 'string',
        default: '={{$now.format("yyyyMMdd")}}',
        required: true,
        description: 'YYYYMMDD — Tally expects an 8-digit date',
      },
      {
        displayName: 'Party Ledger Name',
        name: 'partyLedger',
        type: 'string',
        default: '',
        required: true,
      },
      {
        displayName: 'Sales Ledger Name',
        name: 'salesLedger',
        type: 'string',
        default: 'Sales Accounts',
        required: true,
      },
      {
        displayName: 'Amount (INR)',
        name: 'amount',
        type: 'number',
        default: 0,
        required: true,
      },
      {
        displayName: 'Narration',
        name: 'narration',
        type: 'string',
        default: '',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const { host, companyName } = (await this.getCredentials('tallyApi')) as {
      host: string;
      companyName: string;
    };

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      if (operation !== 'postSalesVoucher') {
        throw new NodeOperationError(this.getNode(), `Unsupported op: ${operation}`);
      }

      const date = this.getNodeParameter('date', i) as string;
      const partyLedger = this.getNodeParameter('partyLedger', i) as string;
      const salesLedger = this.getNodeParameter('salesLedger', i) as string;
      const amount = this.getNodeParameter('amount', i) as number;
      const narration = (this.getNodeParameter('narration', i) as string) ?? '';

      const xml = buildSalesVoucherXml({
        company: companyName,
        date,
        partyLedger,
        salesLedger,
        amount,
        narration,
      });

      const response = await this.helpers.httpRequest({
        method: 'POST',
        url: host,
        headers: { 'Content-Type': 'text/xml' },
        body: xml,
      });

      returnData.push({ json: { ok: true, response: String(response) } });
    }

    return [returnData];
  }
}

function buildSalesVoucherXml(v: {
  company: string;
  date: string;
  partyLedger: string;
  salesLedger: string;
  amount: number;
  narration: string;
}): string {
  const xe = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${xe(v.company)}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${v.date}</DATE>
            <NARRATION>${xe(v.narration)}</NARRATION>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>${xe(v.partyLedger)}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xe(v.partyLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${v.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xe(v.salesLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${v.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
