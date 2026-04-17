import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';

function parseTimeToUtcDate(time) {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`1970-01-01T${normalized}.000Z`);
}

function minutesFromDate(dateValue) {
  return dateValue.getUTCHours() * 60 + dateValue.getUTCMinutes();
}

function minutesFromIsoDate(dateValue) {
  return dateValue.getUTCHours() * 60 + dateValue.getUTCMinutes();
}

function normalizeSchedule(schedule) {
  const startHours = schedule.startTime.getUTCHours().toString().padStart(2, '0');
  const startMinutes = schedule.startTime.getUTCMinutes().toString().padStart(2, '0');
  const endHours = schedule.endTime.getUTCHours().toString().padStart(2, '0');
  const endMinutes = schedule.endTime.getUTCMinutes().toString().padStart(2, '0');

  return {
    ...schedule,
    startTime: `${startHours}:${startMinutes}`,
    endTime: `${endHours}:${endMinutes}`,
  };
}

async function assertStaffAccess(req, staffId) {
  if (req.user.role !== 'STAFF') {
    return;
  }

  const staff = await prisma.staff.findUnique({
    where: { userId: req.user.id },
    select: { id: true },
  });

  if (!staff || staff.id !== staffId) {
    throw new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN');
  }
}

export async function listStaffSchedules(req, res, next) {
  try {
    const { staffId } = req.params;
    await assertStaffAccess(req, staffId);
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new HttpError(404, 'Staff not found', 'STAFF_NOT_FOUND');
    }

    const schedules = await prisma.staffSchedule.findMany({
      where: { staffId },
      orderBy: { dayOfWeek: 'asc' },
    });
    res.json({ schedules: schedules.map(normalizeSchedule) });
  } catch (err) {
    next(err);
  }
}

export async function createStaffSchedule(req, res, next) {
  try {
    const { staffId } = req.params;
    await assertStaffAccess(req, staffId);
    const { dayOfWeek, startTime, endTime, isWorkingDay } = req.body;

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new HttpError(404, 'Staff not found', 'STAFF_NOT_FOUND');
    }

    const created = await prisma.staffSchedule.create({
      data: {
        staffId,
        dayOfWeek,
        startTime: parseTimeToUtcDate(startTime),
        endTime: parseTimeToUtcDate(endTime),
        isWorkingDay: isWorkingDay ?? true,
      },
    });

    res.status(201).json({ schedule: normalizeSchedule(created) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(
        new HttpError(409, 'Schedule for this day already exists', 'SCHEDULE_DUPLICATE_DAY'),
      );
    }
    next(err);
  }
}

export async function updateStaffSchedule(req, res, next) {
  try {
    const { staffId, scheduleId } = req.params;
    await assertStaffAccess(req, staffId);
    const existing = await prisma.staffSchedule.findFirst({ where: { id: scheduleId, staffId } });
    if (!existing) {
      throw new HttpError(404, 'Schedule not found', 'SCHEDULE_NOT_FOUND');
    }

    const data = {};
    if (req.body.dayOfWeek !== undefined) data.dayOfWeek = req.body.dayOfWeek;
    if (req.body.startTime !== undefined) data.startTime = parseTimeToUtcDate(req.body.startTime);
    if (req.body.endTime !== undefined) data.endTime = parseTimeToUtcDate(req.body.endTime);
    if (req.body.isWorkingDay !== undefined) data.isWorkingDay = req.body.isWorkingDay;

    const startCandidate = data.startTime || existing.startTime;
    const endCandidate = data.endTime || existing.endTime;
    if (minutesFromDate(startCandidate) >= minutesFromDate(endCandidate)) {
      throw new HttpError(
        400,
        'startTime must be earlier than endTime',
        'SCHEDULE_INVALID_TIME_RANGE',
      );
    }

    const updated = await prisma.staffSchedule.update({
      where: { id: scheduleId },
      data,
    });

    res.json({ schedule: normalizeSchedule(updated) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(
        new HttpError(409, 'Schedule for this day already exists', 'SCHEDULE_DUPLICATE_DAY'),
      );
    }
    next(err);
  }
}

export async function deleteStaffSchedule(req, res, next) {
  try {
    const { staffId, scheduleId } = req.params;
    await assertStaffAccess(req, staffId);
    const existing = await prisma.staffSchedule.findFirst({ where: { id: scheduleId, staffId } });
    if (!existing) {
      throw new HttpError(404, 'Schedule not found', 'SCHEDULE_NOT_FOUND');
    }

    await prisma.staffSchedule.delete({ where: { id: scheduleId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getStaffAvailability(req, res, next) {
  try {
    const { staffId } = req.params;
    await assertStaffAccess(req, staffId);
    const { date } = req.query;

    if (!date) {
      throw new HttpError(400, 'date query is required', 'VALIDATION_ERROR');
    }
    const targetDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(targetDate.getTime())) {
      throw new HttpError(400, 'date must be YYYY-MM-DD', 'VALIDATION_ERROR');
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new HttpError(404, 'Staff not found', 'STAFF_NOT_FOUND');
    }

    const dayOfWeek = targetDate.getUTCDay();
    const schedule = await prisma.staffSchedule.findUnique({
      where: { staffId_dayOfWeek: { staffId, dayOfWeek } },
    });

    if (!schedule || !schedule.isWorkingDay) {
      return res.json({
        staffId,
        date,
        isAvailable: false,
        reason: 'STAFF_NOT_WORKING_DAY',
      });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        staffId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        scheduledAt: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lt: new Date(`${date}T23:59:59.999Z`),
        },
      },
      select: {
        id: true,
        scheduledAt: true,
        endsAt: true,
        status: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.json({
      staffId,
      date,
      isAvailable: true,
      workingHours: {
        startTime: normalizeSchedule(schedule).startTime,
        endTime: normalizeSchedule(schedule).endTime,
      },
      bookedSlots: appointments.map((appt) => ({
        id: appt.id,
        status: appt.status,
        scheduledAt: appt.scheduledAt,
        endsAt: appt.endsAt,
        startMinute: minutesFromIsoDate(appt.scheduledAt),
        endMinute: minutesFromIsoDate(appt.endsAt),
      })),
    });
  } catch (err) {
    next(err);
  }
}
