# OrderDZ architecture

Next.js (App Router) on Vercel, Supabase Postgres (+ Auth, Realtime), Prisma.

## Rules
- Money is integer centimes everywhere (`src/lib/money.ts`).
- Every tenant table carries `storeId`. Every query filters by the store of the signed-in user; Postgres row level security is the second lock.
- Order status changes go through `src/lib/status.ts` and write an `OrderEvent`.
- Order numbers (`CMD-YYYY-NNNN`) come from `OrderCounter`, incremented in the same transaction as the order (no `MAX+1`).
- Wilaya codes 01 to 69 (law 26-06 of 4 April 2026).
- Prisma: pooled `DATABASE_URL` for the app, `DIRECT_URL` for migrations.

## Modules
1. Public checkout `/s/[slug]`
2. Confirmation queue
3. Catalog and stock
4. Delivery fees, courier export (CSV first), labels
5. Reporting

## Status machine
PENDING -> NO_ANSWER_1 -> NO_ANSWER_2 -> CONFIRMED -> SHIPPED -> DELIVERED | RETURNED. CANCELLED is allowed before shipping.
