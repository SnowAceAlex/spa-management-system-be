import { prisma } from '../config/db.js';

/**
 * Tier thresholds based on lifetime points
 * GUEST: 0–499
 * BRONZE: 500–999
 * SILVER: 1000–1999
 * GOLD: 2000–2999
 * PLATINUM: 3000+
 */
const TIER_THRESHOLDS = {
  GUEST: { min: 0, max: 499 },
  BRONZE: { min: 500, max: 999 },
  SILVER: { min: 1000, max: 1999 },
  GOLD: { min: 2000, max: 2999 },
  PLATINUM: { min: 3000, max: Infinity },
};

/**
 * Discount percentage by tier
 * GUEST: 0%, BRONZE: 5%, SILVER: 10%, GOLD: 15%, PLATINUM: 20%
 */
const TIER_DISCOUNTS = {
  GUEST: 0,
  BRONZE: 5,
  SILVER: 10,
  GOLD: 15,
  PLATINUM: 20,
};

/**
 * Determine tier based on lifetime points
 * @param {number} lifetimePoints
 * @returns {string} Tier name
 */
export function getTierByLifetimePoints(lifetimePoints) {
  if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM.min) return 'PLATINUM';
  if (lifetimePoints >= TIER_THRESHOLDS.GOLD.min) return 'GOLD';
  if (lifetimePoints >= TIER_THRESHOLDS.SILVER.min) return 'SILVER';
  if (lifetimePoints >= TIER_THRESHOLDS.BRONZE.min) return 'BRONZE';
  return 'GUEST';
}

/**
 * Get discount percentage for a tier
 * @param {string} tier
 * @returns {number} Discount percentage
 */
export function getDiscountByTier(tier) {
  return TIER_DISCOUNTS[tier] || 0;
}

/**
 * Calculate points remaining to reach next tier
 * @param {number} currentPoints - Lifetime points
 * @returns {number} Points needed
 */
export function calculatePointsToNextTier(currentPoints) {
  const tierSequence = ['GUEST', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  const currentTier = getTierByLifetimePoints(currentPoints);
  const currentTierIndex = tierSequence.indexOf(currentTier);

  if (currentTierIndex === -1 || currentTierIndex === tierSequence.length - 1) {
    return 0; // Already at PLATINUM or unknown tier
  }

  const nextTier = tierSequence[currentTierIndex + 1];
  const nextTierThreshold = TIER_THRESHOLDS[nextTier].min;
  return Math.max(0, nextTierThreshold - currentPoints);
}

/**
 * Update customer tier based on lifetime points
 * Automatically upgrades tier if lifetime points crossed threshold
 * @param {string} customerId
 * @returns {Promise<{upgraded: boolean, oldTier: string, newTier: string}>}
 */
export async function updateCustomerTier(customerId) {
  const loyaltyAccount = await prisma.loyaltyAccount.findUnique({
    where: { customerId },
    select: { id: true, tier: true, lifetimePoints: true },
  });

  if (!loyaltyAccount) {
    throw new Error(`Loyalty account not found for customer ${customerId}`);
  }

  const newTier = getTierByLifetimePoints(loyaltyAccount.lifetimePoints);
  const oldTier = loyaltyAccount.tier;
  const upgraded = oldTier !== newTier;

  if (upgraded) {
    await prisma.loyaltyAccount.update({
      where: { id: loyaltyAccount.id },
      data: { tier: newTier },
    });
  }

  return { upgraded, oldTier, newTier };
}

/**
 * Get tier info for customer
 * @param {string} customerId
 * @returns {Promise<{currentTier, discountPercentage, lifetimePoints, pointsToNextTier, nextTier}>}
 */
export async function getTierInfo(customerId) {
  const loyaltyAccount = await prisma.loyaltyAccount.findUnique({
    where: { customerId },
    select: { tier: true, lifetimePoints: true },
  });

  if (!loyaltyAccount) {
    return null;
  }

  const discountPercentage = getDiscountByTier(loyaltyAccount.tier);
  const pointsToNextTier = calculatePointsToNextTier(loyaltyAccount.lifetimePoints);

  const tierSequence = ['GUEST', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  const currentTierIndex = tierSequence.indexOf(loyaltyAccount.tier);
  const nextTier =
    currentTierIndex < tierSequence.length - 1
      ? tierSequence[currentTierIndex + 1]
      : null;

  return {
    currentTier: loyaltyAccount.tier,
    discountPercentage,
    lifetimePoints: loyaltyAccount.lifetimePoints,
    pointsToNextTier,
    nextTier,
  };
}
