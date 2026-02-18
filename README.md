# P2P Crypto Exchange Backend

Backend project using `Hono + Drizzle + SQLite`.

## Package Manager

- Recommended: `pnpm`
- Also supported: `npm`

## Environment File

Before running, create `.env` in the project root and copy values from `.env.example`.

## Run (pnpm)

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Server: `http://localhost:3000`

## Run (npm)

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

## Reset DB

```bash
pnpm db:reset
pnpm db:seed
```

```bash
npm run db:reset
npm run db:seed
```

## Troubleshooting

If you see `spawn EPERM` when running `drizzle-kit` or `tsx`:

```bash
pnpm approve-builds
pnpm rebuild esbuild
```

If you use `npm`, run:

```bash
npm rebuild esbuild
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
- Image: ![ER Diagram](er-diagram.png)
