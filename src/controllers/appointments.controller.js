import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import {
  calculatePointsEarned,
  createLoyaltyTransaction,
} from '../utils/points-calculator.js';
import {
  getDiscountByTier,
  getTierByLifetimePoints,
  updateCustomerTier,
} from '../utils/tier-calculator.js';

/**
 * Create new appointment with auto-applied loyalty discount
 * Validates staffId, serviceIds, customerId exist
 * Calculates discount based on customer tier
 * Creates Invoice with discount applied
 */
export async function createAppointment(req, res, next) {
  try {
    const { customerId, staffId, serviceIds, scheduledAt, notes } = req.body;

    // Validate customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { loyaltyAccount: true },
    });

    if (!customer) {
      throw new HttpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    // Create loyalty account if not exists
    let loyaltyAccount = customer.loyaltyAccount;
    if (!loyaltyAccount) {
      loyaltyAccount = await prisma.loyaltyAccount.create({
        data: { customerId },
      });
    }

    // Validate staff exists
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new HttpError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    // Validate services exist and get prices
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
    });

    if (services.length !== serviceIds.length) {
      throw new HttpError(400, 'One or more services not found', 'INVALID_SERVICES');
    }

    // Calculate subtotal
    let subtotal = new Prisma.Decimal(0);
    let totalDuration = 0;

    for (const service of services) {
      subtotal = subtotal.plus(service.price);
      totalDuration += service.durationMin;
    }

    // Calculate discount based on customer tier
    const discountPercentage = getDiscountByTier(loyaltyAccount.tier);
    const discountAmount = subtotal.times(new Prisma.Decimal(discountPercentage / 100));
    const totalAmount = subtotal.minus(discountAmount);

    // Calculate end time
    const appointmentStart = new Date(scheduledAt);
    const appointmentEnd = new Date(
      appointmentStart.getTime() + totalDuration * 60000
    );

    // Create appointment with invoice and appointment services
    const appointment = await prisma.appointment.create({
      data: {
        customerId,
        staffId,
        scheduledAt: appointmentStart,
        endsAt: appointmentEnd,
        totalAmount,
        notes,
        status: 'PENDING',
        services: {
          create: services.map((service) => ({
            serviceId: service.id,
            priceSnapshot: service.price,
            durationMin: service.durationMin,
          })),
        },
        invoice: {
          create: {
            subtotal,
            discountAmt: discountAmount,
            taxAmt: new Prisma.Decimal(0),
            totalAmt: totalAmount,
            paidAmt: new Prisma.Decimal(0),
          },
        },
      },
      include: {
        services: { include: { service: true } },
        invoice: true,
        staff: true,
        customer: true,
      },
    });

    // Format response
    const formattedAppointment = formatAppointment(appointment);

    res.status(201).json({
      appointment: formattedAppointment,
      discountApplied: {
        tier: loyaltyAccount.tier,
        discountPercentage,
        discountAmount: discountAmount.toString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List appointments with pagination and filters
 * CUSTOMER: only their own appointments
 * ADMIN/STAFF: can view by customerId/staffId filter
 */
export async function listAppointments(req, res, next) {
  try {
    const { page, limit, status, customerId, staffId } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = {};

    if (status) where.status = status;

    // CUSTOMER: only their appointments
    if (req.user.role === 'CUSTOMER') {
      const customerRecord = await prisma.customer.findUnique({
        where: { userId: req.user.id },
      });
      if (customerRecord) where.customerId = customerRecord.id;
    } else {
      // ADMIN/STAFF can filter
      if (customerId) where.customerId = customerId;
      if (staffId) where.staffId = staffId;
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          services: { include: { service: true } },
          customer: true,
          staff: true,
          invoice: true,
        },
        skip,
        take: limitNum,
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.appointment.count({ where }),
    ]);

    const formattedAppointments = appointments.map(formatAppointment);

    res.json({
      data: formattedAppointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get appointment detail by ID
 */
export async function getAppointmentById(req, res, next) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        services: { include: { service: true } },
        customer: true,
        staff: true,
        invoice: true,
      },
    });

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    // Check authorization: CUSTOMER can only view own, others need ADMIN/STAFF
    if (req.user.role === 'CUSTOMER') {
      const customerRecord = await prisma.customer.findUnique({
        where: { userId: req.user.id },
      });
      if (!customerRecord || appointment.customerId !== customerRecord.id) {
        throw new HttpError(403, 'Forbidden', 'UNAUTHORIZED_APPOINTMENT_ACCESS');
      }
    }

    const formattedAppointment = formatAppointment(appointment);
    res.json({ appointment: formattedAppointment });
  } catch (err) {
    next(err);
  }
}

/**
 * Update appointment status
 * When status changes to COMPLETED, automatically earn loyalty points
 * ADMIN/STAFF only
 */
export async function updateAppointmentStatus(req, res, next) {
  try {
    const { status } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        invoice: true,
        customer: { include: { loyaltyAccount: true } },
      },
    });

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    // Update status
    const updatedAppointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        services: { include: { service: true } },
        customer: true,
        staff: true,
        invoice: true,
      },
    });

    // If status changed to COMPLETED, earn loyalty points
    if (status === 'COMPLETED' && appointment.status !== 'COMPLETED') {
      const pointsEarned = calculatePointsEarned(appointment.totalAmount);

      // Create loyalty transaction
      const transactionResult = await createLoyaltyTransaction(
        appointment.customer.loyaltyAccount.id,
        'EARN',
        pointsEarned,
        `Appointment ${appointment.id} completed`,
        appointment.invoice.id
      );

      // Auto-upgrade tier if applicable
      const tierUpdate = await updateCustomerTier(appointment.customerId);

      // Update invoice with points earned
      await prisma.invoice.update({
        where: { id: appointment.invoice.id },
        data: {
          pointsEarned,
        },
      });

      const formattedAppointment = formatAppointment(updatedAppointment);

      // Get current tier
      const currentTier = getTierByLifetimePoints(transactionResult.updatedLifetimePoints);

      return res.json({
        appointment: formattedAppointment,
        loyaltyEarned: {
          pointsEarned,
          newBalance: transactionResult.updatedBalance,
          newLifetimePoints: transactionResult.updatedLifetimePoints,
          currentTier,
          tierUpdated: tierUpdate.upgraded,
          ...(tierUpdate.upgraded && {
            oldTier: tierUpdate.oldTier,
            newTier: tierUpdate.newTier,
          }),
        },
      });
    }

    const formattedAppointment = formatAppointment(updatedAppointment);
    res.json({ appointment: formattedAppointment });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete/cancel appointment
 * If COMPLETED and points earned, refund points
 * ADMIN only
 */
export async function deleteAppointment(req, res, next) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        invoice: true,
        customer: { include: { loyaltyAccount: true } },
      },
    });

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    }

    // If completed and points were earned, refund them
    if (appointment.status === 'COMPLETED' && appointment.invoice.pointsEarned > 0) {
      await createLoyaltyTransaction(
        appointment.customer.loyaltyAccount.id,
        'ADJUST',
        -appointment.invoice.pointsEarned,
        `Points refunded for cancelled appointment ${appointment.id}`,
        appointment.invoice.id
      );
    }

    // Change status to CANCELLED instead of hard delete
    await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Helper: Format appointment response with string decimals
 */
function formatAppointment(appointment) {
  return {
    id: appointment.id,
    customerId: appointment.customerId,
    staffId: appointment.staffId,
    scheduledAt: appointment.scheduledAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    notes: appointment.notes,
    totalAmount: appointment.totalAmount.toString(),
    paymentStatus: appointment.paymentStatus,
    services: appointment.services.map((as) => ({
      id: as.serviceId,
      name: as.service.name,
      price: as.priceSnapshot.toString(),
      durationMin: as.durationMin,
    })),
    invoice: appointment.invoice
      ? {
          id: appointment.invoice.id,
          subtotal: appointment.invoice.subtotal.toString(),
          discountAmt: appointment.invoice.discountAmt.toString(),
          taxAmt: appointment.invoice.taxAmt.toString(),
          totalAmt: appointment.invoice.totalAmt.toString(),
          paidAmt: appointment.invoice.paidAmt.toString(),
          paymentStatus: appointment.invoice.paymentStatus,
          pointsEarned: appointment.invoice.pointsEarned,
          pointsUsed: appointment.invoice.pointsUsed,
        }
      : null,
    staff: {
      id: appointment.staff.id,
      firstName: appointment.staff.firstName,
      lastName: appointment.staff.lastName,
    },
    customer: {
      id: appointment.customer.id,
      firstName: appointment.customer.firstName,
      lastName: appointment.customer.lastName,
    },
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}
