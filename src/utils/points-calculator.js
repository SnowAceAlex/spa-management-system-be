import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

/**
 * Calculate loyalty points earned from invoice total
 * Earning rate: 10 points per $1 spent
 * Math.round(invoiceTotal * 0.1)
 * @param {Decimal} invoiceTotal - Total amount from invoice
 * @returns {number} Points earned
 */
export function calculatePointsEarned(invoiceTotal) {
  const total =
    invoiceTotal instanceof Prisma.Decimal
      ? parseFloat(invoiceTotal.toString())
      : invoiceTotal;

  return Math.round(total * 0.05);
}

/**
 * Create loyalty transaction record
 * Updates loyalty account balance and records transaction
 * @param {string} loyaltyAccountId
 * @param {string} type - EARN | REDEEM | EXPIRE | ADJUST
 * @param {number} points - Positive for earn, negative for redeem/expire
 * @param {string} description - Reason for transaction
 * @param {string} [invoiceId] - Associated invoice (optional)
 * @returns {Promise<{transaction, updatedBalance}>}
 */
export async function createLoyaltyTransaction(
  loyaltyAccountId,
  type,
  points,
  description,
  invoiceId = null
) {
  const loyaltyAccount = await prisma.loyaltyAccount.findUnique({
    where: { id: loyaltyAccountId },
    select: { id: true, totalPoints: true, lifetimePoints: true },
  });

  if (!loyaltyAccount) {
    throw new Error(`Loyalty account not found: ${loyaltyAccountId}`);
  }

  // Calculate new balance
  const newBalance = Math.max(0, loyaltyAccount.totalPoints + points);
  const newLifetimePoints =
    type === 'EARN'
      ? loyaltyAccount.lifetimePoints + points
      : loyaltyAccount.lifetimePoints;

  // Create transaction
  const transaction = await prisma.loyaltyTransaction.create({
    data: {
      loyaltyAccountId,
      type,
      points,
      balanceAfter: newBalance,
      description,
      ...(invoiceId && { invoiceId }),
    },
  });

  // Update account balance
  const updatedAccount = await prisma.loyaltyAccount.update({
    where: { id: loyaltyAccountId },
    data: {
      totalPoints: newBalance,
      lifetimePoints: newLifetimePoints,
    },
    select: { totalPoints: true, lifetimePoints: true, tier: true },
  });

  return {
    transaction,
    updatedBalance: updatedAccount.totalPoints,
    updatedLifetimePoints: updatedAccount.lifetimePoints,
  };
}

/**
 * Schedule loyalty points expiration (12 months from earn date)
 * Creates EXPIRE transaction for old points
 * Run this via cron job daily
 * @returns {Promise<{expiredCount: number}>}
 */
export async function expireOldLoyaltyPoints() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Find all EARN transactions older than 12 months
  const earningTransactions = await prisma.loyaltyTransaction.findMany({
    where: {
      type: 'EARN',
      createdAt: { lt: twelveMonthsAgo },
    },
    include: { loyaltyAccount: true },
  });

  let expiredCount = 0;

  for (const transaction of earningTransactions) {
    // Subtract points if not already redeemed/expired
    await createLoyaltyTransaction(
      transaction.loyaltyAccountId,
      'EXPIRE',
      -transaction.points,
      `Points expired (earned on ${transaction.createdAt.toISOString()})`
    );
    expiredCount++;
  }

  return { expiredCount };
}
