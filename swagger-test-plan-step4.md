# Swagger Manual Testing Plan
## Staff Schedules + Appointments

## 0) Setup

1. Start backend and open Swagger at `/docs`.
2. Prepare 3 bearer tokens:
   - `ADMIN`
   - `STAFF`
   - `CUSTOMER`
3. Gather initial IDs:
   - `staffId`
   - at least one `serviceId` that this staff is specialized in
4. Use Swagger **Authorize** with the right token per step.

---

## A) Staff Schedules API

Base routes:
- `GET /staff/{staffId}/schedules`
- `POST /staff/{staffId}/schedules`
- `PATCH /staff/{staffId}/schedules/{scheduleId}`
- `DELETE /staff/{staffId}/schedules/{scheduleId}`
- `GET /staff/{staffId}/availability?date=YYYY-MM-DD`

### A1. Create schedule (ADMIN)

- Endpoint: `POST /staff/{staffId}/schedules`
- Token: `ADMIN`
- Body:

```json
{
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "18:00",
  "isWorkingDay": true
}
```

Expected:
- `201 Created`
- Save `schedule.id` as `scheduleId`.

### A2. Duplicate day check

Repeat **A1** same `staffId`, same `dayOfWeek`.

Expected:
- `409`
- code: `SCHEDULE_DUPLICATE_DAY`

### A3. List schedules

- Endpoint: `GET /staff/{staffId}/schedules`
- Token: `ADMIN` (or matching `STAFF`)

Expected:
- `200`
- Returns created schedule row.

### A4. Update schedule

- Endpoint: `PATCH /staff/{staffId}/schedules/{scheduleId}`
- Token: `ADMIN`
- Body:

```json
{
  "startTime": "10:00",
  "endTime": "19:00"
}
```

Expected:
- `200`

### A5. Invalid time range check

- Endpoint: `PATCH /staff/{staffId}/schedules/{scheduleId}`
- Token: `ADMIN`
- Body:

```json
{
  "startTime": "19:00",
  "endTime": "10:00"
}
```

Expected:
- `400`
- code: `SCHEDULE_INVALID_TIME_RANGE` (or validation error)

### A6. Availability check

- Endpoint: `GET /staff/{staffId}/availability?date=2026-04-20`
- Token: `ADMIN` / `STAFF` / `CUSTOMER`

Expected:
- `200`
- Contains:
  - `isAvailable`
  - `workingHours` (if working day)
  - `bookedSlots`

### A7. Missing date check

- Endpoint: `GET /staff/{staffId}/availability` (without date)

Expected:
- `400`

### A8. Delete schedule

- Endpoint: `DELETE /staff/{staffId}/schedules/{scheduleId}`
- Token: `ADMIN`

Expected:
- `204`

---

## B) Appointments API

Base routes:
- `POST /appointments`
- `GET /appointments`
- `GET /appointments/{id}`
- `PATCH /appointments/{id}/status`
- `PATCH /appointments/{id}/cancel`

### B1. Ensure schedule exists

Before creating appointment, make sure staff has schedule on target day (run A1 if needed).

### B2. Create appointment (CUSTOMER)

- Endpoint: `POST /appointments`
- Token: `CUSTOMER`
- Body:

```json
{
  "staffId": "PUT_STAFF_ID_HERE",
  "scheduledAt": "2026-04-20T10:00:00.000Z",
  "serviceIds": ["PUT_SERVICE_ID_1_HERE"],
  "notes": "First booking from Swagger test"
}
```

Expected:
- `201`
- Save `appointment.id` as `appointmentId`.

### B3. Overlap protection

Create another appointment with overlapping time:

```json
{
  "staffId": "PUT_STAFF_ID_HERE",
  "scheduledAt": "2026-04-20T10:15:00.000Z",
  "serviceIds": ["PUT_SERVICE_ID_1_HERE"]
}
```

Expected:
- `409`
- code: `APPOINTMENT_OVERLAP`

### B4. Outside working hours

```json
{
  "staffId": "PUT_STAFF_ID_HERE",
  "scheduledAt": "2026-04-20T22:00:00.000Z",
  "serviceIds": ["PUT_SERVICE_ID_1_HERE"]
}
```

Expected:
- `409`
- code: `OUTSIDE_WORKING_HOURS`

### B5. List appointments by role

- Endpoint: `GET /appointments`
- Token tests:
  - `CUSTOMER`: only own appointments
  - `STAFF`: assigned appointments only
  - `ADMIN`: all appointments

Optional query tests:
- `/appointments?status=PENDING`
- `/appointments?date=2026-04-20`
- admin only: `staffId=...`, `customerId=...`

### B6. Get appointment detail

- Endpoint: `GET /appointments/{id}`
- Token: owner `CUSTOMER` / assigned `STAFF` / `ADMIN`

Expected:
- `200`

### B7. Valid status transitions

- Endpoint: `PATCH /appointments/{id}/status`
- Token: assigned `STAFF` or `ADMIN`

Run in order:

```json
{ "status": "CONFIRMED" }
```

```json
{ "status": "IN_PROGRESS" }
```

```json
{ "status": "COMPLETED" }
```

Expected:
- each returns `200`

### B8. Invalid status transition

On fresh `PENDING` appointment:

```json
{ "status": "COMPLETED" }
```

Expected:
- `409`
- code: `APPOINTMENT_INVALID_STATUS_TRANSITION`

### B9. Cancel appointment

On fresh appointment:

- Endpoint: `PATCH /appointments/{id}/cancel`
- Token: owner `CUSTOMER` (or assigned `STAFF` / `ADMIN`)
- Body:

```json
{
  "reason": "Customer changed plans"
}
```

Expected:
- `200`
- appointment status becomes `CANCELLED`

### B10. Cancel forbidden for completed/no_show

Try cancel on a completed appointment:

```json
{
  "reason": "Late cancel attempt"
}
```

Expected:
- `409`
- code: `APPOINTMENT_CANCEL_FORBIDDEN`

---

## Final Pass Checklist

- [ ] Schedule CRUD works.
- [ ] Duplicate schedule day blocked.
- [ ] Availability endpoint returns expected structure.
- [ ] Customer can create appointment.
- [ ] Overlap blocked.
- [ ] Outside-working-hours blocked.
- [ ] Role-based list/detail access works.
- [ ] Status workflow rules enforced.
- [ ] Cancel policy enforced.
