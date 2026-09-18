# Tabulator Pro - Universal Contest Tabulation Platform

Full-fledged web app for contest tabulation with **RBAC** (Head Tabulator / Assistant Tabulator / Judge) and **Audit Log**. Runs on a local server and can be uploaded to any physical server (VPS, dedicated, on-prem).

> Original `index.html` has been transformed into a production-ready Node.js + Express app with Docker, PM2, and Nginx support. No code rewrite of the frontend was needed - it is served statically from `public/`.

## Project Structure

```
D:\tabulate\
├── public/
│   └── index.html          # Main SPA (served statically)
├── data/
│   └── app-state.json      # Optional server-side persisted state (gitignored, created on POST /api/state)
├── logs/                   # PM2 logs
├── server.js               # Express production server
├── package.json            # Dependencies & npm scripts
├── ecosystem.config.js     # PM2 process manager config
├── Dockerfile              # Container build
├── docker-compose.yml      # One-command container deploy
├── nginx.conf              # Example reverse-proxy config
├── .env / .env.example     # Environment vars (PORT, HOST, NODE_ENV)
├── .gitignore / .dockerignore
└── index.html              # Legacy copy (root) - also kept for direct file open
```

## Quick Start - Local Server

### Prerequisites
- Node.js >= 18 (tested on v24.18.1)
- npm >= 8

### 1. Install & Run

```powershell
# In D:\tabulate
npm install
npm start
# or for auto-reload during development:
npm run dev
```

Open:
- **App:** http://localhost:3000
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
npm install --omit=dev
cp .env.example .env   # edit PORT if needed

# 3. Run with PM2 (keeps alive after logout / reboot)
npm install -g pm2
pm2 start ecosystem.config.js
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
npm install --omit=dev
# Option 1: Run directly
npm start
# Option 2: PM2 as Windows Service (use pm2-windows-service or NSSM)
npm install -g pm2
pm2 start ecosystem.config.js
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
npm install
pm2 restart tabulator-pro   # or docker compose up -d --build
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

- **Data:** Default app persists to browser LocalStorage only. Server-side `POST /api/state` is optional if you later wire the frontend to sync.
- **Security:** Helmet, CORS, and compression enabled in `server.js`. For public internet, always use HTTPS (Nginx + Certbot) and consider adding authentication proxy or firewall.
- **Portability:** No build step required - Tailwind is via CDN (`public/index.html:8`), no bundler needed. Drop `public/` on any static host and it works.
