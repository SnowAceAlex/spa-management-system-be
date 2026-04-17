# Spa Management System (BE)

## Tech stack

- Node.js + Express.js (ESM)
- JWT auth (access + refresh, có rotate)
- Swagger UI (`/docs`)
- Neon Postgres + Prisma ORM
- Stripe Checkout (thanh toán online, mặc định VND)

## Cấu trúc chính

- `server.js`: entry point
- `swagger.js`: Swagger docs config
- `src/app.js`: express app + middleware + mount routes (raw body cho `/webhooks` trước `express.json`)
- `src/config/db.js`: Prisma client
- `src/config/stripe.js`: Stripe SDK singleton
- `src/controllers/*`: handler logic (business)
- `src/services/invoice.service.js`: logic tạo invoice + apply payment (dùng chung cho auto + manual)
- `src/routes/*`: Express routers + Swagger JSDoc
- `src/validations/*`: Zod schemas + validate middleware
- `prisma/schema.prisma`: `User`, `RefreshToken`, `Customer`, `Staff`, `ServiceCategory`, `Service`, `StaffSpecialization`, `StaffSchedule`, `Appointment`, `AppointmentService`, `Invoice`, `LoyaltyAccount`, `LoyaltyTransaction`, `LoyaltyReward`, `CustomerReward`, `Review`, `Promotion`, `Notification`

## Các module đã implement

| Module | Mô tả |
|---|---|
| Auth | Register, login, refresh-token rotation, logout, logout-all, role guard |
| Users | `/users/me`, admin CRUD cơ bản |
| Service Catalog | `ServiceCategory` + `Service` CRUD, public list/search (ẩn inactive), admin xem tất cả |
| Staff Specialization | Map staff ↔ service (admin) |
| Staff Schedule | Lịch làm việc theo ngày trong tuần + availability |
| Appointment | Customer đặt lịch, validate xung đột + giờ làm, status workflow (PENDING → CONFIRMED → IN_PROGRESS → COMPLETED), cancel |
| **Invoice + Payment** | Auto tạo invoice khi appointment COMPLETED (idempotent), Stripe Checkout online (VND), mark-paid offline (CASH), webhook đồng bộ trạng thái |

Các module chưa implement (có schema, để dành cho bước sau): Loyalty (points + tier), Reviews, Promotions.

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
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: chuỗi bí mật đủ dài (>= 20 ký tự).
- `STRIPE_SECRET_KEY`: khóa bí mật Stripe (test mode, lấy ở Dashboard > Developers > API keys).
- `STRIPE_WEBHOOK_SECRET`: lấy từ `stripe listen` (xem phần Stripe bên dưới).
- `STRIPE_CURRENCY`: mặc định `vnd`.
- `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`: URL frontend redirect sau khi pay.

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

- `/auth/refresh` và `/auth/logout` cần gửi **`refreshToken`** trong body để server có thể rotate/revoke đúng "session".

## Scripts

- `npm run dev`: chạy với nodemon
- `npm start`: chạy production-like
- `npm run lint`: eslint
- `npm run format`: prettier
- `npm run prisma:migrate`: prisma migrate dev
- `npm run prisma:studio`: prisma studio
- `npm run db:seed`: prisma db seed

---

## API Reference

### Auth

| Method | Path | Auth |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/refresh` | Public (body `refreshToken`) |
| POST | `/auth/logout` | Public (body `refreshToken`) |
| POST | `/auth/logout-all` | User |

### Users

| Method | Path | Auth |
|---|---|---|
| GET | `/users/me` | User |
| PATCH | `/users/me/profile` | User |
| GET | `/users` | Admin |
| GET | `/users/:id` | Admin |
| PATCH | `/users/:id` | Admin |

### Service Catalog

| Method | Path | Auth |
|---|---|---|
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

> Các route có auth **Optional**: public user chỉ thấy data `isActive: true`, admin thêm `?includeInactive=true` để thấy tất cả.

### Staff Specializations & Schedules

| Method | Path | Auth |
|---|---|---|
| GET | `/staff/:staffId/specializations` | Optional |
| POST | `/staff/:staffId/specializations` | Admin |
| DELETE | `/staff/:staffId/specializations/:serviceId` | Admin |
| GET | `/staff/:staffId/schedules` | Optional |
| POST | `/staff/:staffId/schedules` | Admin/Staff (owner) |
| PATCH | `/staff/:staffId/schedules/:id` | Admin/Staff (owner) |
| DELETE | `/staff/:staffId/schedules/:id` | Admin/Staff (owner) |
| GET | `/staff/:staffId/availability` | Optional |

### Appointments

| Method | Path | Auth |
|---|---|---|
| POST | `/appointments` | Customer |
| GET | `/appointments` | User (role-filtered) |
| GET | `/appointments/:id` | User (owner/assigned/admin) |
| PATCH | `/appointments/:id/status` | Admin/Staff |
| PATCH | `/appointments/:id/cancel` | Admin/Staff/Customer |
| POST | `/appointments/:id/invoice` | Admin/Staff (idempotent) |

> Khi `PATCH /appointments/:id/status` chuyển sang `COMPLETED`, hệ thống **tự động tạo Invoice** trong cùng một transaction.

### Invoices

| Method | Path | Auth |
|---|---|---|
| GET | `/invoices` | User (role-filtered) |
| GET | `/invoices/:id` | User (owner/assigned/admin) |
| POST | `/invoices/:id/checkout-session` | Customer/Staff/Admin |
| PATCH | `/invoices/:id/mark-paid` | Admin/Staff |

### Webhooks

| Method | Path | Auth |
|---|---|---|
| POST | `/webhooks/stripe` | Stripe signature only |

---

## Hướng dẫn Stripe ở local

### 1) Tạo Stripe test account

1. Đăng ký tài khoản Stripe tại https://dashboard.stripe.com/register (miễn phí, không cần nhập info thật).
2. Bật chế độ **Test mode** (toggle góc trên bên phải → "Viewing test data").
3. Vào **Developers → API keys** → copy **Secret key**.
4. Paste vào `.env`:

```env
STRIPE_SECRET_KEY="YOUR_STRIPE_SECRET_KEY"
STRIPE_CURRENCY="vnd"
STRIPE_SUCCESS_URL="http://localhost:5173/payment/success"
STRIPE_CANCEL_URL="http://localhost:5173/payment/cancel"
```

### 2) Cài đặt Stripe CLI bằng Scoop (Windows)

Stripe CLI là tool riêng, không phải npm package. Trên Windows dùng Scoop là nhanh nhất.

#### Cài Scoop (nếu chưa có)

Mở **PowerShell** (không cần Admin) và chạy:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

Kiểm tra:

```powershell
scoop --version
```

#### Cài Stripe CLI

```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

Kiểm tra:

```powershell
stripe --version
```

### 3) Login Stripe CLI

```powershell
stripe login
```

Nó sẽ mở browser → confirm → quay lại terminal là xong. Chỉ cần làm 1 lần trên máy.

### 4) Forward webhook về local server

Mở **một terminal riêng** (để nó chạy nền suốt quá trình dev):

```powershell
stripe listen --forward-to localhost:3000/webhooks/stripe
```

Output sẽ in ra dòng:

```
> Ready! Your webhook signing secret is <your_webhook_signing_secret> (^C to quit)
```

Copy giá trị webhook signing secret ở dòng trên vào `.env`:

```env
STRIPE_WEBHOOK_SECRET="YOUR_STRIPE_WEBHOOK_SECRET"
```

**Restart lại dev server** (`npm run dev`) để nó load secret mới.

### 5) Test full flow thanh toán

1. Login bằng account **customer**, book appointment (`POST /appointments`).
2. Login bằng **staff**, chuyển status appointment → `COMPLETED` (`PATCH /appointments/:id/status`). Invoice sẽ auto-create.
3. Login lại bằng **customer**, gọi `POST /invoices/:id/checkout-session` → nhận `{ url }`.
4. Mở `url` đó trên browser → trang Stripe Checkout hosted.
5. Nhập test card của Stripe:
   - Số thẻ: `4242 4242 4242 4242`
   - Expiry: bất kỳ ngày trong tương lai (vd: `12/34`)
   - CVC: 3 chữ số bất kỳ (vd: `123`)
   - Tên + email: bất kỳ
6. Submit → Stripe redirect về `successUrl`.
7. Trong terminal `stripe listen` sẽ thấy:

   ```
   --> checkout.session.completed [evt_...]
   <-- [200] POST http://localhost:3000/webhooks/stripe
   ```

8. `GET /invoices/:id` → `paymentStatus: "PAID"`, `paymentMethod: "STRIPE"`, `paidAt` có giá trị.
9. `GET /appointments/:id` → `paymentStatus: "PAID"` (được đồng bộ qua webhook).

### 6) Test thanh toán offline (CASH)

Nếu khách trả tiền mặt tại quầy, staff/admin gọi:

```http
PATCH /invoices/:id/mark-paid
Content-Type: application/json

{
  "amount": 500000,
  "paymentMethod": "CASH",
  "note": "Paid at counter"
}
```

- Nếu `amount >= totalAmt` → `paymentStatus: "PAID"`.
- Nếu ít hơn → `PARTIALLY_PAID`, gọi tiếp endpoint này cho đến khi đủ.

### 7) Các card test khác của Stripe

| Card | Mô tả |
|---|---|
| `4242 4242 4242 4242` | Thành công |
| `4000 0025 0000 3155` | Yêu cầu 3D Secure (bấm Authorize) |
| `4000 0000 0000 9995` | Fail (insufficient funds) |
| `4000 0000 0000 0002` | Fail (card declined) |

### 8) Lưu ý về VND

- VND là **zero-decimal currency** trong Stripe: amount truyền sang Stripe là **số tiền nguyên** (vd: `500000` cho 500,000đ), **không nhân 100**. Code đã xử lý đúng trong `src/services/invoice.service.js` (`toStripeUnitAmount`).
- Một số Stripe test account (thuộc country không support VND) có thể không hiển thị được trang Checkout với VND. Nếu gặp lỗi "Something went wrong" trên trang Stripe, tạm thời đổi `STRIPE_CURRENCY="usd"` để test, sau đó bật lại VND trên production.
- Stripe Dashboard → **Settings → Payment methods** cần enable **Card** payments.

### 9) Troubleshooting

| Lỗi | Nguyên nhân | Cách fix |
|---|---|---|
| `POST /invoices/:id/checkout-session` → 500 `STRIPE_NOT_CONFIGURED` | `STRIPE_SECRET_KEY` chưa set hoặc server chưa restart | Set env → restart `npm run dev` |
| `[stripe-webhook] Signature verification failed` | `STRIPE_WEBHOOK_SECRET` không khớp với secret từ `stripe listen` | Copy lại `whsec_...` mới, restart server |
| Stripe Checkout page 404 / "page not found" | Session đã bị consume hoặc expired (single-use) | Tạo session mới (`POST /invoices/:id/checkout-session`) và mở ngay |
| Webhook không bắn về local | `stripe listen` chưa chạy, hoặc đã bị đóng | Mở lại terminal chạy `stripe listen --forward-to localhost:3000/webhooks/stripe` |
| Invoice vẫn `UNPAID` sau khi pay | Webhook không tới backend | Kiểm tra terminal `stripe listen` có log `checkout.session.completed` không, check server log `[stripe-webhook]` |

### 10) Trigger event giả để test nhanh

Mở terminal thứ 3 (không cần thanh toán thật):

```powershell
stripe trigger checkout.session.completed
```

Event này không có `metadata.invoiceId` của bạn nên controller sẽ log warning `missing invoiceId metadata` — đó là expected. Để test đầy đủ, vẫn phải đi qua flow `POST /invoices/:id/checkout-session`.

---

## Roadmap

- [ ] Loyalty points + tier (tự động cộng điểm khi invoice PAID)
- [ ] Reviews module
- [ ] Promotions module (validate code khi tạo invoice)
- [ ] Refund (Stripe Refund API + status lifecycle)
- [ ] Notifications (email/SMS reminder)
