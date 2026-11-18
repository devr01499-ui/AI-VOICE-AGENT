import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface GenerateInvoiceParams {
  userId: string;
  paymentTransactionId: string;
  amountInr: number;
  planKey: string;
  planName: string;
  minutesCredited: number;
}

/** Escapes text for HTML (customer names and plan names are user/admin controlled). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Indian financial year (April–March) in IST, e.g. "FY26-27" for 2026-11-18. */
export function financialYearLabel(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `FY${String(start % 100).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** GST split: CGST+SGST when supplier and recipient GSTINs are in the same state, else IGST. */
export function gstSplit(sellerGstin: string | null | undefined, buyerGstin: string | null | undefined): 'intra' | 'inter' | 'unknown' {
  if (!sellerGstin || !buyerGstin) return 'unknown';
  return sellerGstin.slice(0, 2) === buyerGstin.slice(0, 2) ? 'intra' : 'inter';
}

export class InvoiceService {
  /**
   * Generates a sequential GST-compliant invoice record atomically.
   */
  static async generateInvoice(params: GenerateInvoiceParams, tx?: Prisma.TransactionClient) {
    const { userId, paymentTransactionId, amountInr, planKey, planName, minutesCredited } = params;

    const run = async (prismaTx: Prisma.TransactionClient) => {
      // Check if invoice already exists for this payment transaction
      const existing = await prismaTx.invoice.findUnique({
        where: { paymentTransactionId },
      });
      if (existing) return existing;

      // Fetch user details and any uploaded GSTIN
      const user = await prismaTx.user.findUnique({
        where: { id: userId },
        include: {
          kycDocuments: {
            where: { status: 'verified', gstin: { not: null } },
            take: 1,
          },
        },
      });

      if (!user) throw new Error(`USER_NOT_FOUND: User ${userId} not found.`);

      const buyerGstin = user.companyGstin || user.kycDocuments[0]?.gstin || null;
      // The company's own GSTIN, from configuration only. (A hard-coded fallback used to print a
      // GSTIN that is not ours on every invoice.) Without it the document is a receipt, not a tax invoice.
      const sellerGstin = (process.env.COMPANY_GSTIN || '').trim().toUpperCase() || null;
      if (!sellerGstin) logger.error('[INVOICE] COMPANY_GSTIN is not configured: issuing a payment receipt, not a tax invoice');

      // Consecutive number per Indian financial year (GST rule 46), e.g. CLR-FY26-27-0001.
      // A transaction-scoped lock makes concurrent purchases take numbers one after another
      // (a plain count gave two purchases the same number and failed the second one).
      await prismaTx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'invoice_number_sequence');
      const prefix = `CLR-${financialYearLabel()}-`;
      const countThisYear = await prismaTx.invoice.count({ where: { invoiceNumber: { startsWith: prefix } } });
      const invoiceNumber = `${prefix}${String(countThisYear + 1).padStart(4, '0')}`;

      // GST Calculation (18% inclusive SaaS standard in India)
      const gstRate = 18.0;
      const subtotalInr = parseFloat((amountInr / (1 + gstRate / 100)).toFixed(2));
      const gstAmountInr = parseFloat((amountInr - subtotalInr).toFixed(2));

      const invoice = await prismaTx.invoice.create({
        data: {
          invoiceNumber,
          userId,
          paymentTransactionId,
          amountInr,
          gstRate,
          gstAmountInr,
          subtotalInr,
          buyerGstin,
          buyerName: user.fullName || 'Claritiy Customer',
          buyerEmail: user.email,
          sellerGstin,
          planKey,
          planName,
          minutesCredited,
          status: 'paid',
        },
      });

      // Update payment transaction with generated invoice number
      await prismaTx.paymentTransaction.update({
        where: { id: paymentTransactionId },
        data: { invoiceNo: invoiceNumber },
      });

      logger.info('[INVOICE_GENERATED] Successfully generated GST invoice', {
        invoiceNumber,
        userId,
        amountInr,
        buyerGstin,
      });

      return invoice;
    };

    return tx ? await run(tx) : await prisma.$transaction(run);
  }

  /**
   * Retrieves all invoices for a customer to display on the user dashboard settings.
   */
  static async getCustomerInvoices(userId: string) {
    return await prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generates a printable HTML receipt representation for user download.
   */
  static generateInvoiceHtml(invoice: any) {
    const e = escapeHtml;
    const isTaxInvoice = Boolean(invoice.sellerGstin);
    const title = isTaxInvoice ? 'TAX INVOICE' : 'PAYMENT RECEIPT';
    const split = gstSplit(invoice.sellerGstin, invoice.buyerGstin);
    const gst = Number(invoice.gstAmountInr || 0);
    const half = (gst / 2).toFixed(2);
    const taxRows = split === 'intra'
      ? `<div class="total-row"><span>CGST (${Number(invoice.gstRate) / 2}%):</span><span>₹${half}</span></div><div class="total-row"><span>SGST (${Number(invoice.gstRate) / 2}%):</span><span>₹${(gst - Number(half)).toFixed(2)}</span></div>`
      : split === 'inter'
        ? `<div class="total-row"><span>IGST (${Number(invoice.gstRate)}%):</span><span>₹${gst.toFixed(2)}</span></div>`
        : `<div class="total-row"><span>GST (${Number(invoice.gstRate)}%):</span><span>₹${gst.toFixed(2)}</span></div>`;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} - ${e(invoice.invoiceNumber)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .brand { font-size: 24px; font-weight: bold; color: #0f172a; }
    .brand span { color: #6366f1; }
    .meta { text-align: right; font-size: 14px; color: #64748b; }
    .invoice-title { font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 5px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 30px 0; }
    .section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; font-size: 13px; color: #64748b; }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .text-right { text-align: right; }
    .total-section { margin-top: 20px; width: 300px; margin-left: auto; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .total-row.grand { font-size: 18px; font-weight: bold; border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 10px; }
    .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Claritiy<span>Voice</span></div>
      <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Conversational AI Telephony Platform</div>
    </div>
    <div class="meta">
      <div class="invoice-title">${title}</div>
      <div><strong>${isTaxInvoice ? 'Invoice' : 'Receipt'} #:</strong> ${e(invoice.invoiceNumber)}</div>
      <div><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
      <div><strong>Status:</strong> <span style="color: #16a34a; font-weight: 600;">PAID</span></div>
    </div>
  </div>

  <div class="grid">
    <div class="section">
      <h3>Supplier Details</h3>
      <div><strong>Claritiy Voice Telephony Services</strong></div>
      <div>GSTIN: ${isTaxInvoice ? e(invoice.sellerGstin) : 'Not registered (receipt only)'}</div>
      <div>India</div>
    </div>
    <div class="section">
      <h3>Customer Details</h3>
      <div><strong>${e(invoice.buyerName)}</strong></div>
      <div>${e(invoice.buyerEmail)}</div>
      ${invoice.buyerGstin ? `<div>GSTIN: <strong>${e(invoice.buyerGstin)}</strong></div>` : '<div>Unregistered Consumer (B2C)</div>'}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">Calling Minutes</th>
        <th class="text-right">Taxable Value (INR)</th>
        <th class="text-right">GST (${invoice.gstRate}%)</th>
        <th class="text-right">Total (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${e(invoice.planName)} Plan</strong><br />
          <span style="font-size: 12px; color: #64748b;">SAC Code: 998413 (Telecommunications Services)</span>
        </td>
        <td class="text-right">${invoice.minutesCredited} mins</td>
        <td class="text-right">₹${invoice.subtotalInr.toFixed(2)}</td>
        <td class="text-right">₹${invoice.gstAmountInr.toFixed(2)}</td>
        <td class="text-right">₹${invoice.amountInr.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-row">
      <span>Subtotal (Net):</span>
      <span>₹${invoice.subtotalInr.toFixed(2)}</span>
    </div>
    ${taxRows}
    <div class="total-row grand">
      <span>Total Paid:</span>
      <span>₹${invoice.amountInr.toFixed(2)}</span>
    </div>
  </div>

  <div class="footer">
    This is a computer-generated ${isTaxInvoice ? 'tax invoice' : 'payment receipt'} and requires no physical signature. Claritiy Voice Platform.
  </div>
</body>
</html>`;
  }
}
