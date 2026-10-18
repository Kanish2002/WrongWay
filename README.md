# WRONG WAY

**Two minds. Ten walls. One way through.** A cinematic, installable 9×9 Quoridor-inspired strategy game for exactly two players.

- Pass & Play (one phone), private online rooms (six-character codes), and Easy / Medium / Hard bots.
- Shared deterministic rule engine, BFS path safety, straight / diagonal jumps, wall overlap / crossing validation.
- SVG tabletop board with tactile drag-to-snap wall preview, keyboard shortcuts, haptics, synthesized SFX, animations, tutorial, dark / paper themes, local stats and PWA cache.
- Server-authoritative Socket.IO online matches, ready-up, countdown, room expiry, private reconnect tokens, 60-second disconnect grace, timer auto-moves, draw / resign / rematch.

## Quick start

**Requirements:** Node.js 20.19+ or 22+, npm 10+.

```bash
npm install
npm run build -w @wrongway/rules
npm run dev
```

Web app: <http://localhost:5173> · Room server health: <http://localhost:3001/health>. Both apps start with `npm run dev`. Local bot / pass & play work offline after the PWA has been installed or visited once while connected.

```bash
npm test                # Vitest rules tests
npm run test:engine     # Dependency-free node:test checks (after compiling rules)
npm run build           # Rules + server + web
npm run start -w @wrongway/server
```

## Monorepo

```text
WrongWay/
├── apps/
│   ├── web/
│   │   ├── public/icon.svg
│   │   ├── src/
│   │   │   ├── App.tsx                  # All responsive screens + game flow
│   │   │   ├── components/Board.tsx     # Interactive SVG board + wall drag
│   │   │   ├── workers/bot.worker.ts    # Difficulty AI, depth-3 alpha-beta
│   │   │   ├── lib.ts                   # Persistence, settings, sound, haptics
│   │   │   ├── main.tsx
│   │   │   └── styles.css               # Tokens, components, motion, breakpoints
│   │   ├── index.html
│   │   ├── vite.config.ts               # Manifest + offline service worker
│   │   ├── .env.example
│   │   └── package.json
│   └── server/
│       ├── src/index.ts                 # Private room & turn state machine
│       ├── package.json
│       └── tsconfig.json
├── packages/rules/
│   ├── src/index.ts                     # Pure shared Quoridor engine
│   ├── src/index.test.ts                # Vitest engine tests
│   ├── src/engine.node.mjs              # node:test suite
│   └── package.json
├── docs/DESIGN_SYSTEM.md
├── docs/QA_MOBILE.md
├── package.json
└── tsconfig.json
```

## Design system

See [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for colors, components, motion, accessibility and audio implementation.

## Socket.IO event protocol

**Client → server** (with acknowledgment `{ok, error?}`):

| Event | Payload | Notes |
|---|---|---|
| `create_room` | `{ name, timer: 0\|30\|60, hostFirst }` | Returns `{ code, token, seat, room }` |
| `join_room` | `{ code, name, token? }` | Existing token reclaims seat; room must be lobby for new seats |
| `ready` | `{ code, ready }` | Both players ready starts 3-second countdown |
| `play_action` | `{ code, action }` | `{type:'move',to:{r,c}}` or `{type:'wall',wall:{r,c,orientation:'h'\|'v'}}` |
| `resign` | `{ code }` | Forfeit |
| `offer_draw` / `accept_draw` | `{ code }` | Draw request / acceptance |
| `rematch` | `{ code }` | Both agree; reset lobby and swap first mover |
| `reaction` | `{ code, emoji }` | Allowlisted emoji only |
| `leave_room` | `{ code }` | Leave / resign |

**Server → client:** `state_update` (authoritative room snapshot), `game_over` (`winnerId`, `reason`), `draw_offer`, `reaction`, `notice`.

The server never accepts a complete game state from a client. Actions are parsed with Zod and validated by the shared rules engine before any broadcast. Guest tokens are 48-hex-character secrets saved in the browser's local storage. There are no free-text chat messages or accounts.

## Production deployment

### 1. WebSocket service: Render / Railway / Fly.io

Use a persistent Node service, not a serverless function. Root directory: repository root.

- Build command: `npm install --no-audit --no-fund && npm run build -w @wrongway/rules && npm run build -w @wrongway/server`
- Start command: `npm run start -w @wrongway/server`
- Environment: `NODE_ENV=production`, `PORT` (platform assigns it), `CLIENT_ORIGIN=https://YOUR-CLIENT.vercel.app`
- Health endpoint: `/health`
- Ensure WebSockets are enabled and the instance remains available. An in-memory room map requires a **single instance**. For horizontal scaling, use sticky sessions and Redis state + Socket.IO adapter before adding replicas.

### 2. Frontend: Vercel / Netlify

- Framework: Vite
- Root directory: `apps/web` if deploying directly with a separate build step, or use repository root and output `apps/web/dist`.
- Recommended monorepo build command (from root): `npm install --no-audit --no-fund && npm run build -w @wrongway/rules && npm run build -w @wrongway/web`
- Output directory: `apps/web/dist`
- Set `VITE_SERVER_URL=https://YOUR-SERVER.onrender.com` at **build time**. Also set server `CLIENT_ORIGIN` to the exact deployed frontend origin, without trailing slash.
- For Netlify, add an SPA rewrite (`/* /index.html 200`); Vercel provides Vite SPA fallback, or use `vercel.json` for rewrites if needed.
- The service worker caches static assets. Never cache `/socket.io`; multiplayer always requires connectivity.

### 3. Test before enabling public traffic

Visit both sites over HTTPS. Check `/health`, create a room in Chrome, join through a second device in Safari, ready up, move/jump/build, disconnect one device for 20 seconds and reconnect with the same code, test the 60-second grace, retry the rematch, and install as a PWA. Verify CORS, socket upgrades and no mixed-content errors.

## Known production hardening notes

The project is an implemented **candidate**, not an audited public deployment. For large user volumes, add shared Redis persistence, distributed matchmaking-free room lifecycle, monitoring, integration tests with real browsers, and a clear privacy policy. Guest sessions and statistics are browser-local. A room disappears when the backend instance restarts; use Redis/database persistence if that must survive deployments.

This is an original wall-and-path game interface. It is not affiliated with, endorsed by, or using art assets from the original Quoridor publisher.
