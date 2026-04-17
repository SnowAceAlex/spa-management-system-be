import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { getStripe } from '../config/stripe.js';
import { applyPayment, isZeroDecimalCurrency } from '../services/invoice.service.js';

function fromStripeUnitAmount(unitAmount, currency) {
  if (unitAmount == null) return 0;
  if (isZeroDecimalCurrency(currency)) {
    return Number(unitAmount);
  }
  return Number(unitAmount) / 100;
}

export async function stripeWebhook(req, res) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] Stripe not configured');
    return res.status(500).send('Stripe not configured');
  }

  const stripe = getStripe();
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const invoiceId = session.metadata?.invoiceId;
        if (!invoiceId) {
          console.warn('[stripe-webhook] checkout.session.completed missing invoiceId metadata');
          break;
        }

        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: { id: true, paymentStatus: true, totalAmt: true },
        });
        if (!invoice) {
          console.warn(`[stripe-webhook] Invoice ${invoiceId} not found`);
          break;
        }
        if (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'REFUNDED') {
          break;
        }

        const currency = session.currency || env.STRIPE_CURRENCY;
        const paidFromStripe = fromStripeUnitAmount(
          session.amount_total ?? session.amount_subtotal ?? 0,
          currency,
        );
        const amount = paidFromStripe > 0 ? paidFromStripe : Number(invoice.totalAmt.toString());

        await prisma.$transaction(async (tx) => {
          await applyPayment(tx, invoiceId, {
            amount,
            method: 'STRIPE',
            stripePaymentIntentId:
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
            stripeCheckoutSessionId: session.id,
          });
        });
        break;
      }

      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        break;

      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('[stripe-webhook] DB error:', err.code, err.message);
    } else {
      console.error('[stripe-webhook] Handler error:', err);
    }
    res.status(500).json({ received: false });
  }
}
