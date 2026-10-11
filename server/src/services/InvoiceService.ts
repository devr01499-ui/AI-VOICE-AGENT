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
      const sellerGstin = process.env.COMPANY_GSTIN || '27AAACC1206D1ZM'; // Configurable via environment

      // Sequential Invoice Number: CLR-YYYY-XXXX
      const currentYear = new Date().getFullYear();
      const countThisYear = await prismaTx.invoice.count({
        where: {
          createdAt: {
            gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          },
        },
      });
      const sequence = String(countThisYear + 1).padStart(4, '0');
      const invoiceNumber = `CLR-${currentYear}-${sequence}`;

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
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tax Invoice - ${invoice.invoiceNumber}</title>
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
      <div class="invoice-title">TAX INVOICE</div>
      <div><strong>Invoice #:</strong> ${invoice.invoiceNumber}</div>
      <div><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
      <div><strong>Status:</strong> <span style="color: #16a34a; font-weight: 600;">PAID</span></div>
    </div>
  </div>

  <div class="grid">
    <div class="section">
      <h3>Supplier Details</h3>
      <div><strong>Claritiy Voice Telephony Services</strong></div>
      <div>GSTIN: ${invoice.sellerGstin || 'Pending Registration'}</div>
      <div>India</div>
    </div>
    <div class="section">
      <h3>Customer Details</h3>
      <div><strong>${invoice.buyerName}</strong></div>
      <div>${invoice.buyerEmail}</div>
      ${invoice.buyerGstin ? `<div>GSTIN: <strong>${invoice.buyerGstin}</strong></div>` : '<div>Unregistered Consumer (B2C)</div>'}
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
          <strong>${invoice.planName} Plan</strong><br />
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
    <div class="total-row">
      <span>IGST / CGST+SGST (${invoice.gstRate}%):</span>
      <span>₹${invoice.gstAmountInr.toFixed(2)}</span>
    </div>
    <div class="total-row grand">
      <span>Total Paid:</span>
      <span>₹${invoice.amountInr.toFixed(2)}</span>
    </div>
  </div>

  <div class="footer">
    This is a computer-generated tax invoice and requires no physical signature. Claritiy Voice Platform.
  </div>
</body>
</html>`;
  }
}
