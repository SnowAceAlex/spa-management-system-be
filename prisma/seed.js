import bcrypt from 'bcryptjs';
import pkg from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const { PrismaClient, Prisma, Role } = pkg;
const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin12345!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.ADMIN,
      },
    });
  }

  const category = await prisma.serviceCategory.upsert({
    where: { name: 'Facial Treatments' },
    update: {},
    create: {
      name: 'Facial Treatments',
      description: 'Skin care and rejuvenation',
      sortOrder: 1,
      isActive: true,
    },
  });

  let service1 = await prisma.service.findFirst({
    where: { name: 'Classic Facial' },
  });

  if (!service1) {
    service1 = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: 'Classic Facial',
        description: 'Deep cleansing and hydration',
        durationMin: 60,
        price: new Prisma.Decimal('75.00'),
        isActive: true,
      },
    });
  }

  let service2 = await prisma.service.findFirst({
    where: { name: 'Anti-Aging Facial' },
  });

  if (!service2) {
    service2 = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: 'Anti-Aging Facial',
        description: 'Collagen boost treatment',
        durationMin: 90,
        price: new Prisma.Decimal('120.00'),
        isActive: true,
      },
    });
  }

  const staffEmail = 'staff@example.com';
  const staffUser = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: {
      email: staffEmail,
      passwordHash: await bcrypt.hash('Staff12345!', 12),
      role: Role.STAFF,
    },
  });

  await prisma.staff.upsert({
    where: { userId: staffUser.id },
    update: {},
    create: {
      userId: staffUser.id,
      firstName: 'Linh',
      lastName: 'Nguyen',
      phone: '0901234567',
      bio: 'Certified aesthetician with 5 years experience',
      isAvailable: true,
    },
  });

  const staffProfile = await prisma.staff.findUnique({
    where: { userId: staffUser.id },
  });

  if (!staffProfile) {
    throw new Error('Staff profile not found after upsert');
  }

  await prisma.staffSpecialization.upsert({
    where: {
      staffId_serviceId: {
        staffId: staffProfile.id,
        serviceId: service1.id,
      },
    },
    update: {},
    create: {
      staffId: staffProfile.id,
      serviceId: service1.id,
    },
  });

  await prisma.staffSpecialization.upsert({
    where: {
      staffId_serviceId: {
        staffId: staffProfile.id,
        serviceId: service2.id,
      },
    },
    update: {},
    create: {
      staffId: staffProfile.id,
      serviceId: service2.id,
    },
  });

  await prisma.staffSchedule.upsert({
    where: {
      staffId_dayOfWeek: {
        staffId: staffProfile.id,
        dayOfWeek: 1,
      },
    },
    update: {
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T18:00:00.000Z'),
      isWorkingDay: true,
    },
    create: {
      staffId: staffProfile.id,
      dayOfWeek: 1,
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T18:00:00.000Z'),
      isWorkingDay: true,
    },
  });

  await prisma.staffSchedule.upsert({
    where: {
      staffId_dayOfWeek: {
        staffId: staffProfile.id,
        dayOfWeek: 2,
      },
    },
    update: {
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T18:00:00.000Z'),
      isWorkingDay: true,
    },
    create: {
      staffId: staffProfile.id,
      dayOfWeek: 2,
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T18:00:00.000Z'),
      isWorkingDay: true,
    },
  });

  const customerEmail = 'customer@example.com';
  const customerUser = await prisma.user.upsert({
    where: { email: customerEmail },
    update: {},
    create: {
      email: customerEmail,
      passwordHash: await bcrypt.hash('Customer12345!', 12),
      role: Role.CUSTOMER,
    },
  });

  await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: {
      userId: customerUser.id,
      firstName: 'Anh',
      lastName: 'Tran',
      phone: '0905558888',
      notes: 'Seed customer profile for appointment booking tests',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
