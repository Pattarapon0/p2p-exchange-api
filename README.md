# P2P Crypto Exchange Backend

Backend exam project using `Hono + Drizzle + SQLite`.

## Run

```powershell
pnpm install
Copy-Item .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Server: `http://localhost:3000`

## Reset DB

```bash
pnpm db:reset
pnpm db:seed
```

## Test Users

- `alice@example.com / Password123!`
- `bob@example.com / Password123!`
- `carol@example.com / Password123!`
- `dave@example.com / Password123!`

## Main Routes

- `POST /auth/register`
- `POST /auth/login`
- `GET /wallets`
- `GET /wallets/transactions`
- `GET /orders/markets`
- `GET /orders`
- `POST /orders`
- `GET /orders/me`
- `POST /orders/:id/cancel`
- `GET /trades/me`
- `POST /trades/take/:orderId`
- `POST /trades/:id/mark-paid`
- `POST /trades/:id/release`
- `POST /transfers/internal`
- `GET /transfers/internal/me`
- `POST /withdrawals`
- `GET /withdrawals/me`
- `GET /transactions`

## ER Diagram

- Source file: `er-diagram.mmd`
