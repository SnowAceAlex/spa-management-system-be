import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';

function formatLoyalty(relationship) {
  return {
    score: relationship.totalPoints,
    lifetimeScore: relationship.lifetimePoints,
    tier: relationship.tier,
    updatedAt: relationship.updatedAt,
  };
}

export async function getMyLoyalty(req, res, next) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.id },
      select: {
        loyaltyAccount: {
          select: { totalPoints: true, lifetimePoints: true, tier: true, updatedAt: true },
        },
      },
    });

    if (!customer) {
      throw new HttpError(404, 'Customer profile not found', 'CUSTOMER_PROFILE_NOT_FOUND');
    }

    const loyalty = customer.loyaltyAccount
      ? formatLoyalty(customer.loyaltyAccount)
      : { score: 0, lifetimeScore: 0, tier: 'BRONZE', updatedAt: null };
    res.json({ loyalty });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerLoyalty(req, res, next) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
      select: {
        id: true,
        loyaltyAccount: {
          select: { totalPoints: true, lifetimePoints: true, tier: true, updatedAt: true },
        },
      },
    });

    if (!customer) {
      throw new HttpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    const loyalty = customer.loyaltyAccount
      ? formatLoyalty(customer.loyaltyAccount)
      : { score: 0, lifetimeScore: 0, tier: 'BRONZE', updatedAt: null };
    res.json({ customerId: customer.id, loyalty });
  } catch (err) {
    next(err);
  }
}