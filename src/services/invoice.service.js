import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/httpError.js';
import { awardPointsForPaidInvoice } from './loyalty.service.js';

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf',
  'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

export function isZeroDecimalCurrency(currency) {
  return ZERO_DECIMAL_CURRENCIES.has(String(currency).toLowerCase());
}

export function toStripeUnitAmount(amount, currency) {
  const numeric = amount instanceof Prisma.Decimal ? Number(amount.toString()) : Number(amount);
  if (!Number.isFinite(numeric)) return 0;
  if (isZeroDecimalCurrency(currency)) {
    return Math.round(numeric);
  }
  return Math.round(numeric * 100);
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function generateInvoiceNumber() {
  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1, 2)}`;
  const random = Math.floor(Math.random() * 1_000_000);
  return `INV-${yearMonth}-${pad(random, 6)}`;
}

export async function createInvoiceForAppointment(tx, appointmentId) {
  const existing = await tx.invoice.findUnique({
    where: { appointmentId },
  });
  if (existing) return existing;

  const appointment = await tx.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, totalAmount: true },
  });
  if (!appointment) {
    throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  }

  const subtotal = new Prisma.Decimal(appointment.totalAmount);
  const discountAmt = new Prisma.Decimal(0);
  const taxAmt = new Prisma.Decimal(0);
  const totalAmt = subtotal.minus(discountAmt).plus(taxAmt);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const invoice = await tx.invoice.create({
        data: {
          appointmentId: appointment.id,
          invoiceNumber: generateInvoiceNumber(),
          subtotal,
          discountAmt,
          taxAmt,
          totalAmt,
          paidAmt: new Prisma.Decimal(0),
          paymentStatus: 'UNPAID',
        },
      });
      return invoice;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        Array.isArray(err.meta?.target) &&
        err.meta.target.includes('invoiceNumber')
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new HttpError(500, 'Failed to generate unique invoice number', 'INVOICE_NUMBER_CONFLICT');
}

export async function applyPayment(
  tx,
  invoiceId,
  { amount, method, stripePaymentIntentId, stripeCheckoutSessionId },
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      appointmentId: true,
      totalAmt: true,
      paidAmt: true,
      paymentStatus: true,
    },
  });
  if (!invoice) {
    throw new HttpError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
  }
  if (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'REFUNDED') {
    throw new HttpError(409, 'Invoice is not payable', 'INVOICE_NOT_PAYABLE');
  }

  const paymentAmount = new Prisma.Decimal(amount);
  if (paymentAmount.lessThanOrEqualTo(0)) {
    throw new HttpError(400, 'Payment amount must be positive', 'VALIDATION_ERROR');
  }

  const newPaidAmt = new Prisma.Decimal(invoice.paidAmt).plus(paymentAmount);
  const totalAmt = new Prisma.Decimal(invoice.totalAmt);

  let paymentStatus = 'PARTIALLY_PAID';
  let paidAt = null;
  if (newPaidAmt.greaterThanOrEqualTo(totalAmt)) {
    paymentStatus = 'PAID';
    paidAt = new Date();
  }

  const updated = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      paidAmt: newPaidAmt,
      paymentStatus,
      paymentMethod: method,
      paidAt: paidAt ?? undefined,
      stripePaymentIntentId: stripePaymentIntentId ?? undefined,
      stripeCheckoutSessionId: stripeCheckoutSessionId ?? undefined,
    },
  });

  await tx.appointment.update({
    where: { id: invoice.appointmentId },
    data: { paymentStatus },
  });

  if (invoice.paymentStatus !== 'PAID' && paymentStatus === 'PAID') {
    await awardPointsForPaidInvoice(tx, invoice.id);
  }

  return updated;
}

export function formatInvoice(invoice) {
  if (!invoice) return invoice;
  return {
    ...invoice,
    subtotal: invoice.subtotal?.toString?.() ?? invoice.subtotal,
    discountAmt: invoice.discountAmt?.toString?.() ?? invoice.discountAmt,
    taxAmt: invoice.taxAmt?.toString?.() ?? invoice.taxAmt,
    totalAmt: invoice.totalAmt?.toString?.() ?? invoice.totalAmt,
    paidAmt: invoice.paidAmt?.toString?.() ?? invoice.paidAmt,
  };
}
