import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

// Generates a GST-compliant invoice object that matches the GSTN e-invoice
// (INV-01) schema. Output is JSON that downstream nodes can render to PDF
// or forward to the IRP (Invoice Registration Portal) for an IRN.
//
// Schema reference: https://einv-apisandbox.nic.in/version1.03/generate-irn.html

interface LineItem {
  sku: string;
  description: string;
  hsn: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate: number;
}

export class GstInvoice implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'GST Invoice',
    name: 'gstInvoice',
    icon: 'file:gst.svg',
    group: ['transform'],
    version: 1,
    description: 'Generate a GST-compliant invoice (INV-01 schema)',
    defaults: { name: 'GST Invoice' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'gstInvoiceApi', required: true }],
    properties: [
      {
        displayName: 'Invoice Number',
        name: 'invoiceNumber',
        type: 'string',
        default: '',
        required: true,
      },
      {
        displayName: 'Invoice Date',
        name: 'invoiceDate',
        type: 'string',
        default: '={{$now.format("dd/MM/yyyy")}}',
        required: true,
        description: 'DD/MM/YYYY',
      },
      {
        displayName: 'Buyer GSTIN (leave blank for B2C)',
        name: 'buyerGstin',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Buyer Legal Name',
        name: 'buyerName',
        type: 'string',
        default: '',
        required: true,
      },
      {
        displayName: 'Buyer State Code',
        name: 'buyerStateCode',
        type: 'string',
        default: '',
        required: true,
      },
      {
        displayName: 'Line Items (JSON array)',
        name: 'lineItems',
        type: 'json',
        default: '[]',
        required: true,
        description:
          'Array of { sku, description, hsn, quantity, unit, unitPrice, gstRate }',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const seller = (await this.getCredentials('gstInvoiceApi')) as {
      gstin: string;
      legalName: string;
      addr1: string;
      city: string;
      stateCode: string;
      pin: string;
    };

    for (let i = 0; i < items.length; i++) {
      const invoiceNumber = this.getNodeParameter('invoiceNumber', i) as string;
      const invoiceDate = this.getNodeParameter('invoiceDate', i) as string;
      const buyerGstin = this.getNodeParameter('buyerGstin', i) as string;
      const buyerName = this.getNodeParameter('buyerName', i) as string;
      const buyerStateCode = this.getNodeParameter('buyerStateCode', i) as string;
      const lineItems = this.getNodeParameter('lineItems', i) as LineItem[];

      const isIntraState = seller.stateCode === buyerStateCode;
      const lines = lineItems.map((li, idx) => {
        const taxable = li.quantity * li.unitPrice;
        const gst = (taxable * li.gstRate) / 100;
        return {
          SlNo: String(idx + 1),
          PrdDesc: li.description,
          IsServc: 'N',
          HsnCd: li.hsn,
          Qty: li.quantity,
          Unit: li.unit,
          UnitPrice: li.unitPrice,
          TotAmt: taxable,
          AssAmt: taxable,
          GstRt: li.gstRate,
          // Intra-state → split CGST+SGST; inter-state → IGST only.
          IgstAmt: isIntraState ? 0 : gst,
          CgstAmt: isIntraState ? gst / 2 : 0,
          SgstAmt: isIntraState ? gst / 2 : 0,
          TotItemVal: taxable + gst,
        };
      });

      const totals = lines.reduce(
        (t, l) => ({
          AssVal: t.AssVal + l.AssAmt,
          CgstVal: t.CgstVal + l.CgstAmt,
          SgstVal: t.SgstVal + l.SgstAmt,
          IgstVal: t.IgstVal + l.IgstAmt,
          TotInvVal: t.TotInvVal + l.TotItemVal,
        }),
        { AssVal: 0, CgstVal: 0, SgstVal: 0, IgstVal: 0, TotInvVal: 0 },
      );

      const invoice = {
        Version: '1.1',
        TranDtls: {
          TaxSch: 'GST',
          SupTyp: buyerGstin ? 'B2B' : 'B2C',
          RegRev: 'N',
        },
        DocDtls: { Typ: 'INV', No: invoiceNumber, Dt: invoiceDate },
        SellerDtls: {
          Gstin: seller.gstin,
          LglNm: seller.legalName,
          Addr1: seller.addr1,
          Loc: seller.city,
          Pin: Number(seller.pin),
          Stcd: seller.stateCode,
        },
        BuyerDtls: {
          Gstin: buyerGstin || 'URP',
          LglNm: buyerName,
          Pos: buyerStateCode,
          Stcd: buyerStateCode,
        },
        ItemList: lines,
        ValDtls: totals,
      };

      returnData.push({ json: invoice });
    }

    return [returnData];
  }
}
