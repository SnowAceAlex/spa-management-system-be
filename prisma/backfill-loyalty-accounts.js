import pkg from '@prisma/client';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function main() {
  const customersWithoutLoyalty = await prisma.customer.findMany({
    where: { loyaltyAccount: null },
    select: { id: true },
  });

  if (customersWithoutLoyalty.length === 0) {
    console.log('No missing loyalty accounts found.');
    return;
  }

  await prisma.loyaltyAccount.createMany({
    data: customersWithoutLoyalty.map((customer) => ({ customerId: customer.id })),
    skipDuplicates: true,
  });

  console.log(`Backfilled ${customersWithoutLoyalty.length} loyalty account(s).`);
}

main()
  .catch((err) => {
    console.error('Loyalty backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
