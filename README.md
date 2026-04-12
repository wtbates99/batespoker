# ♠ BATESPOKER — The Vault

> *Texas Hold'em poker in an underground club. Solo vs AI or multiplayer with friends.*

A self-hosted, open-source Texas Hold'em poker application inspired by **Poker Night at the Inventory**. Play against four degenerate AI characters with distinct personalities, or host a private table and deal in your friends in real-time.

## Features

- **Solo vs AI** — Four unique opponents with adjustable difficulty and witty dialogue
- **Multiplayer rooms** — Generate a 6-char code and share it with friends (up to 6 players)
- **Complete Texas Hold'em** — Pre-flop through river, side pots, all-in handling, showdown
- **Real-time** — Socket.IO for instant multiplayer game state sync
- **Persistent stats** — SQLite stores game history and leaderboard data
- **Auth** — Optional accounts for stats tracking; guest play always available
- **Self-hosted** — Docker Compose, no external APIs, no subscriptions

## AI Characters

| Character | Difficulty | Style | Quote |
|-----------|-----------|-------|-------|
| 🎩 **Baron Von Chips** | Hard | Position play, c-bets, semi-bluffs | *"Your incompetence has a certain... artistry."* |
| 🤠 **Lucky McGee** | Easy | Calls everything, rarely bluffs | *"YEEHAW! Hot dog, I KNEW it!"* |
| 👸 **The Duchess** | Medium | Solid fundamentals, cold contempt | *"Do try to keep up, darling."* |
| 🃏 **The Jester** | Legendary | Near-GTO, mixed strategies, chaos | *"I'm statistically certain this will work. Statistically. Ish."* |

---

## Self-Hosting

### Docker Compose (recommended)

```bash
git clone https://github.com/wtbates99/batespoker
cd batespoker

# Create environment file
cp .env.example .env
# Edit .env: set JWT_SECRET to a secure random string

# Build and run
docker compose up --build
```

Open `http://localhost:3000`.

### Manual

```bash
npm install
npm run build
npm start
```

Requires Node 20+.

### Environment Variables

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `JWT_SECRET` | Yes | — | Secret for JWT signing (min 32 chars) |
| `DB_PATH` | No | `.poker-data/poker.db` | SQLite database path |
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | Set to `production` in prod |

## Architecture

```
Next.js 14 (App Router)
├── Custom HTTP server (server.ts)
│   └── Socket.IO — real-time multiplayer rooms
├── API Routes — auth, leaderboard
├── SQLite (better-sqlite3) — users, game history
└── Poker Engine (lib/poker/)
    ├── deck.ts — card representation, shuffle, deal
    ├── evaluator.ts — 5/7-card hand evaluation, comparisons
    ├── ai.ts — AI decision engine, character dialogue
    └── engine.ts — Texas Hold'em state machine
```

**Stack:** Next.js 14 · TypeScript · Socket.IO · SQLite · Tailwind CSS

---

## Development

```bash
npm install
npm run dev       # starts custom server with hot reload
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
npm run build     # production build
```

---

## License

MIT — see [LICENSE](LICENSE)
