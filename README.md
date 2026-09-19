# Tabulator Pro - Universal Contest Tabulation Platform

Full-fledged web app for contest tabulation with **RBAC** (Head Tabulator / Assistant Tabulator / Judge) and **Audit Log**. Runs on a local server and can be uploaded to any physical server (VPS, dedicated, on-prem).

> **Angular Transformation:** Original vanilla `index.html` (2961 LOC) has been migrated to **Angular 20 (standalone + signals)** at `frontend/` while Express backend `server.js` remains as API. Build output `frontend/dist/frontend/browser` is served by Express; legacy `public/index.html` is fallback if no build exists.

## Project Structure

```
D:\tabulate\
├── backend/                # Express backend (Node 20)
│   ├── server.js           # API + static serving (frontend/dist fallback → backend/public)
│   ├── package.json        # backend deps: express, helmet, zod, bcryptjs, jsonwebtoken
│   ├── data/
│   │   └── app-state.json  # Persisted state (gitignored, POST /api/state)
│   ├── logs/               # PM2 logs (backend/logs/)
│   ├── public/
│   │   └── index.html      # Legacy vanilla fallback (served if no Angular build)
│   ├── .env / .env.example # JWT_SECRET, PORT, HOST
│   └── ecosystem.config.js # PM2 → ./server.js
├── frontend/               # Angular 20 SPA (standalone)
│   ├── src/app/
│   │   ├── core/           # api.service.ts, auth.service.ts, state.service.ts, interceptors
│   │   ├── features/auth/  # LoginComponent
│   │   ├── features/shell/ # ShellComponent (header + contest toolbar)
│   │   ├── features/judge/ # ScorecardComponent (judge terminal 0→weight direct-sum)
│   │   ├── features/tabulator/ # Setup / Audit / Leaderboard / AuditLogs
│   │   ├── shared/         # NoticeModal, ConfirmModal, Header
│   │   ├── guards/         # authGuard, headGuard
│   │   └── models/         # app-state.model.ts
│   ├── tailwind.config.js  # Tailwind 3.4 (PostCSS build, not CDN)
│   ├── proxy.conf.json     # dev proxy /api -> :3000 (backend)
│   └── dist/frontend/browser/ # ng build output (served by backend)
├── package.json            # Root workspaces orchestrator (frontend + backend)
├── Dockerfile              # Multi-stage: frontend-build → backend (backend/server.js)
├── docker-compose.yml      # Volumes: ./backend/data, ./backend/logs, env_file: backend/.env
├── nginx.conf              # proxy_pass → backend:3000
├── .gitignore / .dockerignore
└── index.html              # Legacy root copy (direct file open)
```

## Quick Start - Local Server

### Prerequisites
- Node.js >= 18 (tested on v24.18.1)
- npm >= 8

### 1. Install & Run — Production (Angular built)

```powershell
# In D:\tabulate (workspaces root)
npm install                 # installs root + frontend + backend (workspaces)
# or separately:
npm --prefix backend install
npm --prefix frontend install
npm run build               # builds frontend/dist/frontend/browser
npm start                   # → npm --prefix backend start (serves frontend/dist)
# backend directly:
npm --prefix backend start
```

### 1b. Development (HMR + API proxy)

```powershell
# Terminal 1: Express API on :3000
npm run dev                 # → npm --prefix backend run dev (watch backend/server.js)
# or: npm --prefix backend run dev
# Terminal 2: Angular on :4200 proxied to /api
npm run client:dev
# or both together:
npm run dev:full
```

Open:
- **App (prod):** http://localhost:3000 (Angular)
- **App (dev):** http://localhost:4200 (Angular dev server, proxy /api -> 3000)
- **Health:** http://localhost:3000/api/health
- **Info:** http://localhost:3000/api/info

Default credentials (from `public/index.html:788`):
- Head Tabulator: `admin` / `Bayugan123`
- Judges: `Bayugan123` (per judge, editable in Setup)
- Assistant Tabulators: created by Head via Setup UI

### 2. Test

```powershell
curl http://localhost:3000/api/health
curl http://localhost:3000/
```

## API (Optional Server-Side Persistence)

The frontend primarily uses `localStorage` (`STORAGE_KEY = tabulator_pro_rbac_v6_audit` at `public/index.html:784`). For multi-device sync on a physical server, the backend exposes:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/info` | App info |
| GET | `/api/state` | Retrieve last POSTed state (if any) |
| POST | `/api/state` | Persist JSON state to `data/app-state.json` |

Example:
```bash
curl -X POST http://localhost:3000/api/state -H "Content-Type: application/json" -d @my-state.json
```

## Deploy to Any Physical Server

### Option A - Bare Metal / VPS (Ubuntu/Debian) with Node.js + PM2 + Nginx

```bash
# 1. Upload project to server
scp -r D:\tabulate user@YOUR_SERVER_IP:/opt/tabulator-pro
# or git clone <repo> /opt/tabulator-pro

# 2. On server
cd /opt/tabulator-pro
npm --prefix backend install --omit=dev
cp backend/.env.example backend/.env   # edit PORT/JWT_SECRET if needed

# 3. Run with PM2 (keeps alive after logout / reboot)
npm install -g pm2
pm2 start backend/ecosystem.config.js
pm2 save
pm2 startup  # follow printed instructions

# 4. Nginx reverse proxy (optional but recommended for port 80 / HTTPS)
sudo cp nginx.conf /etc/nginx/sites-available/tabulator-pro
# edit server_name in that file
sudo ln -s /etc/nginx/sites-available/tabulator-pro /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. HTTPS (Let's Encrypt)
sudo certbot --nginx -d your-domain.com
```

App will be available at `http://YOUR_SERVER_IP:3000` or `https://your-domain.com` via Nginx.

### Option B - Docker (Any server with Docker)

```bash
# Single host
docker build -t tabulator-pro .
docker run -d -p 3000:3000 --name tabulator-pro --restart unless-stopped tabulator-pro

# Or with Compose (handles volume + restart + healthcheck)
docker compose up -d --build
docker compose logs -f
curl http://localhost:3000/api/health
```

### Option C - Windows Server (IIS Reverse Proxy or Direct Node)

```powershell
# On Windows Server with Node installed
cd C:\inetpub\tabulator-pro
npm --prefix backend install --omit=dev
# Option 1: Run directly
npm --prefix backend start
# or via root orchestrator:
npm start
# Option 2: PM2 as Windows Service (use pm2-windows-service or NSSM)
npm install -g pm2
pm2 start backend/ecosystem.config.js
pm2 save

# IIS: Install Application Request Routing + URL Rewrite, then create reverse proxy rule to http://localhost:3000
```

### Option D - Static Hosting (No Node Needed)

If you only need static hosting (no `/api/state` persistence), upload just `public/` contents to:
- **Apache:** `DocumentRoot /var/www/html` + `htaccess` fallback to index.html
- **Nginx:** `root /usr/share/nginx/html; try_files $uri $uri/ /index.html;`
- **cPanel / Shared Hosting:** upload `public/index.html` to `public_html/`
- **Python fallback:** `python -m http.server 8000 --directory public`

## Environment Variables

Create `.env` from `.env.example`:

```
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

- `PORT` - Listening port (use 80/443 behind Nginx, or 3000 direct)
- `HOST` - Bind address (0.0.0.0 for external access, 127.0.0.1 for localhost-only)
- `NODE_ENV` - production enables 1-day static cache + combined morgan logs

## Updating / Redeploying

```bash
# On server
cd /opt/tabulator-pro
git pull          # or re-upload via scp
npm --prefix backend install
npm --prefix frontend install && npm run build
pm2 restart backend/ecosystem.config.js  # or: pm2 restart tabulator-pro
# or docker:
docker compose up -d --build
```

## Verification

```bash
# Local
node -v && npm -v
npm install && npm start
curl http://localhost:3000/api/health  # expect { status: "ok" }

# Docker
docker compose up -d && curl http://localhost:3000/api/health
```

## Notes

- **Data:** Angular frontend is **backend-first**: `StateService` loads from `GET /api/state` & `GET /api/contests`; legacy `localStorage` key `tabulator_pro_rbac_v6_audit` is deprecated (only JWT token kept). All scores/creations go via REST (`PUT /api/contests/:id/scores` validated `0→weight`). Persisted file now `backend/data/app-state.json` (migrated `_schemaVersion:2` direct-sum, step `0.01`).
- **Security:** Helmet, CORS, compression, JWT (12h) enabled in `backend/server.js`. RBAC enforced both client (guards) and server (`requireHead`, `hasContestAccess`, per-criterion `getCriterionWeight`).
- **Build:** Angular production build is ~110kB transfer; Tailwind purged. `Dockerfile` multi-stage builds `frontend` then `backend/server.js` (`CMD ["node","backend/server.js"]`). `docker compose` mounts `./backend/data` & `./backend/logs` and uses `env_file: backend/.env`.
- **Legacy fallback:** If `frontend/dist/frontend/browser` missing, `backend/server.js` falls back to `backend/public/index.html` vanilla SPA (both patched weight-capped).
