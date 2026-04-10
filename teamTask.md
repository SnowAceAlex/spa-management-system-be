# Spa backend — service catalog team tasks

University / portfolio project: solid REST + Prisma + Swagger, not production-hardened.

## Done — Dev 1 (service categories)

**Owner:** Dev 1 — **status: implemented**

### What was built

- **Routes** (mounted at `/service-categories`):  
  - `GET /service-categories` — public list of **active** categories; **admin** can pass `Authorization: Bearer <token>` and `?includeInactive=true` to see all.  
  - `GET /service-categories/:id` — public detail with nested **active** services (prices as strings); same admin query for inactive.  
  - `POST /service-categories` — **ADMIN** only.  
  - `PATCH /service-categories/:id` — **ADMIN** only (at least one field).  
  - `DELETE /service-categories/:id` — **ADMIN** only; **409** if the category still has services.

### Files to read / reuse

| File | Role |
|------|------|
| [src/routes/service-categories.routes.js](src/routes/service-categories.routes.js) | Swagger + routing pattern |
| [src/controllers/service-categories.controller.js](src/controllers/service-categories.controller.js) | Prisma + `HttpError` + duplicate name (`P2002`) |
| [src/validations/service-categories.validation.js](src/validations/service-categories.validation.js) | Zod schemas |
| [src/middlewares/auth.middleware.js](src/middlewares/auth.middleware.js) | New: `optionalAuth` (Bearer optional, for public + admin query) |

### Conventions for other devs

- **Money:** expose `Decimal` as **string** in JSON (see `getCategoryById` services).  
- **Errors:** `HttpError` with `code` for 4xx; global handler in [src/middlewares/error.js](src/middlewares/error.js).  
- **Validation:** `validateBody` from [src/validations/validate.js](src/validations/validate.js).  
- **App registration:** [src/app.js](src/app.js) — add new routers the same way as `service-categories`.

---

## Dev 2 — Services (CRUD + list)

**Estimate:** ~12–18 hours

### Responsibilities

- Implement **`/services`** (or split resource name if team agrees — keep REST consistent).  
- **ADMIN:** `POST`, `PATCH`, `DELETE` (decide delete rules if `appointmentServices` reference a service — recommend **409** or forbid delete).  
- **Public or optional auth:** `GET` list with filters, e.g. `categoryId`, `isActive`, search `q` on name, **pagination** (`page`/`limit`).  
- **GET** by id: detail; respect active-only for anonymous like categories unless you align with Dev 1’s `includeInactive` pattern.  
- Validate **`categoryId`** exists before create (404 or 400 with clear code).  
- Swagger JSDoc for every route.

### Suggested files

- `src/routes/services.routes.js`  
- `src/controllers/services.controller.js`  
- Extend or add `src/validations/services.validation.js` (Zod)

### Prisma model

`Service` in [prisma/schema.prisma](prisma/schema.prisma): `categoryId`, `name`, `description`, `durationMin`, `price` (Decimal), `imageUrl`, `isActive`.

---

## Dev 3 — Staff specializations

**Estimate:** ~6–10 hours

### Responsibilities

- Link staff to services they can perform (`StaffSpecialization` — `@@unique([staffId, serviceId])`).  
- **ADMIN** (recommended for MVP):  
  - `POST /staff/:staffId/specializations` — body `{ serviceId }`  
  - `DELETE /staff/:staffId/specializations/:serviceId`  
- **GET** ` /staff/:staffId/specializations` — list service ids or full service summaries (useful for frontend).  
- Verify `staffId` and `serviceId` exist; handle duplicate link with **409**.  
- Swagger for all.

### Suggested files

- `src/routes/staff-specializations.routes.js` (or nested under a `staff` router)  
- `src/controllers/staff-specializations.controller.js`  
- Validation schemas (Zod) colocated or in `src/validations/`

### Depends on

- Dev 2 **services** exist in DB (or seed).  
- **Staff** rows exist — coordinate with Dev 4 seed (staff user + `Staff` profile).

---

## Dev 4 — Wire-up, seed, README / Swagger pass

**Estimate:** ~8–12 hours

### Responsibilities

- Mount **Dev 2** and **Dev 3** routes in [src/app.js](src/app.js).  
- Extend [prisma/seed.js](prisma/seed.js): sample `ServiceCategory` (or rely on API), **Services**, **Staff** user + profile, **StaffSpecialization** links.  
- Quick **README** section: how to run, sample admin login, link to `/docs`.  
- Swagger consistency (tags, security on protected routes).  
- Resolve merge conflicts and **smoke test** all catalog endpoints.

---

## Suggested order

1. Dev 2 starts **services** as soon as categories exist (already in repo / or create via API).  
2. Dev 3 after at least one **Service** + **Staff** in DB.  
3. Dev 4 runs continuously: seed, app wiring, docs.

---

## API quick reference (categories — done)

| Method | Path | Auth |
|--------|------|------|
| GET | `/service-categories` | Optional (admin + `includeInactive=true`) |
| POST | `/service-categories` | Admin Bearer |
| GET | `/service-categories/:id` | Optional |
| PATCH | `/service-categories/:id` | Admin Bearer |
| DELETE | `/service-categories/:id` | Admin Bearer |

**Docs:** `GET /docs` after server start.
