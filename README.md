# Spa Management System (BE)

## Tech stack

- Node.js + Express.js (ESM)
- JWT auth (access + refresh, có rotate)
- Swagger UI (`/docs`)
- Neon Postgres + Prisma ORM

## Cấu trúc chính

- `server.js`: entry point
- `swagger.js`: Swagger docs config
- `src/app.js`: express app + middleware + mount routes
- `src/routes/auth.routes.js`: `/auth/register|login|refresh|logout`
- `src/routes/users.routes.js`: `/users/me`
- `src/controllers/*`: handler logic (business)
- `src/validations/*`: Zod schemas + validate middleware
- `src/config/db.js`: Prisma client
- `prisma/schema.prisma`: `User`, `RefreshToken`, `ServiceCategory`, `Service`, `Staff`, `StaffSpecialization`
- `src/routes/service-categories.routes.js`: `/service-categories`
- `src/routes/services.routes.js`: `/services`
- `src/routes/staff-specializations.routes.js`: `/staff/:staffId/specializations`

## Setup & chạy local

### 1) Cài dependencies

```bash
npm install
```

### 2) Tạo file `.env`

Copy từ `.env.example` sang `.env` và điền giá trị thật.

Các biến quan trọng:

- `DATABASE_URL`: connection string Neon (Postgres). Có thể dùng **pooler** cho runtime.
- `DIRECT_URL`: connection string **direct (non-pooler)** để chạy Prisma migrate (tránh lỗi advisory lock timeout).
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: chuỗi bí mật đủ dài (>= 20 ký tự)

### 3) Migrate DB + seed admin

```bash
npx prisma migrate dev
npx prisma db seed
```

Seed mặc định tạo các tài khoản sau:

| Role  | Email             | Password    |
|-------|-------------------|-------------|
| Admin | admin@example.com | Admin12345! |
| Staff | staff@example.com | Staff12345! |

### 4) Run dev

```bash
npm run dev
```

Mở:

- Swagger UI: `http://localhost:3000/docs`
- Health check: `http://localhost:3000/health`

## Test nhanh bằng Swagger

1. **POST** `/auth/register` để tạo user (customer)
2. **POST** `/auth/login` lấy `accessToken` + `refreshToken`
3. Trong Swagger, bấm **Authorize** → dán `Bearer <accessToken>`
4. **GET** `/users/me`
5. **POST** `/auth/refresh` để rotate token

Lưu ý:

- `/auth/refresh` và `/auth/logout` cần gửi **`refreshToken`** trong body để server có thể rotate/revoke đúng “session”.

## Scripts

- `npm run dev`: chạy với nodemon
- `npm start`: chạy production-like
- `npm run lint`: eslint
- `npm run format`: prettier
- `npm run prisma:migrate`: prisma migrate dev
- `npm run prisma:studio`: prisma studio
- `npm run db:seed`: prisma db seed

## Catalog endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/service-categories` | Optional |
| POST | `/service-categories` | Admin |
| GET | `/service-categories/:id` | Optional |
| PATCH | `/service-categories/:id` | Admin |
| DELETE | `/service-categories/:id` | Admin |
| GET | `/services` | Optional |
| POST | `/services` | Admin |
| GET | `/services/:id` | Optional |
| PATCH | `/services/:id` | Admin |
| DELETE | `/services/:id` | Admin |
| GET | `/staff/:staffId/specializations` | Optional |
| POST | `/staff/:staffId/specializations` | Admin |
| DELETE | `/staff/:staffId/specializations/:serviceId` | Admin |

> Các route có auth **Optional**: public user thấy data `isActive: true`, admin thêm `?includeInactive=true` để thấy tất cả.
> Các route **Admin**: cần header `Authorization: Bearer <accessToken>`.
