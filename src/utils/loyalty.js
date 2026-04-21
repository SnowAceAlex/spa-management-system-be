// ===========================================
// Loyalty System Business Logic
// Dev 6 responsibility
// ===========================================

// Tier thresholds are based on Lifetime points, not usable points.
// This means a customer's tier never drops when they redeem points.
export const TIER_THRESHOLDS = {
  BRONZE: 500,
  SILVER: 1000,
  GOLD: 1500,
  PLATINUM: 2500,
};

// Discocunt percentage for each tier.
// GUEST has no discount, and PLATINUM has the highest discount.
// Each higher tier gets an additional 5% discount compared to the previous tier..
export const TIER_DISCOUNTS = {
  GUEST: 0,
  BRONZE: 5,
  SILVER: 10,
  GOLD: 15,
  PLATINUM: 20
};

// Tier order is useful when we need to calculate the next tier.
export const TIER_ORDER = ['GUEST', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

/**
 * Get customer tier from lifetime points.
 * 
 * @param {number} lifetimePoints - Total points earned by the customer over their lifetime.
 * @returns {string} - The tier name (GUEST, BRONZE, SILVER, GOLD, PLATINUM).
 */

export function getTierByLifetimePoints(lifetimePoints) {
  // Validate input first to avoid strange bugs later.
    if (typeof lifetimePoints !== 'number' || Number.isNaN(lifetimePoints) || lifetimePoints < 0) {
      throw new Error('Invalid input: lifetimePoints must be a non-negative number.');
    }

  // Check from highest tier to lowest tier. (If we check from the bottom first, a PLATINUM user (3000 points) would be classified as GUEST (0 points) because they meet the GUEST threshold.)
    if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) {
      return 'PLATINUM';
    }
    if (lifetimePoints >= TIER_THRESHOLDS.GOLD) {
      return 'GOLD';
    }
    if (lifetimePoints >= TIER_THRESHOLDS.SILVER) {
      return 'SILVER';
    }
    if (lifetimePoints >= TIER_THRESHOLDS.BRONZE) {
      return 'BRONZE';
    }
    return 'GUEST';
}

/**
 * Get discount percentage from tier.
 * 
 * @param {string} tier - The customer's tier.
 * @returns {number} - The discount percentage.

 */
export function getDiscountByTier(tier) {
    // If tier is invalid or missing, fallback safely to 0%
    // instead of crashing the whole appointment flow.
  return TIER_DISCOUNTS[tier] ?? 0;
}

/**
 * Calculate points earned from final total AFTER discount.
 * 
 * Formula agreed by team:
 * pointsEarned = Math.round(finalTotal * 0.05)
 * 
 * @param {number} finalTotal - The final total amount after discount.
 * @returns {number} - The points earned from this transaction.
 */
export function calculatePointsEarned(finalTotal) {
    if (
        typeof finalTotal !== 'number' ||
        Number.isNaN(finalTotal) || 
        finalTotal < 0
    ) {
        throw new Error('Invalid input: finalTotal must be a non-negative number.');
    }
    return Math.round(finalTotal * 0.05);
}

/**
 * Calculate how many points are needed to reach the next tier.
 * 
 * @param {number} lifetimePoints - Total points earned by the customer over their lifetime.
 * @returns {number} - The number of points needed to reach the next tier.
 */
export function calculatePointsToNextTier(lifetimePoints) {
    if (
        typeof lifetimePoints !== 'number' || Number.isNaN(lifetimePoints) || lifetimePoints < 0
    ) {
        throw new Error('Invalid input: lifetimePoints must be a non-negative number.');
    }

    const currentTier = getTierByLifetimePoints(lifetimePoints);

    // PLATINUM is the highest tier, so return 0 if already at PLATINUM.
    if (currentTier === 'PLATINUM') {
        return 0;
    }

    const currentTierIndex = TIER_ORDER.indexOf(currentTier);
    const nextTier = TIER_ORDER[currentTierIndex + 1];

    return TIER_THRESHOLDS[nextTier] - lifetimePoints;
}

/**
 * Calculate discount amount form subtotal and tier.
 * 
 * @param {number} subtotal - The total amount before discount.
 * @param {string} tier - The customer's tier.
 * @returns {number} - The discount amount to be subtracted from the subtotal.
 */
export function calculateDiscountAmount(subtotal, tier) {
    if (
        typeof subtotal !== 'number' || 
        Number.isNaN(subtotal) || 
        subtotal < 0
    ) {
        throw new Error('Invalid input: subtotal must be a non-negative number.');
    }

    const discountPercentage = getDiscountByTier(tier);
    return subtotal * (discountPercentage / 100);
}

/**
 * Calculate final total after applying discount.
 * 
 * @param {number} subtotal - The total amount before discount.
 * @param {string} tier - The customer's tier.
 * @returns {number} - The final total after applying the discount.
 */

export function calculateFinalTotal(subtotal, tier) {
    const discountAmount = calculateDiscountAmount(subtotal, tier);
    return subtotal - discountAmount;
}

/**
 * Get complete loyalty summary for UI/API response.
 * 
 * @param {number} lifetimePoints - Total points earned by the customer over their lifetime.
 * @param {number} totalPoints - Total points currently available for redemption.
 * @returns {Object} - The loyalty summary containing tier, points to next tier, and discount information.

 */

export function getLoyaltySummary(lifetimePoints, totalPoints) {
    if (
        typeof totalPoints !== 'number' || Number.isNaN(totalPoints) || totalPoints < 0
    ) {
        throw new Error('Invalid input: totalPoints must be a non-negative number.');
    }

    const tier = getTierByLifetimePoints(lifetimePoints);
    const pointsToNextTier = calculatePointsToNextTier(lifetimePoints);
    const discountPercentage = getDiscountByTier(tier);
    return {
        tier,
        totalPoints,
        lifetimePoints,
        pointsToNextTier,
        discountPercentage,
    };
}