import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import { createInvoiceForAppointment } from '../services/invoice.service.js';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'NO_SHOW']);
const ACTIVE_BLOCKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

const STATUS_TRANSITIONS = {
  PENDING: new Set(['CONFIRMED', 'CANCELLED']),
  CONFIRMED: new Set(['IN_PROGRESS', 'CANCELLED', 'NO_SHOW']),
  IN_PROGRESS: new Set(['COMPLETED', 'CANCELLED']),
  COMPLETED: new Set([]),
  CANCELLED: new Set([]),
  NO_SHOW: new Set([]),
};

function toMoneyString(decimalValue) {
  return decimalValue.toString();
}

function normalizeAppointmentRow(appointment) {
  return {
    ...appointment,
    totalAmount: toMoneyString(appointment.totalAmount),
    services: appointment.services.map((item) => ({
      ...item,
      priceSnapshot: toMoneyString(item.priceSnapshot),
      service: item.service
        ? {
            ...item.service,
            price: toMoneyString(item.service.price),
          }
        : undefined,
    })),
  };
}

function getMinutesFromTimeDate(timeDate) {
  return timeDate.getUTCHours() * 60 + timeDate.getUTCMinutes();
}

function getMinutesFromDateTime(dateTime) {
  return dateTime.getUTCHours() * 60 + dateTime.getUTCMinutes();
}

function getWindowForDate(dateInput) {
  const date = new Date(dateInput);
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

async function resolveActorProfile(tx, user) {
  if (user.role === 'CUSTOMER') {
    const customer = await tx.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      throw new HttpError(403, 'Customer profile not found', 'CUSTOMER_PROFILE_NOT_FOUND');
    }
    return { customerId: customer.id };
  }

  if (user.role === 'STAFF') {
    const staff = await tx.staff.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!staff) {
      throw new HttpError(403, 'Staff profile not found', 'STAFF_PROFILE_NOT_FOUND');
    }
    return { staffId: staff.id };
  }

  return {};
}

async function assertScheduleAndNoConflict(tx, { staffId, scheduledAt, endsAt }) {
  const dayOfWeek = scheduledAt.getUTCDay();
  const schedule = await tx.staffSchedule.findUnique({
    where: { staffId_dayOfWeek: { staffId, dayOfWeek } },
  });

  if (!schedule || !schedule.isWorkingDay) {
    throw new HttpError(409, 'Staff is not working on this day', 'OUTSIDE_WORKING_HOURS');
  }

  const scheduleStartMinute = getMinutesFromTimeDate(schedule.startTime);
  const scheduleEndMinute = getMinutesFromTimeDate(schedule.endTime);
  const startMinute = getMinutesFromDateTime(scheduledAt);
  const endMinute = getMinutesFromDateTime(endsAt);

  if (startMinute < scheduleStartMinute || endMinute > scheduleEndMinute) {
    throw new HttpError(409, 'Appointment is outside working hours', 'OUTSIDE_WORKING_HOURS');
  }

  const overlap = await tx.appointment.findFirst({
    where: {
      staffId,
      status: { in: ACTIVE_BLOCKING_STATUSES },
      scheduledAt: { lt: endsAt },
      endsAt: { gt: scheduledAt },
    },
    select: { id: true },
  });

  if (overlap) {
    throw new HttpError(409, 'Appointment time overlaps existing booking', 'APPOINTMENT_OVERLAP', {
      conflictAppointmentId: overlap.id,
    });
  }
}

function assertTransitionAllowed(currentStatus, nextStatus) {
  const allowedSet = STATUS_TRANSITIONS[currentStatus];
  if (!allowedSet || !allowedSet.has(nextStatus)) {
    throw new HttpError(
      409,
      `Cannot change appointment status from ${currentStatus} to ${nextStatus}`,
      'APPOINTMENT_INVALID_STATUS_TRANSITION',
    );
  }
}

export async function createAppointment(req, res, next) {
  try {
    if (req.user.role !== 'CUSTOMER') {
      throw new HttpError(
        403,
        'Only customers can create appointments',
        'APPOINTMENT_CREATE_FORBIDDEN',
      );
    }

    const actor = await resolveActorProfile(prisma, req.user);
    const customerId = actor.customerId;
    const { staffId, scheduledAt, serviceIds, notes } = req.body;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, isAvailable: true },
    });
    if (!staff || !staff.isAvailable) {
      throw new HttpError(404, 'Staff not found or unavailable', 'STAFF_NOT_AVAILABLE');
    }

    const uniqueServiceIds = [...new Set(serviceIds)];
    const services = await prisma.service.findMany({
      where: { id: { in: uniqueServiceIds }, isActive: true },
      select: { id: true, price: true, durationMin: true },
    });
    if (services.length !== uniqueServiceIds.length) {
      throw new HttpError(404, 'One or more services not found or inactive', 'SERVICE_NOT_FOUND');
    }

    const specializations = await prisma.staffSpecialization.findMany({
      where: {
        staffId,
        serviceId: { in: uniqueServiceIds },
      },
      select: { serviceId: true },
    });
    if (specializations.length !== uniqueServiceIds.length) {
      throw new HttpError(
        409,
        'Staff is not specialized for all selected services',
        'STAFF_NOT_SPECIALIZED',
      );
    }

    const totalDurationMin = services.reduce((sum, service) => sum + service.durationMin, 0);
    const totalAmount = services.reduce((sum, service) => sum.plus(service.price), new Prisma.Decimal(0));
    const startsAt = new Date(scheduledAt);
    const endsAt = new Date(startsAt.getTime() + totalDurationMin * 60 * 1000);

    await assertScheduleAndNoConflict(prisma, { staffId, scheduledAt: startsAt, endsAt });

    const appointment = await prisma.appointment.create({
      data: {
        customerId,
        staffId,
        scheduledAt: startsAt,
        endsAt,
        notes: notes ?? undefined,
        totalAmount,
        paymentStatus: 'UNPAID',
        services: {
          create: services.map((service) => ({
            serviceId: service.id,
            priceSnapshot: service.price,
            durationMin: service.durationMin,
          })),
        },
      },
      include: {
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({ appointment: normalizeAppointmentRow(appointment) });
  } catch (err) {
    next(err);
  }
}

export async function listAppointments(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const where = {};
    const actor = await resolveActorProfile(prisma, req.user);
    if (req.user.role === 'CUSTOMER') {
      where.customerId = actor.customerId;
    } else if (req.user.role === 'STAFF') {
      where.staffId = actor.staffId;
    }

    if (req.query.status) {
      where.status = req.query.status;
    }
    if (req.query.staffId && req.user.role === 'ADMIN') {
      where.staffId = req.query.staffId;
    }
    if (req.query.customerId && req.user.role === 'ADMIN') {
      where.customerId = req.query.customerId;
    }
    if (req.query.date) {
      const target = new Date(`${req.query.date}T00:00:00.000Z`);
      if (Number.isNaN(target.getTime())) {
        throw new HttpError(400, 'date must be YYYY-MM-DD', 'VALIDATION_ERROR');
      }
      const dayWindow = getWindowForDate(target);
      where.scheduledAt = { gte: dayWindow.start, lte: dayWindow.end };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
        include: {
          services: {
            include: {
              service: { select: { id: true, name: true, price: true } },
            },
          },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    res.json({
      appointments: appointments.map(normalizeAppointmentRow),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointmentById(req, res, next) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        services: {
          include: {
            service: { select: { id: true, name: true, price: true } },
          },
        },
      },
    });

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    const actor = await resolveActorProfile(prisma, req.user);
    if (req.user.role === 'CUSTOMER' && appointment.customerId !== actor.customerId) {
      throw new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN');
    }
    if (req.user.role === 'STAFF' && appointment.staffId !== actor.staffId) {
      throw new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN');
    }

    res.json({ appointment: normalizeAppointmentRow(appointment) });
  } catch (err) {
    next(err);
  }
}

export async function updateAppointmentStatus(req, res, next) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, staffId: true, customerId: true },
    });
    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    if (req.user.role === 'STAFF') {
      const staff = await prisma.staff.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!staff || appointment.staffId !== staff.id) {
        throw new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN');
      }
    }

    if (TERMINAL_STATUSES.has(appointment.status)) {
      throw new HttpError(
        409,
        'Cannot update a terminal appointment status',
        'APPOINTMENT_STATUS_LOCKED',
      );
    }
    assertTransitionAllowed(appointment.status, req.body.status);

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.appointment.update({
        where: { id: req.params.id },
        data: { status: req.body.status },
        include: {
          services: {
            include: {
              service: { select: { id: true, name: true, price: true } },
            },
          },
        },
      });

      if (req.body.status === 'COMPLETED') {
        await createInvoiceForAppointment(tx, u.id);
      }

      return u;
    });

    res.json({ appointment: normalizeAppointmentRow(updated) });
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointment(req, res, next) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, staffId: true, customerId: true, notes: true },
    });
    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    if (appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW') {
      throw new HttpError(
        409,
        'Cannot cancel completed/no-show appointment',
        'APPOINTMENT_CANCEL_FORBIDDEN',
      );
    }
    if (appointment.status === 'CANCELLED') {
      throw new HttpError(409, 'Appointment is already cancelled', 'APPOINTMENT_ALREADY_CANCELLED');
    }

    if (req.user.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!customer || appointment.customerId !== customer.id) {
        throw new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN');
      }
    }
    if (req.user.role === 'STAFF') {
      const staff = await prisma.staff.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!staff || appointment.staffId !== staff.id) {
        throw new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN');
      }
    }

    const note = req.body.reason ? `\n[CANCEL_REASON] ${req.body.reason}` : '';
    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        notes: `${appointment.notes || ''}${note}`.trim() || null,
      },
      include: {
        services: {
          include: {
            service: { select: { id: true, name: true, price: true } },
          },
        },
      },
    });

    res.json({ appointment: normalizeAppointmentRow(updated) });
  } catch (err) {
    next(err);
  }
}
