import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { applyPayment } from '../src/services/invoice.service.js';
import {
  awardPointsForPaidInvoice,
  calculateEarnedPoints,
  resolveTierByLifetimePoints,
} from '../src/services/loyalty.service.js';

function createMockTx({ totalAmt = '25000.00', paidAmt = '0.00', paymentStatus = 'UNPAID' } = {}) {
  const state = {
    invoice: {
      id: 'inv_1',
      appointmentId: 'appt_1',
      totalAmt: new Prisma.Decimal(totalAmt),
      paidAmt: new Prisma.Decimal(paidAmt),
      paymentStatus,
      pointsEarned: 0,
    },
    appointment: {
      id: 'appt_1',
      customerId: 'cust_1',
      paymentStatus,
    },
    loyaltyAccount: null,
    loyaltyTransactions: [],
  };

  const tx = {
    invoice: {
      async findUnique({ where }) {
        if (where.id !== state.invoice.id) return null;
        return {
          ...state.invoice,
          appointment: { customerId: state.appointment.customerId },
        };
      },
      async update({ where, data }) {
        if (where.id !== state.invoice.id) return null;
        state.invoice = {
          ...state.invoice,
          ...data,
          paidAmt: data.paidAmt ?? state.invoice.paidAmt,
          paymentStatus: data.paymentStatus ?? state.invoice.paymentStatus,
          pointsEarned: data.pointsEarned ?? state.invoice.pointsEarned,
        };
        return { ...state.invoice };
      },
    },
    appointment: {
      async update({ where, data }) {
        if (where.id === state.appointment.id) {
          state.appointment = { ...state.appointment, ...data };
        }
        return state.appointment;
      },
    },
    loyaltyAccount: {
      async upsert({ create }) {
        if (!state.loyaltyAccount) {
          state.loyaltyAccount = {
            id: 'la_1',
            customerId: create.customerId,
            totalPoints: 0,
            lifetimePoints: 0,
            tier: 'BRONZE',
          };
        }
        return { ...state.loyaltyAccount };
      },
      async update({ data }) {
        const totalIncrement = data.totalPoints?.increment ?? 0;
        const lifetimeIncrement = data.lifetimePoints?.increment ?? 0;
        state.loyaltyAccount = {
          ...state.loyaltyAccount,
          totalPoints: state.loyaltyAccount.totalPoints + totalIncrement,
          lifetimePoints: state.loyaltyAccount.lifetimePoints + lifetimeIncrement,
          tier: data.tier ?? state.loyaltyAccount.tier,
        };
        return { ...state.loyaltyAccount };
      },
    },
    loyaltyTransaction: {
      async findFirst({ where }) {
        const found = state.loyaltyTransactions.find(
          (item) => item.invoiceId === where.invoiceId && item.type === where.type,
        );
        return found ? { ...found } : null;
      },
      async create({ data }) {
        const row = { id: `lt_${state.loyaltyTransactions.length + 1}`, ...data };
        state.loyaltyTransactions.push(row);
        return row;
      },
    },
  };

  return { tx, state };
}

test('calculateEarnedPoints uses configured spend unit floor logic', () => {
  assert.equal(calculateEarnedPoints(new Prisma.Decimal('9999')), 0);
  assert.equal(calculateEarnedPoints(new Prisma.Decimal('10000')), 1);
  assert.equal(calculateEarnedPoints(new Prisma.Decimal('29999.99')), 2);
});

test('resolveTierByLifetimePoints maps thresholds correctly', () => {
  assert.equal(resolveTierByLifetimePoints(0), 'BRONZE');
  assert.equal(resolveTierByLifetimePoints(500), 'SILVER');
  assert.equal(resolveTierByLifetimePoints(1500), 'GOLD');
  assert.equal(resolveTierByLifetimePoints(3000), 'PLATINUM');
});

test('awarding points is idempotent for repeated invoice processing', async () => {
  const { tx, state } = createMockTx({ paymentStatus: 'PAID', paidAmt: '25000.00' });

  const first = await awardPointsForPaidInvoice(tx, 'inv_1');
  const second = await awardPointsForPaidInvoice(tx, 'inv_1');

  assert.equal(first.awarded, true);
  assert.equal(second.awarded, false);
  assert.equal(second.reason, 'ALREADY_AWARDED');
  assert.equal(state.invoice.pointsEarned, 2);
  assert.equal(state.loyaltyTransactions.length, 1);
  assert.equal(state.loyaltyAccount.totalPoints, 2);
});

test('applyPayment awards points only once when becoming paid', async () => {
  const { tx, state } = createMockTx({ paymentStatus: 'UNPAID', paidAmt: '0.00' });

  await applyPayment(tx, 'inv_1', { amount: '25000.00', method: 'CASH' });
  await awardPointsForPaidInvoice(tx, 'inv_1');

  assert.equal(state.invoice.paymentStatus, 'PAID');
  assert.equal(state.appointment.paymentStatus, 'PAID');
  assert.equal(state.invoice.pointsEarned, 2);
  assert.equal(state.loyaltyTransactions.length, 1);
});
