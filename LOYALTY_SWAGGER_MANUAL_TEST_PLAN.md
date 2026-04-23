# Swagger Manual Test Plan - Loyalty Phase 1

Use this plan in Swagger UI at `http://localhost:3000/docs` (or your running port).

## 1) Prep Data and Accounts

- Ensure server is running and database is connected.
- Prepare 2 users:
  - `CUSTOMER` account (for `GET /loyalty/me`)
  - `ADMIN` account (for `GET /loyalty/customers/{customerId}`)
- Ensure at least one appointment can be completed and invoiced for that customer.

## 2) Login and Save Tokens

- In Swagger, call `POST /auth/login` for customer and admin.
- Copy each access token.
- Click **Authorize** in Swagger and set `Bearer <token>` for the role you are testing.

## 3) Baseline Loyalty Check (Before Payment)

- As `CUSTOMER`, call `GET /loyalty/me`.
- Expected:
  - `200`
  - `loyalty.score` is `0` (or existing value if customer already has history)
  - `tier` is typically `BRONZE` initially

## 4) Create or Prepare a Payable Invoice

- Complete appointment flow so invoice can be paid.
- Generate invoice from appointment endpoint (project flow).
- Verify with `GET /invoices/{id}`:
  - `paymentStatus` is `UNPAID` or `PARTIALLY_PAID`
  - Save `invoice.id`, `appointment.customerId`, and `totalAmt`

## 5) Pay Invoice (Offline Path)

- As `ADMIN` or allowed `STAFF`, call `PATCH /invoices/{id}/mark-paid`.
- Example body:

```json
{
  "amount": 100000,
  "paymentMethod": "CASH"
}
```

- Expected:
  - `200`
  - Invoice `paymentStatus` becomes `PAID`

## 6) Verify Loyalty Earned

- As `CUSTOMER`, call `GET /loyalty/me` again.
- Expected:
  - `score` increased by `floor(totalAmt / LOYALTY_POINTS_PER_SPEND_UNIT)`
  - `lifetimeScore` increased by same amount
  - `tier` updated if threshold crossed

## 7) Verify Admin Read Endpoint

- As `ADMIN`, call `GET /loyalty/customers/{customerId}`.
- Expected:
  - `200`
  - Returned values match customer perspective for same account

## 8) Idempotency Test (No Double Earn)

- Attempt to trigger payment processing for same invoice again:
  - Call `PATCH /invoices/{id}/mark-paid` again (should be not payable), or
  - Replay same Stripe webhook event once (if webhook setup exists)
- Re-check loyalty endpoint.
- Expected:
  - Score and lifetime score do not increase again
  - No double-credit for same invoice

## 9) Authorization and Role Checks

- Call `GET /loyalty/me` with admin token:
  - Expected `403` (customer-only route)
- Call `GET /loyalty/customers/{customerId}` with customer token:
  - Expected `403` (admin-only route)
- Call both without token:
  - Expected `401`

## 10) Tier Boundary Validation (Optional)

- Temporarily lower thresholds in `.env`, restart server:
  - Example: silver=1, gold=2, platinum=3
- Pay invoices and verify transitions:
  - `BRONZE -> SILVER -> GOLD -> PLATINUM`

## Quick Pass/Fail Checklist

- `GET /loyalty/me` works for customer only.
- `GET /loyalty/customers/{customerId}` works for admin only.
- Points are awarded only when invoice becomes `PAID`.
- Points formula follows configured spend unit.
- Same invoice cannot award points twice.
- Tier updates when `lifetimeScore` crosses configured thresholds.
