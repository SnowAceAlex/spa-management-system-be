# Spa Management System (BE)

Backend cho đề tài **CRM spa/salon** (hiện tại: setup codebase + User/auth).

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
- `prisma/schema.prisma`: `User`, `RefreshToken`

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

Seed mặc định tạo admin theo:

- `SEED_ADMIN_EMAIL` (default `admin@example.com`)
- `SEED_ADMIN_PASSWORD` (default `Admin12345!`)

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
