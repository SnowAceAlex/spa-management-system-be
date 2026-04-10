---
name: Spa Backend MVP Completion
overview: Complete the spa backend as a clean MVP (CV-friendly) with all business modules except notifications, using simple but solid architecture, validation, role/ownership checks, and Swagger docs.
todos:
  - id: foundation-auth
    content: Finalize auth/users baseline with cookie refresh, role guards, and clean responses.
    status: pending
  - id: catalog-and-schedule
    content: Build service catalog and staff scheduling modules with admin/staff controls.
    status: pending
  - id: appointment-core
    content: Implement appointment creation, conflict validation, and status workflow.
    status: pending
  - id: billing-and-loyalty
    content: Implement invoice/payment and loyalty transactions with reward redemption.
    status: pending
  - id: reviews-promotions-docs
    content: Add reviews and promotions modules, then finish Swagger and README polish.
    status: pending
isProject: false
---

# Spa Backend MVP Completion Plan

## Goal

Build a complete, clean backend for the Spa Management System with:

- Authentication and user management
- Service catalog and staff setup
- Scheduling and appointment booking
- Invoice/payment status, loyalty, reviews, promotions
- Swagger-documented APIs and basic test-ready structure

Scope: all modules except notifications.

## Step 1: Stabilize Foundation (Auth + Project Standards)

Implement/finish:

- Finalize cookie-based auth flow (`register`, `login`, `refresh`, `logout`, `logoutAll`)
- Keep role-based access (`ADMIN`, `STAFF`, `CUSTOMER`) and ownership checks
- Consistent API response and error format
- Confirm environment config + Prisma migration state

Primary files:

- [D:/spa-management-system-be/src/controllers/auth.controller.js](D:/spa-management-system-be/src/controllers/auth.controller.js)
- [D:/spa-management-system-be/src/routes/auth.routes.js](D:/spa-management-system-be/src/routes/auth.routes.js)
- [D:/spa-management-system-be/src/middlewares/auth.middleware.js](D:/spa-management-system-be/src/middlewares/auth.middleware.js)
- [D:/spa-management-system-be/src/config/env.js](D:/spa-management-system-be/src/config/env.js)
- [D:/spa-management-system-be/prisma/schema.prisma](D:/spa-management-system-be/prisma/schema.prisma)

Functions/endpoints to implement or finalize:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /users/me`, `PATCH /users/me/profile`, admin user endpoints

## Step 2: Service Catalog Module

Implement:

- Service categories CRUD (admin)
- Services CRUD (admin), list/search (public/authenticated)
- Staff specialization mapping (admin)

Primary files to add:

- [D:/spa-management-system-be/src/controllers/service-categories.controller.js](D:/spa-management-system-be/src/controllers/service-categories.controller.js)
- [D:/spa-management-system-be/src/controllers/services.controller.js](D:/spa-management-system-be/src/controllers/services.controller.js)
- [D:/spa-management-system-be/src/controllers/staff-specializations.controller.js](D:/spa-management-system-be/src/controllers/staff-specializations.controller.js)
- [D:/spa-management-system-be/src/routes/service-categories.routes.js](D:/spa-management-system-be/src/routes/service-categories.routes.js)
- [D:/spa-management-system-be/src/routes/services.routes.js](D:/spa-management-system-be/src/routes/services.routes.js)
- [D:/spa-management-system-be/src/routes/staff-specializations.routes.js](D:/spa-management-system-be/src/routes/staff-specializations.routes.js)
- [D:/spa-management-system-be/src/validations/services.validation.js](D:/spa-management-system-be/src/validations/services.validation.js)

Functions/endpoints:

- `POST/GET/PATCH/DELETE /service-categories`
- `POST/GET/PATCH/DELETE /services`
- `POST/DELETE /staff/:staffId/specializations/:serviceId`

## Step 3: Staff Schedule & Availability Module

Implement:

- Staff schedule CRUD (admin/staff)
- Availability checks by day/time for booking

Primary files to add:

- [D:/spa-management-system-be/src/controllers/staff-schedules.controller.js](D:/spa-management-system-be/src/controllers/staff-schedules.controller.js)
- [D:/spa-management-system-be/src/routes/staff-schedules.routes.js](D:/spa-management-system-be/src/routes/staff-schedules.routes.js)
- [D:/spa-management-system-be/src/validations/staff-schedules.validation.js](D:/spa-management-system-be/src/validations/staff-schedules.validation.js)

Functions/endpoints:

- `POST/GET/PATCH/DELETE /staff/:staffId/schedules`
- `GET /staff/:staffId/availability?date=...`

## Step 4: Appointment Booking Module (Core Business)

Implement:

- Customer creates appointment with selected services
- Staff/Admin can update appointment status
- Prevent schedule conflicts and enforce ownership
- Compute `endsAt`, `totalAmount`, `paymentStatus`

Primary files to add:

- [D:/spa-management-system-be/src/controllers/appointments.controller.js](D:/spa-management-system-be/src/controllers/appointments.controller.js)
- [D:/spa-management-system-be/src/routes/appointments.routes.js](D:/spa-management-system-be/src/routes/appointments.routes.js)
- [D:/spa-management-system-be/src/validations/appointments.validation.js](D:/spa-management-system-be/src/validations/appointments.validation.js)

Functions/endpoints:

- `POST /appointments`
- `GET /appointments` (role-filtered)
- `GET /appointments/:id`
- `PATCH /appointments/:id/status`
- `PATCH /appointments/:id/cancel`

## Step 5: Invoice + Payment Status Module

Implement:

- Generate invoice per appointment
- Update payment lifecycle (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`)
- Track `paidAmt`, `paidAt`, and totals

Primary files to add:

- [D:/spa-management-system-be/src/controllers/invoices.controller.js](D:/spa-management-system-be/src/controllers/invoices.controller.js)
- [D:/spa-management-system-be/src/routes/invoices.routes.js](D:/spa-management-system-be/src/routes/invoices.routes.js)
- [D:/spa-management-system-be/src/validations/invoices.validation.js](D:/spa-management-system-be/src/validations/invoices.validation.js)

Functions/endpoints:

- `POST /appointments/:id/invoice`
- `GET /invoices`, `GET /invoices/:id`
- `PATCH /invoices/:id/pay`
- `PATCH /invoices/:id/refund`

## Step 6: Loyalty Module

Implement:

- Create/initialize loyalty account for each customer
- Earn points after paid invoice
- Redeem reward against invoice
- Keep transaction history and balance integrity

Primary files to add:

- [D:/spa-management-system-be/src/controllers/loyalty.controller.js](D:/spa-management-system-be/src/controllers/loyalty.controller.js)
- [D:/spa-management-system-be/src/routes/loyalty.routes.js](D:/spa-management-system-be/src/routes/loyalty.routes.js)
- [D:/spa-management-system-be/src/validations/loyalty.validation.js](D:/spa-management-system-be/src/validations/loyalty.validation.js)

Functions/endpoints:

- `GET /loyalty/me`
- `GET /loyalty/me/transactions`
- `POST /loyalty/rewards` (admin manage reward catalog)
- `POST /invoices/:id/redeem-reward`

## Step 7: Reviews Module

Implement:

- Customer can submit one review per completed appointment
- Staff/Admin can read reviews; customer can edit own review (optional for MVP)

Primary files to add:

- [D:/spa-management-system-be/src/controllers/reviews.controller.js](D:/spa-management-system-be/src/controllers/reviews.controller.js)
- [D:/spa-management-system-be/src/routes/reviews.routes.js](D:/spa-management-system-be/src/routes/reviews.routes.js)
- [D:/spa-management-system-be/src/validations/reviews.validation.js](D:/spa-management-system-be/src/validations/reviews.validation.js)

Functions/endpoints:

- `POST /appointments/:id/review`
- `GET /reviews`
- `GET /reviews/:id`
- `PATCH /reviews/:id` (owner-only if enabled)

## Step 8: Promotions Module

Implement:

- Admin promotion CRUD
- Validate code usage at invoice/payment stage

Primary files to add:

- [D:/spa-management-system-be/src/controllers/promotions.controller.js](D:/spa-management-system-be/src/controllers/promotions.controller.js)
- [D:/spa-management-system-be/src/routes/promotions.routes.js](D:/spa-management-system-be/src/routes/promotions.routes.js)
- [D:/spa-management-system-be/src/validations/promotions.validation.js](D:/spa-management-system-be/src/validations/promotions.validation.js)

Functions/endpoints:

- `POST/GET/PATCH/DELETE /promotions`
- `POST /promotions/validate`

## Step 9: Wire Routes + Swagger for Every Route

Implement:

- Register all new routes in app bootstrap
- Add Swagger JSDoc blocks for every route
- Ensure auth/security sections are accurate for protected endpoints

Primary files:

- [D:/spa-management-system-be/src/app.js](D:/spa-management-system-be/src/app.js)
- [D:/spa-management-system-be/src/routes](D:/spa-management-system-be/src/routes)

## Step 10: MVP Quality Pass (CV-friendly)

Implement:

- Basic seed data (admin, sample services/staff)
- Validation and error consistency review
- Small integration smoke checklist (manual or simple automated)
- README section: architecture, modules, API docs, sample credentials

Primary files:

- [D:/spa-management-system-be/prisma/seed.js](D:/spa-management-system-be/prisma/seed.js)
- [D:/spa-management-system-be/README.md](D:/spa-management-system-be/README.md)

## Suggested Build Order (Simple)

1. Step 1 (foundation)
2. Step 2 + Step 3 (catalog + schedules)
3. Step 4 (appointments)
4. Step 5 (invoices/payments)
5. Step 6 (loyalty)
6. Step 7 (reviews)
7. Step 8 (promotions)
8. Step 9 + Step 10 (docs + polish)

## CV-Ready Features to Highlight

- JWT auth with refresh-token rotation and role-based authorization
- Appointment scheduling with conflict checks and workflow statuses
- Invoice + payment lifecycle management
- Loyalty and promotions business logic
- Prisma data modeling + Swagger-documented REST APIs
