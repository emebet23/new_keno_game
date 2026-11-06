<div align="center">

# 🎱 ኬኖ KENO

### Provably-Fair Keno for Telegram — Instant & Live Classic Rounds

A full-stack, production-grade Keno casino game built for the Ethiopian market with a
**Telegram Mini App** frontend, a **Telegram bot** companion, and bilingual
**Amharic / English** UI.

[![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white&style=for-the-badge)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white&style=for-the-badge)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=for-the-badge)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white&style=for-the-badge)](https://vitejs.dev)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white&style=for-the-badge)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white&style=for-the-badge)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white&style=for-the-badge)](https://www.postgresql.org)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socket.io&logoColor=white&style=for-the-badge)](https://socket.io)
[![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white&style=for-the-badge)](https://redis.io)
[![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white&style=for-the-badge)](https://tailwindcss.com)

**`payouts up to 100,000×`** · **`RTP 95%`** · **`HMAC-SHA256 provably fair`** · **`Telebirr & CBE`**

</div>

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [🎮 Game Modes](#-game-modes)
- [📖 How to Play](#-how-to-play)
- [🔐 Provably Fair](#-provably-fair)
- [💰 Payout Table](#-payout-table)
- [🧱 Tech Stack](#-tech-stack)
- [🏗️ Architecture](#️-architecture)
- [🚀 Getting Started](#-getting-started)
- [⚙️ Environment Variables](#️-environment-variables)
- [📂 Project Structure](#-project-structure)
- [🌐 API Overview](#-api-overview)
- [⚡ Socket Events](#-socket-events)
- [🤖 Telegram Bot](#-telegram-bot)
- [🔌 Deployment](#-deployment)
- [📄 License](#-license)

---

## ✨ Features

### 🎮 Gameplay

- **Two game modes** — **Instant** (immediate draw + payout) and **Classic** (scheduled multiplayer rounds every 30s).
- Pick **1–10 numbers** from a **1–80** pool; **20 numbers** are drawn per round.
- **Quick Pick** presets (3/5/7/10) and a full wager selector with presets, stepper, and Max.
- Live **classic countdown** that pauses while a draw is in progress.
- Real-time draw reveal — animated number-by-number via **Socket.IO**.
- Up to **100,000× jackpot** on a 10/10 hit.

### 🔐 Provably Fair

- Server commits a **SHA-256 hash** of its seed _before_ each round.
- Draws are derived with **HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${counter}`)**.
- Seeds are revealed after settlement and verifiable **in-app** (auto or manual) or **offline**.
- Player-controlled **client seed** + copy-to-clipboard verification.

### 💳 Payments (Ethiopian market)

- **Telebirr** deposits with automatic SMS / reference / screenshot verification (OCR).
- **CBE** and **Telebirr** withdrawal destinations with admin approval.
- Dual-wallet model: **Play balance** (deposits/bets) vs **Main balance** (wins/withdrawals).
- **Admin approval** of withdrawals directly from the Telegram bot (Approve / Reject buttons).
- Player-to-player **transfers** and **referral bonuses**.

### 🌐 Bilingual & Polished UI

- Full **Amharic 🇪🇹 / English 🇬🇧** switchable UI.
- Dark neon design system (purple/cyan), glassmorphism cards, haptic vibration & Web Audio SFX.
- **Admin Portal** — live analytics, editable payout table, game settings, user management, reports.

### 🛡️ Security & Ops

- JWT auth (7-day sessions) shared across REST API, WebSocket, and Mini App.
- Authenticated socket connections, Redis rate limiting, and withdrawal double-processing locks.
- Zod input validation, role-based access (USER / ADMIN / SUPERADMIN).

---

## 🎮 Game Modes

|          | ⚡ **Instant Keno**                          | 🕒 **Classic Round**                        |
| -------- | -------------------------------------------- | ------------------------------------------- |
| Draw     | Immediate, settled in the play request       | Scheduled, every **30 seconds**             |
| Payout   | Instant                                      | At end of the round                         |
| Fairness | Full seed revealed immediately in the result | Seed revealed after the round settles       |
| Style    | Single player, fast                          | Multiplayer, live countdown + socket reveal |

---

## 📖 How to Play

1. **Pick your numbers** — tap **1 to 10** balls from the 1–80 grid.
2. **Set your wager** — use the stepper, presets, or type a custom amount.
3. **Choose a mode** — _Instant_ for an immediate result, or _Classic_ to queue a ticket into the live round.
4. **Play** — 20 numbers are drawn. Matches turn **green**.
5. **Win** — payout = `bet × multiplier` (see [payout table](#-payout-table)). Wins go to your **Main balance**.
6. **Verify** — open the **Fairness** tab after any round to confirm the draw was honest.

> 💡 Win nothing if you match fewer numbers than the table requires — but pick 10 and hit them all for the **100,000× jackpot**!

---

## 🔐 Provably Fair

Every round follows a three-step cryptographic protocol:

1. **Commit** — before playing, the server publishes `SHA-256(serverSeed)` (a 64-char hex seed). The hash is revealed on the board before the draw.
2. **Play** — the draw is derived from your seeds, not server randomness:
   ```
   HMAC-SHA256(key = serverSeed, message = `${clientSeed}:${nonce}:${counter}`)
   ```
   Each HMAC output byte → `(byte % 80) + 1`, deduplicated, until **20 unique numbers** are collected. Results are sorted ascending.
3. **Verify** — after the round, the raw `serverSeed` is revealed. Recompute the SHA-256 hash and the draw numbers to confirm they match the committed hash and actual draw.

You can verify **in the app** (Auto tab picks a completed round; Manual tab pastes seeds) or **offline** using any standard HMAC-SHA256 tool — the app even copies the seeds for you.

---

## 💰 Payout Table

Multiplier applied to your bet, keyed by _numbers picked_ → _numbers matched_:

| Picks | Matches → Multiplier                                                              |
| ----- | --------------------------------------------------------------------------------- |
| 1     | `1 → 3.8`                                                                         |
| 2     | `2 → 15`                                                                          |
| 3     | `2 → 2` · `3 → 42`                                                                |
| 4     | `2 → 1` · `3 → 10` · `4 → 100`                                                    |
| 5     | `3 → 2` · `4 → 15` · `5 → 300`                                                    |
| 6     | `3 → 1` · `4 → 7` · `5 → 70` · `6 → 1000`                                         |
| 7     | `4 → 3` · `5 → 20` · `6 → 200` · `7 → 4000`                                       |
| 8     | `4 → 2` · `5 → 10` · `6 → 90` · `7 → 750` · `8 → 10000`                           |
| 9     | `5 → 5` · `6 → 40` · `7 → 300` · `8 → 2500` · `9 → 25000`                         |
| 10    | `0 → 2` · `5 → 2` · `6 → 15` · `7 → 100` · `8 → 500` · `9 → 3000` · `10 → 100000` |

> Target **RTP 95%** · House edge **5%** · Bet range **1 – 10,000 ETB**.
> The whole table and limits are editable live from the **Admin Portal**.

---

## 🧱 Tech Stack

### Backend (`/Backend`)

| Layer         | Technology                                        |
| ------------- | ------------------------------------------------- |
| Runtime       | Node.js 20+, TypeScript 5.8                       |
| API           | Express 5, Zod validation                         |
| Database      | PostgreSQL via Prisma 6                           |
| Realtime      | Socket.IO 4 (JWT-authenticated)                   |
| Cache / Locks | Redis (`ioredis`) with graceful fallback          |
| Bot           | `node-telegram-bot-api` (polling or webhook)      |
| Scheduler     | `node-cron` (classic rounds every 30s)            |
| Payments      | Telebirr verification API + manual admin approval |

### Frontend (`/Frontend`)

| Layer         | Technology                             |
| ------------- | -------------------------------------- |
| UI            | React 19, TypeScript, Tailwind CSS v4  |
| Build         | Vite 6                                 |
| State         | Zustand 5                              |
| Data fetching | TanStack Query 5 + Axios               |
| Realtime      | `socket.io-client`                     |
| Animation     | Motion (Framer Motion) + Web Audio SFX |
| Runtime       | Express server (static + `/api` proxy) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        TELEGRAM                             │
│    Mini App (KenoBoard UI)     ┌──────►  Telegram Bot ──────┤
└──────────────┬──────────────────┘  (menu, deposit/withdraw, │
               │                    admin approve/reject)     │
               │ REST /auth /games ...                        │
┌──────────────▼──────────────────────────────────────────────┐
│                       FRONTEND  (Vite + React)              │
│        Home · Game · History · Wallet · Fairness · Profile  │
│                          │  Socket.IO                       │
┌──────────────────────────▼──────────────────────────────────┐
│                         BACKEND  (Express)                  │
│  Auth ── Wallet ── Game Engine ── Fairness ── Admin ── Bot  │
│       Scheduler (classic 30s) · Rate limits · WebSocket     │
└───────────┬───────────────────────────────┬─────────────────┘
            │                               │
   ┌────────▼────────┐              ┌───────▼────────┐
   │   PostgreSQL    │              │     Redis      │
   │ (Prisma models) │              │ cache · locks  │
   └─────────────────┘              └────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+**
- **PostgreSQL** (local or managed)
- **Redis** (optional — the app falls back to in-memory if Redis is down)
- **A Telegram bot token** from [@BotFather](https://t.me/BotFather)
- A Telegram app for testing the Mini App

### 1. Clone & install

```bash
git clone https://github.com/Shambel96/Keno-Game.git
cd Keno-Game
```

```bash
# Backend
cd Backend
npm install

# Frontend
cd ../Frontend
npm install
```

### 2. Configure environment

```bash
# Backend
cd Backend
cp .env.example .env      # then fill in values — see table below

# Frontend
cd ../Frontend
cp .env.example .env      # set VITE_API_BASE_URL
```

### 3. Prepare the database

```bash
cd Backend
npx prisma migrate dev    # apply schema
npx prisma db seed        # (if a seed script is configured)
```

### 4. Run the backend

```bash
cd Backend
npm run dev               # http://localhost:5000
```

### 5. Run the frontend

```bash
cd Frontend
npm run dev               # http://localhost:3000
```

Open the frontend URL, or point your Telegram bot's Mini App button at it
(`WEBAPP_URL` in the backend `.env`).

> **Frictionless boot:** if no user is logged in, the app auto-registers a
> default `player_one` / `admin_keno` account (dev-mode only) so you can test instantly.

---

## ⚙️ Environment Variables

### Backend

| Variable              | Required | Description                                                    |
| --------------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL`        | ✅       | PostgreSQL connection string                                   |
| `JWT_SECRET`          | ✅       | Secret for signing JWTs (7-day expiry)                         |
| `BOT_TOKEN`           | ✅       | Telegram bot token (empty disables the bot)                    |
| `PORT`                | —        | HTTP port (default `5000`)                                     |
| `NODE_ENV`            | —        | `development` / `production` (gates `/auth/dev-login`)         |
| `REDIS_URL`           | —        | Redis connection (default `redis://localhost:6379`)            |
| `BOT_WEBHOOK_URL`     | —        | If set, the bot runs in webhook mode (`<url>/api/bot/webhook`) |
| `WEBAPP_URL`          | —        | Mini-App URL used by the bot's Play button                     |
| `TELEGRAM_BOT_TOKEN`  | —        | Token used to verify Telegram web-app login hashes             |
| `CORS_ORIGINS`        | —        | Comma-separated allowed Socket.IO origins (default `*`)        |
| `VERIFY_API_BASE_URL` | —        | External Telebirr verification API base                        |
| `LEUL_API_KEY`        | —        | API key for the Telebirr verification service                  |
| `SMS_WEBHOOK_SECRET`  | —        | Secret guarding the Telebirr SMS webhook                       |
| `MERCHANT_PHONE`      | —        | Telebirr merchant number deposits are sent to                  |

### Frontend

| Variable            | Required | Description                                                                   |
| ------------------- | -------- | ----------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | —        | Backend API + socket URL (default `http://localhost:5000`)                    |
| `BACKEND_URL`       | —        | Proxy target for the runtime Express server (default `http://localhost:5000`) |
| `PORT`              | —        | Runtime server port (default `3000`)                                          |
| `DISABLE_HMR`       | —        | Disable HMR/file-watching (CI/editor use)                                     |

---

## 📂 Project Structure

```
Keno-Game/
├── Backend/
│   ├── prisma/
│   │   ├── schema.prisma          # PostgreSQL models
│   │   └── migrations/
│   ├── src/
│   │   ├── server.ts              # Bootstrap: HTTP + socket + scheduler + bot
│   │   ├── app.ts                 # Express app & routers
│   │   ├── config/                # env, prisma, redis
│   │   ├── routes/                # auth, wallet, game, admin
│   │   ├── controllers/           # REST controllers
│   │   ├── services/              # game engine, fairness, scheduler, wallet
│   │   ├── repositories/          # DB + settings (payout table)
│   │   ├── middleware/            # auth, admin, error handlers
│   │   ├── socket/                # Socket.IO server, rooms, events
│   │   ├── scheduler/             # classic-round cron (30s)
│   │   ├── payment/               # Telebirr verification, withdrawals, transfers
│   │   ├── wallet/                # dual-wallet services
│   │   └── bot/                   # Telegram bot (handlers, translations)
│   └── package.json
│
└── Frontend/
    ├── index.html
    ├── vite.config.ts
    ├── server.ts                  # Dev/prod server + /api proxy
    ├── src/
    │   ├── main.tsx               # React bootstrap
    │   ├── App.tsx                # Tabs, nav, socket layer, result modal
    │   ├── index.css              # Tailwind v4 + design system
    │   ├── lib/
    │   │   ├── store.ts           # Zustand global state
    │   │   ├── api.ts             # Axios + auth storage (keno_token)
    │   │   ├── hooks.ts           # React-Query hooks
    │   │   ├── socket.ts          # Socket.IO client
    │   │   ├── crypto.ts          # HMAC-SHA256 draw derivation (verify)
    │   │   └── sound.ts           # Web Audio SFX
    │   └── components/
    │       ├── Home.tsx           # Dashboard
    │       ├── KenoBoard.tsx      # 1–80 number grid
    │       ├── BetControls.tsx    # Wager + play
    │       ├── GameResult.tsx     # Instant result modal
    │       ├── LiveReveal.tsx     # Classic socket reveal
    │       ├── ClassicCountdown.tsx
    │       ├── LiveSocket.tsx     # Global event sync
    │       ├── ProvablyFair.tsx   # Verification UI
    │       ├── Wallet.tsx / History.tsx / Profile.tsx / Settings.tsx
    │       └── features/admin/    # Admin portal
    └── package.json
```

---

## 🌐 API Overview

All endpoints are prefixed with the API base (`http://localhost:5000`).

| Method  | Path                        | Description                                 | Auth       |
| ------- | --------------------------- | ------------------------------------------- | ---------- |
| `POST`  | `/auth/telegram`            | Telegram login → user + JWT                 | —          |
| `POST`  | `/auth/dev-login`           | Dev-only login (development mode)           | —          |
| `GET`   | `/wallet`                   | Current wallet (play + main + total)        | ✅         |
| `GET`   | `/wallet/transactions`      | Paginated transactions                      | ✅         |
| `POST`  | `/wallet/deposit`           | Credit play balance                         | ✅         |
| `POST`  | `/wallet/withdraw`          | Debit main balance                          | ✅         |
| `POST`  | `/games/keno/play`          | Play Instant/Classic (rate-limited)         | ✅         |
| `GET`   | `/games/keno/current`       | Current classic round + committed seed hash | ✅         |
| `GET`   | `/games/keno/result/:id`    | Game / ticket result                        | ✅         |
| `GET`   | `/games/keno/history`       | Paginated user tickets                      | ✅         |
| `GET`   | `/games/keno/provably-fair` | Verify a draw / lookup by gameId            | ✅         |
| `GET`   | `/games/keno/settled-games` | Last 10 settled games                       | ✅         |
| `GET`   | `/games/keno/quick-pick`    | Random numbers (`?count=`)                  | —          |
| `POST`  | `/games/keno/settle`        | Force-settle a game                         | ✅         |
| `GET`   | `/admin/settings`           | Game settings & payout table                | Admin      |
| `PUT`   | `/admin/settings`           | Update settings                             | Admin      |
| `GET`   | `/admin/analytics`          | Financial analytics                         | Admin      |
| `GET`   | `/admin/users`              | Paginated users + search                    | Admin      |
| `PATCH` | `/admin/users/:id/status`   | Suspend / activate                          | Admin      |
| `PATCH` | `/admin/users/:id/role`     | Change role                                 | Superadmin |
| `GET`   | `/admin/reports`            | Daily stats, popular numbers                | Admin      |

**Mini App endpoints** (`telegramId`-based): `GET /wallet/balance`, `GET /wallet/history`,
`GET /games/history`, `POST /wallet/deposit`, `POST /wallet/manual-deposit`,
`POST /wallet/withdraw`, `GET /leaderboard`, `GET /games/:gameId/stats`.

---

## ⚡ Socket Events

Server → Client:

| Event                | Payload                                                                      | Notes                                       |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| `wallet:updated`     | `{ balance, playBalance }`                                                   | Sent to a user's room on any balance change |
| `game:started`       | `{ gameId, roundNumber }`                                                    | A classic settlement began                  |
| `draw:numbers`       | `{ gameId, roundNumber, drawNumbers }`                                       | Draw broadcast                              |
| `game:settled`       | `{ gameId, drawNumbers, serverSeed, serverSeedHash, tickets, playerPayout }` | Per-user settlement with revealed seed      |
| `deposit:new`        | `{ type, userName, phone, amount }`                                          | Admin room deposit/withdrawal alerts        |
| `withdrawal_settled` | `{ withdrawalId, status }`                                                   | Admin room approval outcome                 |

Client → Server: `join_user_room`, `join_admin_room`, `disconnect`.

---

## 🤖 Telegram Bot

The companion bot (`@KenoBot`) handles everything outside the Mini App:

- **Registration** — one-tap **Share Contact** flow; new users get a wallet with a **20 ETB** welcome play balance. Referral deep links pay a **1 ETB** bonus to both parties.
- **Deposits** — paste a reference code, paste the full Telebirr SMS, or upload a screenshot (OCR). Auto-verified and credited to your **play balance**.
- **Withdrawals** — choose **Telebirr** or **CBE**, amount (min **500 ETB** from main balance) → admins get an inline **Approve / Reject** card → you're notified of the outcome (refunds on rejection).
- **Transfers** — send balance to another player by username, phone, or Telegram ID (min **20 ETB**).
- **Menus** — Balance, History, Invite Friends, Convert Bonus, How to Play, and Amharic/English toggle.

Commands: `/start` `/help` `/play` `/balance` `/deposit` `/withdraw` `/transfer` `/support` `/invite` `/language`.

---

## 🔌 Deployment

### Backend

```bash
cd Backend
npm run build          # tsc → dist/
npm start              # node dist/server.js
```

Run behind a reverse proxy (nginx/Caddy). Set `BOT_WEBHOOK_URL=https://your-domain/api/bot/webhook`
and switch the bot to webhook mode for production.

### Frontend

```bash
cd Frontend
npm run build          # vite build + bundled server
npm start              # serves static SPA + /api proxy on :3000
```

### Suggested production stack

| Piece         | Suggested               |
| ------------- | ----------------------- |
| Host          | Any Node.js PaaS / VPS  |
| Database      | Managed PostgreSQL      |
| Cache         | Managed Redis           |
| Reverse proxy | nginx / Caddy with TLS  |
| Bot           | Webhook mode behind TLS |

---

## 📄 License

ISC © Shambel96 — see the `LICENSE` file for details.

---

<div align="center">

**Made for Ethiopian players — play fair, win big!**

[⬆ Back to top](#-ኬኖ-keno)

</div>
