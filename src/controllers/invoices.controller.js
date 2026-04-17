import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { getStripe } from '../config/stripe.js';
import {
  applyPayment,
  createInvoiceForAppointment,
  formatInvoice,
  toStripeUnitAmount,
} from '../services/invoice.service.js';

const INVOICE_INCLUDE = {
  appointment: {
    select: {
      id: true,
      customerId: true,
      staffId: true,
      scheduledAt: true,
      endsAt: true,
      status: true,
      services: {
        include: {
          service: { select: { id: true, name: true, price: true } },
        },
      },
    },
  },
};

function formatAppointmentSnapshot(appointment) {
  if (!appointment) return appointment;
  return {
    ...appointment,
    services: appointment.services?.map((item) => ({
      ...item,
      priceSnapshot: item.priceSnapshot?.toString?.() ?? item.priceSnapshot,
      service: item.service
        ? { ...item.service, price: item.service.price?.toString?.() ?? item.service.price }
        : item.service,
    })),
  };
}

function formatInvoiceWithAppointment(invoice) {
  const base = formatInvoice(invoice);
  if (invoice?.appointment) {
    base.appointment = formatAppointmentSnapshot(invoice.appointment);
  }
  return base;
}

async function resolveActorProfile(user) {
  if (user.role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      throw new HttpError(403, 'Customer profile not found', 'CUSTOMER_PROFILE_NOT_FOUND');
    }
    return { customerId: customer.id };
  }
  if (user.role === 'STAFF') {
    const staff = await prisma.staff.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!staff) {
      throw new HttpError(403, 'Staff profile not found', 'STAFF_PROFILE_NOT_FOUND');
    }
    return { staffId: staff.id };
  }
  return {};
}

async function loadInvoiceWithPermission(req, { expectPayable = false } = {}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: INVOICE_INCLUDE,
  });
  if (!invoice) {
    throw new HttpError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
  }

  const actor = await resolveActorProfile(req.user);
  if (req.user.role === 'CUSTOMER' && invoice.appointment.customerId !== actor.customerId) {
    throw new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN');
  }
  if (req.user.role === 'STAFF' && invoice.appointment.staffId !== actor.staffId) {
    throw new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN');
  }

  if (expectPayable && (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'REFUNDED')) {
    throw new HttpError(409, 'Invoice is not payable', 'INVOICE_NOT_PAYABLE');
  }

  return invoice;
}

export async function generateInvoiceForAppointment(req, res, next) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, customerId: true, staffId: true },
    });
    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    if (req.user.role === 'STAFF') {
      const staff = await prisma.staff.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!staff || staff.id !== appointment.staffId) {
        throw new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN');
      }
    }

    if (appointment.status !== 'COMPLETED') {
      throw new HttpError(
        409,
        'Appointment must be completed before generating invoice',
        'APPOINTMENT_NOT_COMPLETED',
      );
    }

    const existing = await prisma.invoice.findUnique({
      where: { appointmentId: appointment.id },
      include: INVOICE_INCLUDE,
    });
    if (existing) {
      return res.status(200).json({ invoice: formatInvoiceWithAppointment(existing) });
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await createInvoiceForAppointment(tx, appointment.id);
      return tx.invoice.findUnique({ where: { id: created.id }, include: INVOICE_INCLUDE });
    });

    res.status(201).json({ invoice: formatInvoiceWithAppointment(invoice) });
  } catch (err) {
    next(err);
  }
}

export async function listInvoices(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const actor = await resolveActorProfile(req.user);
    const where = {};

    if (req.query.status) {
      where.paymentStatus = req.query.status;
    }
    if (req.query.appointmentId) {
      where.appointmentId = req.query.appointmentId;
    }

    if (req.user.role === 'CUSTOMER') {
      where.appointment = { customerId: actor.customerId };
    } else if (req.user.role === 'STAFF') {
      where.appointment = { staffId: actor.staffId };
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: INVOICE_INCLUDE,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      invoices: invoices.map(formatInvoiceWithAppointment),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceById(req, res, next) {
  try {
    const invoice = await loadInvoiceWithPermission(req);
    res.json({ invoice: formatInvoiceWithAppointment(invoice) });
  } catch (err) {
    next(err);
  }
}

export async function createCheckoutSession(req, res, next) {
  try {
    if (!env.STRIPE_SECRET_KEY) {
      throw new HttpError(500, 'Stripe is not configured', 'STRIPE_NOT_CONFIGURED');
    }

    const invoice = await loadInvoiceWithPermission(req, { expectPayable: true });
    const stripe = getStripe();

    const currency = env.STRIPE_CURRENCY;
    const successUrl = req.body?.successUrl || env.STRIPE_SUCCESS_URL;
    const cancelUrl = req.body?.cancelUrl || env.STRIPE_CANCEL_URL;

    const items = invoice.appointment.services;
    const hasItems = Array.isArray(items) && items.length > 0;

    const lineItems = hasItems
      ? items.map((item) => ({
          price_data: {
            currency,
            product_data: {
              name: item.service?.name || 'Spa Service',
            },
            unit_amount: toStripeUnitAmount(item.priceSnapshot, currency),
          },
          quantity: 1,
        }))
      : [
          {
            price_data: {
              currency,
              product_data: {
                name: `Invoice ${invoice.invoiceNumber || invoice.id}`,
              },
              unit_amount: toStripeUnitAmount(invoice.totalAmt, currency),
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        invoiceId: invoice.id,
        appointmentId: invoice.appointmentId,
      },
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    res.status(201).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(
        new HttpError(409, 'Checkout session already in progress', 'STRIPE_SESSION_CONFLICT'),
      );
    }
    next(err);
  }
}

export async function markInvoicePaid(req, res, next) {
  try {
    const invoice = await loadInvoiceWithPermission(req, { expectPayable: true });
    const { amount, paymentMethod } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      await applyPayment(tx, invoice.id, {
        amount,
        method: paymentMethod,
      });
      return tx.invoice.findUnique({ where: { id: invoice.id }, include: INVOICE_INCLUDE });
    });

    res.json({ invoice: formatInvoiceWithAppointment(updated) });
  } catch (err) {
    next(err);
  }
}
