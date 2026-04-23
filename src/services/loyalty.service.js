import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export function calculateEarnedPoints(totalAmount) {
  const amount =
    totalAmount instanceof Prisma.Decimal ? Number(totalAmount.toString()) : Number(totalAmount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount / env.LOYALTY_POINTS_PER_SPEND_UNIT);
}

export function resolveTierByLifetimePoints(lifetimePoints) {
  const points = Number(lifetimePoints) || 0;
  if (points >= env.LOYALTY_PLATINUM_MIN_POINTS) return 'PLATINUM';
  if (points >= env.LOYALTY_GOLD_MIN_POINTS) return 'GOLD';
  if (points >= env.LOYALTY_SILVER_MIN_POINTS) return 'SILVER';
  return 'BRONZE';
}

export async function ensureLoyaltyAccount(tx, customerId) {
  return tx.loyaltyAccount.upsert({
    where: { customerId },
    update: {},
    create: { customerId },
  });
}

export async function awardPointsForPaidInvoice(tx, invoiceId) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      totalAmt: true,
      paymentStatus: true,
      pointsEarned: true,
      appointment: {
        select: {
          customerId: true,
        },
      },
    },
  });
  if (!invoice) {
    throw new HttpError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
  }
  if (invoice.paymentStatus !== 'PAID') {
    return { awarded: false, reason: 'INVOICE_NOT_PAID' };
  }
  if (invoice.pointsEarned > 0) {
    return { awarded: false, reason: 'ALREADY_AWARDED' };
  }
  if (!invoice.appointment?.customerId) {
    throw new HttpError(500, 'Invoice appointment is missing customer', 'INVOICE_CUSTOMER_MISSING');
  }

  const existingEarnTransaction = await tx.loyaltyTransaction.findFirst({
    where: { invoiceId: invoice.id, type: 'EARN' },
    select: { id: true, points: true },
  });
  if (existingEarnTransaction) {
    if (invoice.pointsEarned !== existingEarnTransaction.points) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { pointsEarned: existingEarnTransaction.points },
      });
    }
    return { awarded: false, reason: 'ALREADY_AWARDED' };
  }

  const points = calculateEarnedPoints(invoice.totalAmt);
  if (points <= 0) {
    return { awarded: false, reason: 'ZERO_POINTS' };
  }

  const loyaltyAccount = await ensureLoyaltyAccount(tx, invoice.appointment.customerId);

  const accountAfterIncrement = await tx.loyaltyAccount.update({
    where: { id: loyaltyAccount.id },
    data: {
      totalPoints: { increment: points },
      lifetimePoints: { increment: points },
    },
    select: { id: true, totalPoints: true, lifetimePoints: true, tier: true },
  });

  const nextTier = resolveTierByLifetimePoints(accountAfterIncrement.lifetimePoints);
  const accountAfterTier =
    nextTier === accountAfterIncrement.tier
      ? accountAfterIncrement
      : await tx.loyaltyAccount.update({
          where: { id: loyaltyAccount.id },
          data: { tier: nextTier },
          select: { id: true, totalPoints: true, lifetimePoints: true, tier: true },
        });

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: loyaltyAccount.id,
      invoiceId: invoice.id,
      type: 'EARN',
      points,
      balanceAfter: accountAfterTier.totalPoints,
      description: `Points earned from invoice ${invoice.id}`,
    },
  });

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { pointsEarned: points },
  });

  return {
    awarded: true,
    points,
    balanceAfter: accountAfterTier.totalPoints,
    tier: accountAfterTier.tier,
  };
}
import { prisma } from '../config/db.js';

export const getLoyaltyAccount = async (customerId) => {
  return await prisma.loyaltyAccount.findUnique({
    where: { customerId },
    include: {
      transactions: { orderBy: { createdAt: 'desc' }, take: 10 }
    }
  });
};

export const listTransactions = async (accountId, page, limit) => {
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    prisma.loyaltyTransaction.findMany({
      where: { loyaltyAccountId: accountId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.loyaltyTransaction.count({
      where: { loyaltyAccountId: accountId }
    })
  ]);

  return { transactions, total };
};

export const listAvailableRewards = async () => {
  return await prisma.loyaltyReward.findMany({
    where: { isActive: true },
    orderBy: { pointsCost: 'asc' }
  });
};

export const claimReward = async (customerId, rewardId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Get account and reward information
    const [account, reward] = await Promise.all([
      tx.loyaltyAccount.findUnique({ where: { customerId } }),
      tx.loyaltyReward.findUnique({ where: { id: rewardId, isActive: true } })
    ]);

    if (!account || !reward) return { error: 'NOT_FOUND' };
    if (account.totalPoints < reward.pointsCost) return { error: 'INSUFFICIENT_POINTS' };

    const newBalance = account.totalPoints - reward.pointsCost;

    // 2. Deduct points from the account
    await tx.loyaltyAccount.update({
      where: { customerId },
      data: { totalPoints: newBalance }
    });

    // 3. Create transaction log (balanceAfter is required by schema)
    await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        type: 'REDEEM',
        points: -reward.pointsCost,
        balanceAfter: newBalance,
        description: `Redeemed reward: ${reward.name}`
      }
    });

    // 4. Create CustomerReward record
    return await tx.customerReward.create({
      data: {
        loyaltyAccountId: account.id,
        rewardId: reward.id,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + reward.validDays * 24 * 60 * 60 * 1000)
      }
    });
  });
};