/**
 * Tabulator Pro - Production-ready Express Server
 * Serves the Universal Contest Tabulation Platform as a full-fledged web app.
 * - Static file serving from /public
 * - API for health & optional server-side state persistence (file-based)
 * - SPA fallback to index.html
 * - Works locally (npm start) and on any physical server / VPS / Docker / PM2 / Nginx
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'app-state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // allow Tailwind CDN + Google Fonts
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// --- API Routes ---

// Health check - useful for load balancers, Docker HEALTHCHECK, uptime monitors
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'tabulator-pro',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Get server-side persisted state (if exists) - optional backend sync
app.get('/api/state', (req, res) => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const json = JSON.parse(raw);
      return res.json({ exists: true, state: json });
    }
    return res.json({ exists: false, state: null });
  } catch (err) {
    console.error('GET /api/state error:', err);
    return res.status(500).json({ error: 'Failed to read state' });
  }
});

// Save state server-side (optional - frontend can POST to persist beyond LocalStorage)
app.post('/api/state', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'Invalid state payload' });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    return res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    console.error('POST /api/state error:', err);
    return res.status(500).json({ error: 'Failed to save state' });
  }
});

// App info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Tabulator Pro - Universal Contest Tabulation Platform',
    description: 'RBAC & Audit Log enabled contest scoring system',
    endpoints: {
      health: '/api/health',
      state: '/api/state (GET, POST)',
      info: '/api/info'
    }
  });
});

// --- Static Serving ---
// Serve everything in /public as static assets
app.use(express.static(PUBLIC_DIR, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true
}));

// SPA fallback: any non-API, non-file route serves index.html
app.get('*', (req, res) => {
  // If request is for /api/* and not matched, return 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).send('index.html not found in /public');
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`\n  Tabulator Pro running`);
  console.log(`  -----------------------------------------`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${HOST === '0.0.0.0' ? 'YOUR_SERVER_IP' : HOST}:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/api/health`);
  console.log(`  Static:  ${PUBLIC_DIR}`);
  console.log(`  Env:     ${process.env.NODE_ENV || 'development'}`);
  console.log(`  -----------------------------------------\n`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Force close after 10s
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
