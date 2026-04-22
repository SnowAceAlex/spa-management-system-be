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
    // 1. Lấy thông tin tài khoản và phần thưởng
    const [account, reward] = await Promise.all([
      tx.loyaltyAccount.findUnique({ where: { customerId } }),
      tx.loyaltyReward.findUnique({ where: { id: rewardId, isActive: true } })
    ]);

    if (!account || !reward) return { error: 'NOT_FOUND' };
    if (account.totalPoints < reward.pointsCost) return { error: 'INSUFFICIENT_POINTS' };

    const newBalance = account.totalPoints - reward.pointsCost;

    // 2. Trừ điểm trong tài khoản
    await tx.loyaltyAccount.update({
      where: { customerId },
      data: { totalPoints: newBalance }
    });

    // 3. Ghi log giao dịch (bắt buộc có balanceAfter theo schema)
    await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        type: 'REDEEM',
        points: -reward.pointsCost,
        balanceAfter: newBalance,
        description: `Đổi phần thưởng: ${reward.name}`
      }
    });

    // 4. Tạo CustomerReward cho khách
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