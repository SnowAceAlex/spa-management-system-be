import * as loyaltyService from '../services/loyalty.service.js';
import { HttpError } from '../utils/httpError.js';
import { prisma } from '../config/db.js';

export async function getMyLoyaltyInfo(req, res, next) {
  try {
    // 🔥 Convert userId → customerId
    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.id }
    });

    if (!customer) {
      throw new HttpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    const account = await loyaltyService.getLoyaltyAccount(customer.id);

    if (!account) {
      throw new HttpError(404, 'Loyalty account not found', 'LOYALTY_NOT_FOUND');
    }

    res.json({ account });
  } catch (err) {
    next(err);
  }
}

export async function getMyTransactions(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.id }
    });

    if (!customer) {
      throw new HttpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    const { transactions, total } =
      await loyaltyService.listTransactions(customer.id, page, limit);

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getAvailableRewards(req, res, next) {
  try {
    const rewards = await loyaltyService.listAvailableRewards();
    res.json({ rewards });
  } catch (err) {
    next(err);
  }
}

export async function claimReward(req, res, next) {
  try {
    const { rewardId } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.id }
    });

    if (!customer) {
      throw new HttpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    const result = await loyaltyService.claimReward(customer.id, rewardId);

    if (result.error === 'NOT_FOUND') {
      throw new HttpError(404, 'Reward not found', 'REWARD_NOT_FOUND');
    }

    if (result.error === 'INSUFFICIENT_POINTS') {
      throw new HttpError(400, 'Insufficient points', 'INSUFFICIENT_POINTS');
    }

    res.status(201).json({
      message: 'Reward claimed successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
}