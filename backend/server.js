/**
 * Tabulator Pro - Production-ready Express Server with Persistent Backend
 * - File-based persistence (data/app-state.json) with atomic writes & validation
 * - JWT auth (bcryptjs), RBAC (Head/Assistant/Judge), contest-scoped penalties enforcement
 * - Granular REST for contests/criteria/penalties/contestants/judges/scores/tabulators/audit-logs
 * - Legacy blob sync GET/POST /api/state kept for backward compat
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ANGULAR_DIST = path.join(__dirname, '..', 'frontend', 'dist', 'frontend', 'browser');
const PUBLIC_DIR = fs.existsSync(ANGULAR_DIST) ? ANGULAR_DIST : path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'app-state.json');
const JWT_SECRET = process.env.JWT_SECRET || 'tabulator-pro-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const BCRYPT_ROUNDS = 10;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Default state (mirrors frontend index.html:786) — weight-capped 0→weight direct-sum ---
function getDefaultState() {
  return {
    _schemaVersion: 2,
    tabulators: [
      { id: "tab_head", username: "admin", name: "Admin / Head Tabulator", password: "Bayugan123", isHead: true }
    ],
    activeContestId: "contest_cooking",
    auditLogs: [
      {
        id: "log_init",
        timestamp: new Date().toISOString(),
        formattedTime: new Date().toLocaleString(),
        actor: "System",
        role: "System",
        category: "System Initialized",
        details: "System initialized with Cooking Contest Championship template and Head Tabulator."
      }
    ],
    contests: [
      {
        id: "contest_cooking",
        title: "Cooking Contest Championship",
        createdByTabulatorId: "tab_head",
        createdByName: "Admin / Head Tabulator",
        assignedTabulatorIds: [],
        criteria: [
          { id: 101, name: "Taste & Flavor Harmony", weight: 40 },
          { id: 102, name: "Plating & Visual Presentation", weight: 30 },
          { id: 103, name: "Creativity & Originality", weight: 20 },
          { id: 104, name: "Kitchen Hygiene & Technique", weight: 10 }
        ],
        penalties: [
          { id: 201, name: "Late Plating (Time Overrun)", defaultDeduction: 2.0 },
          { id: 202, name: "Sanitation Violation", defaultDeduction: 3.0 },
          { id: 203, name: "Missing Required Ingredient", defaultDeduction: 5.0 }
        ],
        contestants: [
          { id: 301, name: "Chef Marcus Vance (Team Scarlet)" },
          { id: 302, name: "Chef Elena Rostova (Team Sapphire)" },
          { id: 303, name: "Chef Liam Chen (Team Emerald)" }
        ],
        judges: [
          { id: 401, name: "Judge Gordon R.", password: "Bayugan123" },
          { id: 402, name: "Judge Julia C.", password: "Bayugan123" }
        ],
        scores: {
          "401": {
            "301": { criteria: { "101": 36.8, "102": 26.4, "103": 18, "104": 9.5 }, penalty: 0, penalties: [] },
            "302": { criteria: { "101": 35.6, "102": 28.2, "103": 17.4, "104": 9 }, penalty: 0, penalties: [] },
            "303": { criteria: { "101": 38, "102": 25.5, "103": 18.4, "104": 8.8 }, penalty: 2, penalties: [] }
          },
          "402": {
            "301": { criteria: { "101": 36, "102": 25.8, "103": 17.8, "104": 9.3 }, penalty: 0, penalties: [] },
            "302": { criteria: { "101": 36.4, "102": 28.5, "103": 17.6, "104": 9.2 }, penalty: 0, penalties: [] },
            "303": { criteria: { "101": 37.2, "102": 26.1, "103": 18, "104": 8.5 }, penalty: 2, penalties: [] }
          }
        }
      }
    ]
  };
}

// --- Persistence helpers ---
let inMemoryState = null;
let writeQueue = Promise.resolve();

function isHashed(pw) {
  return typeof pw === 'string' && (pw.startsWith('$2a$') || pw.startsWith('$2b$'));
}

function hashIfNeeded(pw) {
  if (!pw) return pw;
  if (isHashed(pw)) return pw;
  return bcrypt.hashSync(String(pw), BCRYPT_ROUNDS);
}

function normalizeState(state) {
  if (!state) return getDefaultState();
  // Ensure structures
  if (!Array.isArray(state.tabulators) || state.tabulators.length === 0) {
    state.tabulators = getDefaultState().tabulators;
  }
  if (!Array.isArray(state.auditLogs)) state.auditLogs = [];
  if (!Array.isArray(state.contests)) state.contests = getDefaultState().contests;
  // Weight-capped score schema version: 2 = direct-sum (0→weight, step 0.01)
  if (state._schemaVersion === undefined) state._schemaVersion = 1;
  const needsMigration = state._schemaVersion < 2;
  // Ensure each contest has required arrays
  state.contests.forEach(c => {
    if (!c.createdByTabulatorId) c.createdByTabulatorId = "tab_head";
    if (!c.createdByName) c.createdByName = "Admin / Head Tabulator";
    if (!Array.isArray(c.assignedTabulatorIds)) c.assignedTabulatorIds = [];
    if (!Array.isArray(c.criteria)) c.criteria = [];
    if (!Array.isArray(c.penalties)) c.penalties = [];
    if (!Array.isArray(c.contestants)) c.contestants = [];
    if (!Array.isArray(c.judges)) c.judges = [];
    if (!c.scores || typeof c.scores !== 'object') c.scores = {};
  });
  // Auto-scale legacy scores: old 0–100 weighted → 0→weight direct-sum (only if schemaVersion<2)
  if (needsMigration) {
    let migratedCount = 0;
    state.contests.forEach(c => {
      Object.keys(c.scores || {}).forEach(jid => {
        Object.keys(c.scores[jid] || {}).forEach(cid => {
          const entry = c.scores[jid][cid];
          if (!entry || !entry.criteria) return;
          Object.keys(entry.criteria).forEach(critId => {
            const raw = parseFloat(entry.criteria[critId]);
            if (isNaN(raw)) return;
            const w = (() => {
              const crit = c.criteria.find(x => String(x.id) === String(critId));
              return crit ? parseFloat(crit.weight) || 0 : 100;
            })();
            if (raw > w) {
              const scaled = Math.round((raw * w / 100) * 100) / 100;
              entry.criteria[critId] = Math.min(w, Math.max(0, scaled));
              migratedCount++;
            }
          });
        });
      });
    });
    state._schemaVersion = 2;
    if (migratedCount > 0) {
      try {
        if (fs.existsSync(STATE_FILE)) {
          const bak = STATE_FILE + '.bak.' + new Date().toISOString().replace(/[:.]/g,'-');
          fs.copyFileSync(STATE_FILE, bak);
          console.log('[migration] weight-capped scores migrated', migratedCount, 'entries →', bak);
        }
      } catch (e) { console.warn('migration backup failed', e.message); }
      if (!state.auditLogs) state.auditLogs = [];
      state.auditLogs.unshift({
        id: `log_${Date.now()}_migrate`,
        timestamp: new Date().toISOString(),
        formattedTime: new Date().toLocaleString(),
        actor: 'System',
        role: 'System',
        category: 'Score Migrated (weight-cap)',
        details: `Auto-scaled ${migratedCount} legacy scores from 0–100 weighted to 0→weight direct-sum (0.01 precision) on schema v2 migration.`
      });
      // persist migrated state immediately (avoid queuing race)
      try { saveStateToFileSync(state); } catch (e) { console.warn('migration save failed', e.message); }
    }
  }
  // Ensure at least one head tabulator
  if (!state.tabulators.some(t => t.isHead)) state.tabulators[0].isHead = true;
  if (!state.activeContestId && state.contests.length) state.activeContestId = state.contests[0].id;
  return state;
}

function loadStateFromFile() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const json = JSON.parse(raw);
      return normalizeState(json);
    }
  } catch (e) {
    console.error('Failed to load state file, using default:', e.message);
  }
  const def = normalizeState(getDefaultState());
  // Try to persist default for first run
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(def, null, 2)); } catch {}
  return def;
}

function saveStateToFileSync(state) {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmp, STATE_FILE);
}

function queueSave(state) {
  inMemoryState = state;
  writeQueue = writeQueue.then(() => {
    saveStateToFileSync(state);
  }).catch(err => console.error('Queue save error', err));
  return writeQueue;
}

function getState() {
  if (!inMemoryState) inMemoryState = loadStateFromFile();
  return inMemoryState;
}

// Initialize on boot
getState();

// --- Auth helpers ---
function verifyPassword(plain, stored) {
  if (isHashed(stored)) return bcrypt.compareSync(String(plain), stored);
  return String(plain) === String(stored);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized: missing token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
  }
}

function requireHead(req, res, next) {
  if (!req.user || !req.user.isHead) return res.status(403).json({ error: 'Forbidden: Head Tabulator only' });
  next();
}

// Contest access helper mirrors frontend hasContestAccess
function hasContestAccess(contest, user) {
  if (!contest || !user) return false;
  if (user.role === 'judge') return String(user.contestId) === String(contest.id);
  if (user.isHead) return true;
  const isCreator = String(contest.createdByTabulatorId) === String(user.tabulatorId);
  const isAssigned = Array.isArray(contest.assignedTabulatorIds) && contest.assignedTabulatorIds.includes(user.tabulatorId);
  return isCreator || isAssigned;
}

function getAllowedPenalties(contest) {
  if (!contest || !Array.isArray(contest.penalties)) return [];
  return contest.penalties;
}
function isPenaltyAllowed(contest, pid) { return getAllowedPenalties(contest).some(p => String(p.id) === String(pid)); }
function calculatePenaltyDeduction(contest, ids) {
  if (!Array.isArray(ids) || !ids.length) return 0;
  return ids.reduce((sum, pid) => {
    const rule = getAllowedPenalties(contest).find(p => String(p.id) === String(pid));
    return sum + (rule ? parseFloat(rule.defaultDeduction) || 0 : 0);
  }, 0);
}
function getPenaltyTotal(contest, judgeId, contestantId) {
  const entry = contest.scores?.[judgeId]?.[contestantId];
  const sel = entry?.penalties ? entry.penalties.filter(pid => isPenaltyAllowed(contest, pid)) : [];
  if (sel.length) return calculatePenaltyDeduction(contest, sel);
  if (entry && entry.penalty !== undefined && entry.penalty !== '' && entry.penalty !== null) return parseFloat(entry.penalty) || 0;
  return 0;
}
function getCriterionWeight(contest, cid) {
  if (!contest || !Array.isArray(contest.criteria)) return 100;
  const crit = contest.criteria.find(c => String(c.id) === String(cid));
  return crit ? parseFloat(crit.weight) || 0 : 100;
}

function logTransaction(state, category, details, actor, role) {
  if (!state.auditLogs) state.auditLogs = [];
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    formattedTime: new Date().toLocaleString(),
    actor: actor || 'System',
    role: role || 'System',
    category,
    details
  };
  state.auditLogs.unshift(entry);
  // keep 5000 max
  if (state.auditLogs.length > 5000) state.auditLogs = state.auditLogs.slice(0, 5000);
  return entry;
}

// --- Zod schemas ---
const loginSchema = z.object({
  role: z.enum(['tabulator', 'judge']),
  password: z.string().min(1),
  tabulatorId: z.string().optional(),
  username: z.string().optional(),
  contestId: z.string().optional(),
  judgeId: z.union([z.string(), z.number()]).optional()
});
const contestCreateSchema = z.object({
  title: z.string().min(1).max(200),
  template: z.enum(['cooking', 'talent', 'blank']).optional().default('blank')
});
const criterionSchema = z.object({ name: z.string().min(1).max(100), weight: z.number().min(0).max(100) });
const penaltySchema = z.object({ name: z.string().min(1).max(100), defaultDeduction: z.number().min(0).max(100) });
const contestantSchema = z.object({ name: z.string().min(1).max(100) });
const judgeSchema = z.object({ name: z.string().min(1).max(100), password: z.string().min(1).max(100).optional() });
const scoreSchema = z.object({
  judgeId: z.union([z.string(), z.number()]),
  contestantId: z.union([z.string(), z.number()]),
  criteria: z.record(z.string(), z.number().min(0)).optional(), // max validated per-criterion weight
  penalties: z.array(z.union([z.string(), z.number()])).optional()
});
const tabulatorCreateSchema = z.object({
  username: z.string().min(2).max(50),
  name: z.string().min(1).max(100),
  password: z.string().min(1).max(100)
});

// --- API Routes ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'tabulator-pro', version: '1.0.0', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'Tabulator Pro - Universal Contest Tabulation Platform',
    description: 'RBAC & Audit Log enabled contest scoring system with persistent backend',
    endpoints: {
      health: '/api/health',
      info: '/api/info',
      auth: '/api/auth/login, /api/auth/me',
      public: '/api/public/contests',
      state: '/api/state (GET public, POST head)',
      contests: '/api/contests',
      tabulators: '/api/tabulators',
      auditLogs: '/api/audit-logs'
    }
  });
});

// Public (no auth) - used for login dropdowns
app.get('/api/public/contests', (req, res) => {
  const state = getState();
  // Expose minimal info needed for login: id, title, judges (id+name only, no passwords)
  const sanitized = state.contests.map(c => ({
    id: c.id,
    title: c.title,
    judges: c.judges.map(j => ({ id: j.id, name: j.name })),
    contestants: c.contestants.map(x => ({ id: x.id, name: x.name })),
    penalties: c.penalties.map(p => ({ id: p.id, name: p.name, defaultDeduction: p.defaultDeduction }))
  }));
  res.json(sanitized);
});

// Auth
app.post('/api/auth/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  const { role, password, tabulatorId, username, contestId, judgeId } = parsed.data;
  const state = getState();
  if (role === 'tabulator') {
    const lookupId = tabulatorId || username;
    let tab = null;
    if (lookupId) tab = state.tabulators.find(t => String(t.id) === String(lookupId) || String(t.username).toLowerCase() === String(lookupId).toLowerCase());
    if (!tab) return res.status(401).json({ error: 'Invalid tabulator credentials' });
    const expected = tab.password;
    if (!verifyPassword(password, expected)) return res.status(401).json({ error: 'Invalid password' });
    // Migrate to hash if plaintext and matches
    if (!isHashed(expected) && String(password) === String(expected)) {
      tab.password = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
      queueSave(state);
    }
    const token = signToken({ role: 'tabulator', tabulatorId: tab.id, username: tab.username, name: tab.name, isHead: !!tab.isHead });
    logTransaction(state, 'User Login', `Tabulator '${tab.name}' (@${tab.username}) authenticated as ${tab.isHead ? 'Head' : 'Assistant'} via API.`, tab.name, tab.isHead ? 'Head Tabulator' : 'Assistant Tabulator');
    queueSave(state);
    return res.json({ token, user: { role: 'tabulator', tabulatorId: tab.id, username: tab.username, name: tab.name, isHead: !!tab.isHead } });
  } else {
    // judge
    if (!contestId || judgeId === undefined) return res.status(400).json({ error: 'contestId and judgeId required for judge login' });
    const contest = state.contests.find(c => String(c.id) === String(contestId));
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    const judge = contest.judges.find(j => String(j.id) === String(judgeId));
    if (!judge) return res.status(404).json({ error: 'Judge not found in contest' });
    if (!verifyPassword(password, judge.password)) return res.status(401).json({ error: 'Invalid judge password' });
    if (!isHashed(judge.password) && String(password) === String(judge.password)) {
      judge.password = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
      queueSave(state);
    }
    const token = signToken({ role: 'judge', contestId: contest.id, judgeId: judge.id, name: judge.name });
    logTransaction(state, 'User Login', `Judge '${judge.name}' logged into contest '${contest.title}' via API.`, judge.name, 'Judge');
    queueSave(state);
    return res.json({ token, user: { role: 'judge', contestId: contest.id, judgeId: judge.id, name: judge.name } });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Legacy blob sync - GET public, POST requires Head
app.get('/api/state', (req, res) => {
  const state = getState();
  res.json({ exists: true, state });
});

app.post('/api/state', authMiddleware, (req, res) => {
  if (req.user.role !== 'tabulator') return res.status(403).json({ error: 'Only tabulators can overwrite state' });
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'Invalid state payload' });
  // Basic sanity: must have contests
  if (!incoming.contests || !Array.isArray(incoming.contests)) return res.status(400).json({ error: 'State must contain contests array' });
  const normalized = normalizeState(incoming);
  // Hash any plaintext passwords before saving
  normalized.tabulators.forEach(t => { if (!isHashed(t.password)) t.password = hashIfNeeded(t.password); });
  normalized.contests.forEach(c => c.judges.forEach(j => { if (!isHashed(j.password)) j.password = hashIfNeeded(j.password); }));
  inMemoryState = normalized;
  queueSave(normalized).then(() => res.json({ ok: true, savedAt: new Date().toISOString() }));
});

// Contests
app.get('/api/contests', authMiddleware, (req, res) => {
  const state = getState();
  const user = req.user;
  let list = state.contests;
  if (user.role === 'judge') list = list.filter(c => String(c.id) === String(user.contestId));
  else if (!user.isHead) list = list.filter(c => hasContestAccess(c, user));
  res.json(list);
});

app.post('/api/contests', authMiddleware, (req, res) => {
  if (req.user.role === 'judge') return res.status(403).json({ error: 'Judges cannot create contests' });
  const parsed = contestCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  const { title, template } = parsed.data;
  const state = getState();
  const newId = `contest_${Date.now()}`;
  let criteria = [], penalties = [];
  if (template === 'cooking') {
    criteria = [
      { id: Date.now() + 1, name: "Taste & Flavor", weight: 40 },
      { id: Date.now() + 2, name: "Plating & Visual Presentation", weight: 30 },
      { id: Date.now() + 3, name: "Creativity & Originality", weight: 20 },
      { id: Date.now() + 4, name: "Kitchen Hygiene & Technique", weight: 10 }
    ];
    penalties = [
      { id: Date.now() + 5, name: "Time Overrun", defaultDeduction: 2.0 },
      { id: Date.now() + 6, name: "Sanitation Infraction", defaultDeduction: 3.0 }
    ];
  } else if (template === 'talent') {
    criteria = [
      { id: Date.now() + 1, name: "Tone Quality & Pitch", weight: 40 },
      { id: Date.now() + 2, name: "Stage Presence & Expression", weight: 30 },
      { id: Date.now() + 3, name: "Mastery & Technicality", weight: 20 },
      { id: Date.now() + 4, name: "Audience Impact", weight: 10 }
    ];
    penalties = [{ id: Date.now() + 5, name: "Time Exceeded Limit", defaultDeduction: 2.0 }];
  } else {
    criteria = [{ id: Date.now() + 1, name: "General Performance", weight: 100 }];
  }
  const newContest = {
    id: newId,
    title,
    createdByTabulatorId: req.user.tabulatorId,
    createdByName: req.user.name,
    assignedTabulatorIds: [],
    criteria, penalties,
    contestants: [{ id: Date.now() + 10, name: "Contestant 1" }, { id: Date.now() + 11, name: "Contestant 2" }],
    judges: [{ id: Date.now() + 20, name: "Judge 1", password: hashIfNeeded("Bayugan123") }, { id: Date.now() + 21, name: "Judge 2", password: hashIfNeeded("Bayugan123") }],
    scores: {}
  };
  state.contests.push(newContest);
  state.activeContestId = newId;
  logTransaction(state, 'Contest Created', `${req.user.name} created contest '${title}' template '${template}'.`, req.user.name, req.user.isHead ? 'Head Tabulator' : 'Assistant Tabulator');
  queueSave(state).then(() => res.status(201).json(newContest));
});

app.get('/api/contests/:id', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  res.json(contest);
});

app.put('/api/contests/:id', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  const { title } = req.body;
  if (title && typeof title === 'string' && title.trim()) {
    const old = contest.title;
    contest.title = title.trim();
    logTransaction(state, 'Contest Renamed', `Renamed '${old}' to '${contest.title}' by ${req.user.name}.`, req.user.name, req.user.isHead ? 'Head Tabulator' : 'Assistant Tabulator');
  }
  queueSave(state).then(() => res.json(contest));
});

// Persist active contest selection — selector was local-only and lost on reload
app.put('/api/state/activeContest', authMiddleware, (req, res) => {
  const { contestId } = req.body || {};
  if (!contestId) return res.status(400).json({ error: 'contestId required' });
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(contestId));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden: no access to this contest' });
  const old = state.activeContestId;
  state.activeContestId = String(contestId);
  logTransaction(state, 'Active Contest Changed', `Active contest changed '${old}' → '${contestId}' (${contest.title}) by ${req.user.name}.`, req.user.name, req.user.isHead ? 'Head Tabulator' : req.user.role === 'judge' ? 'Judge' : 'Assistant Tabulator');
  queueSave(state).then(() => res.json({ ok: true, activeContestId: state.activeContestId }));
});

app.delete('/api/contests/:id', authMiddleware, (req, res) => {
  const state = getState();
  const idx = state.contests.findIndex(c => String(c.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Contest not found' });
  const contest = state.contests[idx];
  if (req.user.role === 'judge') return res.status(403).json({ error: 'Judges cannot delete' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  const authorized = state.contests.filter(c => hasContestAccess(c, req.user));
  if (authorized.length <= 1) return res.status(400).json({ error: 'Cannot delete the only accessible contest' });
  if (!req.user.isHead && String(contest.createdByTabulatorId) !== String(req.user.tabulatorId)) return res.status(403).json({ error: 'Assistant can only delete own contests' });
  state.contests.splice(idx, 1);
  if (String(state.activeContestId) === String(req.params.id)) {
    const remaining = state.contests.filter(c => hasContestAccess(c, req.user));
    state.activeContestId = remaining[0]?.id || state.contests[0]?.id || '';
  }
  logTransaction(state, 'Contest Deleted', `Deleted contest '${contest.title}' by ${req.user.name}.`, req.user.name, req.user.isHead ? 'Head Tabulator' : 'Assistant Tabulator');
  queueSave(state).then(() => res.json({ ok: true }));
});

// Criteria
app.post('/api/contests/:id/criteria', authMiddleware, (req, res) => {
  const parsed = criterionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid', issues: parsed.error.issues });
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  const crit = { id: Date.now(), ...parsed.data };
  contest.criteria.push(crit);
  logTransaction(state, 'Criteria Added', `Added '${crit.name}' to '${contest.title}'.`, req.user.name, req.user.role === 'judge' ? 'Judge' : 'Tabulator');
  queueSave(state).then(() => res.status(201).json(crit));
});
app.put('/api/contests/:id/criteria/:cid', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  const crit = contest.criteria.find(c => String(c.id) === String(req.params.cid));
  if (!crit) return res.status(404).json({ error: 'Criterion not found' });
  const oldWeight = parseFloat(crit.weight) || 0;
  if (req.body.name !== undefined) crit.name = String(req.body.name);
  if (req.body.weight !== undefined) {
    const newW = Math.max(0, parseFloat(req.body.weight) || 0);
    crit.weight = newW;
    // Auto-renormalize existing scores for this criterion (preserve % performance)
    if (oldWeight !== newW) {
      Object.keys(contest.scores || {}).forEach(jid => {
        Object.keys(contest.scores[jid] || {}).forEach(cid => {
          const entry = contest.scores[jid][cid];
          const raw = entry?.criteria?.[String(crit.id)];
          if (raw !== undefined && raw !== null && raw !== '') {
            const oldRaw = parseFloat(raw) || 0;
            const newRaw = oldWeight > 0 ? Math.round((oldRaw * newW / oldWeight) * 100) / 100 : Math.min(newW, oldRaw);
            entry.criteria[String(crit.id)] = Math.min(newW, Math.max(0, newRaw));
          }
        });
      });
      logTransaction(state, 'Criteria Renormalized', `Renormalized criterion '${crit.name}' ${oldWeight}%→${newW}% scaled existing scores.`, req.user.name, req.user.isHead ? 'Head Tabulator' : 'Assistant Tabulator');
    }
  }
  queueSave(state).then(() => res.json(crit));
});
app.delete('/api/contests/:id/criteria/:cid', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  contest.criteria = contest.criteria.filter(c => String(c.id) !== String(req.params.cid));
  queueSave(state).then(() => res.json({ ok: true }));
});

// Penalties (admin-defined, judges only select)
app.post('/api/contests/:id/penalties', authMiddleware, (req, res) => {
  const parsed = penaltySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid', issues: parsed.error.issues });
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  if (req.user.role === 'judge') return res.status(403).json({ error: 'Judges cannot define penalties' });
  const rule = { id: Date.now(), ...parsed.data };
  contest.penalties.push(rule);
  logTransaction(state, 'Penalty Rule Added', `Added penalty '${rule.name}' to '${contest.title}'.`, req.user.name, 'Tabulator');
  queueSave(state).then(() => res.status(201).json(rule));
});
app.put('/api/contests/:id/penalties/:pid', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  const rule = contest.penalties.find(p => String(p.id) === String(req.params.pid));
  if (!rule) return res.status(404).json({ error: 'Penalty not found' });
  if (req.body.name !== undefined) rule.name = String(req.body.name);
  if (req.body.defaultDeduction !== undefined) {
    rule.defaultDeduction = Math.max(0, parseFloat(req.body.defaultDeduction) || 0);
    // Recalc totals for scores that have this penalty
    Object.keys(contest.scores || {}).forEach(jid => {
      Object.keys(contest.scores[jid] || {}).forEach(cid => {
        const e = contest.scores[jid][cid];
        if (e?.penalties?.some(pid => String(pid) === String(req.params.pid))) {
          e.penalty = calculatePenaltyDeduction(contest, e.penalties);
        }
      });
    });
  }
  queueSave(state).then(() => res.json(rule));
});
app.delete('/api/contests/:id/penalties/:pid', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  contest.penalties = contest.penalties.filter(p => String(p.id) !== String(req.params.pid));
  // Clean selections
  Object.keys(contest.scores || {}).forEach(jid => {
    Object.keys(contest.scores[jid] || {}).forEach(cid => {
      const e = contest.scores[jid][cid];
      if (e?.penalties) {
        e.penalties = e.penalties.filter(pid => String(pid) !== String(req.params.pid));
        e.penalty = calculatePenaltyDeduction(contest, e.penalties);
      }
    });
  });
  queueSave(state).then(() => res.json({ ok: true }));
});

// Contestants
app.post('/api/contests/:id/contestants', authMiddleware, (req, res) => {
  const parsed = contestantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid', issues: parsed.error.issues });
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  const item = { id: Date.now(), ...parsed.data };
  contest.contestants.push(item);
  queueSave(state).then(() => res.status(201).json(item));
});
app.put('/api/contests/:id/contestants/:cid', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  const item = contest.contestants.find(c => String(c.id) === String(req.params.cid));
  if (!item) return res.status(404).json({ error: 'Contestant not found' });
  if (req.body.name) item.name = String(req.body.name);
  queueSave(state).then(() => res.json(item));
});
app.delete('/api/contests/:id/contestants/:cid', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  contest.contestants = contest.contestants.filter(c => String(c.id) !== String(req.params.cid));
  queueSave(state).then(() => res.json({ ok: true }));
});

// Judges
app.post('/api/contests/:id/judges', authMiddleware, (req, res) => {
  const parsed = judgeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid', issues: parsed.error.issues });
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
  const j = { id: Date.now(), name: parsed.data.name, password: hashIfNeeded(parsed.data.password || 'Bayugan123') };
  contest.judges.push(j);
  queueSave(state).then(() => res.status(201).json({ id: j.id, name: j.name }));
});
app.put('/api/contests/:id/judges/:jid', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  const j = contest.judges.find(x => String(x.id) === String(req.params.jid));
  if (!j) return res.status(404).json({ error: 'Judge not found' });
  if (req.body.name) j.name = String(req.body.name);
  if (req.body.password) j.password = hashIfNeeded(String(req.body.password));
  queueSave(state).then(() => res.json({ id: j.id, name: j.name }));
});
app.delete('/api/contests/:id/judges/:jid', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  contest.judges = contest.judges.filter(j => String(j.id) !== String(req.params.jid));
  queueSave(state).then(() => res.json({ ok: true }));
});

// Scores - judges multiple select penalties enforced server-side, auto subtract
app.get('/api/contests/:id/scores', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user) && req.user.role !== 'judge') return res.status(403).json({ error: 'Forbidden' });
  // If judge, only their scores? Return all for tabulator, filtered for judge
  if (req.user.role === 'judge' && String(req.user.contestId) !== String(contest.id)) return res.status(403).json({ error: 'Forbidden' });
  const judgeId = req.query.judgeId;
  if (judgeId) return res.json(contest.scores[String(judgeId)] || {});
  res.json(contest.scores);
});

app.put('/api/contests/:id/scores', authMiddleware, (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid', issues: parsed.error.issues });
  const { judgeId, contestantId, criteria, penalties } = parsed.data;
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  // RBAC: judge can only write own scores for own contest; tabulator head can override any; assistant read-only (blocked)
  if (req.user.role === 'judge') {
    if (String(req.user.judgeId) !== String(judgeId) || String(req.user.contestId) !== String(contest.id)) return res.status(403).json({ error: 'Judges can only edit own scorecard' });
  } else {
    // tabulator
    if (!hasContestAccess(contest, req.user)) return res.status(403).json({ error: 'Forbidden' });
    if (!req.user.isHead) return res.status(403).json({ error: 'Assistant tabulators cannot override scores (Head only)' });
  }
  // Validate contestant exists
  if (!contest.contestants.some(c => String(c.id) === String(contestantId))) return res.status(400).json({ error: 'Contestant not found in this contest' });
  // Validate criteria: weight-capped 0→weight (step 0.01)
  if (criteria) {
    for (const [cid, val] of Object.entries(criteria)) {
      if (!contest.criteria.some(c => String(c.id) === String(cid))) return res.status(400).json({ error: `Criterion ${cid} not in contest` });
      const w = getCriterionWeight(contest, cid);
      if (typeof val !== 'number' || val < 0 || val > w) return res.status(400).json({ error: `Score for criterion ${cid} must be 0–${w}` });
    }
  }
  // Validate penalties - must be subset of contest penalties
  let cleanPenalties = [];
  if (penalties !== undefined) {
    if (!Array.isArray(penalties)) return res.status(400).json({ error: 'penalties must be array' });
    for (const pid of penalties) {
      if (!isPenaltyAllowed(contest, pid)) return res.status(400).json({ error: `Penalty ${pid} not allowed for this contest. Choose only from admin-listed penalties.` });
    }
    cleanPenalties = [...new Set(penalties.map(p => {
      const found = getAllowedPenalties(contest).find(x => String(x.id) === String(p));
      return found ? found.id : p;
    }))];
  }
  if (!contest.scores[String(judgeId)]) contest.scores[String(judgeId)] = {};
  if (!contest.scores[String(judgeId)][String(contestantId)]) contest.scores[String(judgeId)][String(contestantId)] = { criteria: {}, penalties: [], penalty: 0 };
  const entry = contest.scores[String(judgeId)][String(contestantId)];
  if (criteria) {
    if (!entry.criteria) entry.criteria = {};
    for (const [k, v] of Object.entries(criteria)) {
      const w = getCriterionWeight(contest, k);
      const rounded = Math.round(parseFloat(v) * 100) / 100;
      entry.criteria[k] = Math.min(w, Math.max(0, rounded));
    }
  }
  if (penalties !== undefined) {
    entry.penalties = cleanPenalties;
    entry.penalty = calculatePenaltyDeduction(contest, cleanPenalties);
  }
  const actor = req.user.name || req.user.username || 'Unknown';
  const role = req.user.isHead ? 'Head Tabulator' : req.user.role === 'judge' ? 'Judge' : 'Assistant Tabulator';
  logTransaction(state, penalties !== undefined ? 'Penalty Updated (API)' : 'Score Updated (API)', `Score update judge ${judgeId} contestant ${contestantId} penalties [${cleanPenalties.join(',')}] total ${entry.penalty}`, actor, role);
  queueSave(state).then(() => res.json(entry));
});

// Leaderboard computed server-side
app.get('/api/contests/:id/leaderboard', authMiddleware, (req, res) => {
  const state = getState();
  const contest = state.contests.find(c => String(c.id) === String(req.params.id));
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (!hasContestAccess(contest, req.user) && req.user.role !== 'judge') {
    // allow judge of same contest to see?
    if (String(req.user.contestId) !== String(contest.id)) return res.status(403).json({ error: 'Forbidden' });
  }
  const results = contest.contestants.map(c => {
    let judgeTotals = [];
    let totalDeductions = 0;
    contest.judges.forEach(j => {
      let jSum = 0;
      contest.criteria.forEach(crit => {
        const raw = contest.scores?.[j.id]?.[c.id]?.criteria?.[crit.id];
        jSum += (parseFloat(raw) || 0);
      });
      const penalty = getPenaltyTotal(contest, j.id, c.id);
      totalDeductions += penalty;
      judgeTotals.push(Math.max(0, jSum - penalty));
    });
    const finalScore = judgeTotals.length ? judgeTotals.reduce((a, b) => a + b, 0) / judgeTotals.length : 0;
    return { id: c.id, name: c.name, judgeTotals, totalPenalties: totalDeductions, finalScore };
  }).sort((a, b) => b.finalScore - a.finalScore);
  res.json({ contestId: contest.id, title: contest.title, results });
});

// Tabulators
app.get('/api/tabulators', authMiddleware, (req, res) => {
  if (!req.user.isHead) return res.status(403).json({ error: 'Head only' });
  const state = getState();
  // Don't leak password hashes
  res.json(state.tabulators.map(t => ({ id: t.id, username: t.username, name: t.name, isHead: !!t.isHead })));
});

app.post('/api/tabulators', authMiddleware, requireHead, (req, res) => {
  const parsed = tabulatorCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid', issues: parsed.error.issues });
  const { username, name, password } = parsed.data;
  const state = getState();
  if (state.tabulators.some(t => t.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'Username taken' });
  const nt = { id: `tab_${Date.now()}`, username: username.toLowerCase(), name, password: hashIfNeeded(password), isHead: false };
  state.tabulators.push(nt);
  logTransaction(state, 'Tabulator Created', `Head created Assistant '${name}' (@${username})`, req.user.name, 'Head Tabulator');
  queueSave(state).then(() => res.status(201).json({ id: nt.id, username: nt.username, name: nt.name, isHead: false }));
});

app.delete('/api/tabulators/:id', authMiddleware, requireHead, (req, res) => {
  const state = getState();
  const idx = state.tabulators.findIndex(t => String(t.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (state.tabulators[idx].isHead) return res.status(400).json({ error: 'Cannot delete Head' });
  const removed = state.tabulators.splice(idx, 1)[0];
  logTransaction(state, 'Tabulator Removed', `Removed '${removed.name}'`, req.user.name, 'Head Tabulator');
  queueSave(state).then(() => res.json({ ok: true }));
});

// Audit logs
app.get('/api/audit-logs', authMiddleware, (req, res) => {
  if (!req.user.isHead) return res.status(403).json({ error: 'Head only' });
  const state = getState();
  let logs = state.auditLogs || [];
  const { search, role } = req.query;
  if (search) {
    const s = String(search).toLowerCase();
    logs = logs.filter(l => (l.actor && l.actor.toLowerCase().includes(s)) || (l.category && l.category.toLowerCase().includes(s)) || (l.details && l.details.toLowerCase().includes(s)));
  }
  if (role && role !== 'ALL') logs = logs.filter(l => l.role === role);
  res.json(logs.slice(0, 500));
});

app.delete('/api/audit-logs', authMiddleware, requireHead, (req, res) => {
  const state = getState();
  state.auditLogs = [];
  logTransaction(state, 'Logs Cleared', 'Head cleared audit logs', req.user.name, 'Head Tabulator');
  queueSave(state).then(() => res.json({ ok: true }));
});

// --- Static serving & SPA fallback ---
app.use(express.static(PUBLIC_DIR, { maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0', etag: true, lastModified: true }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('index.html not found in /public');
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`\n  Tabulator Pro running with persistent backend`);
  console.log(`  -----------------------------------------`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${HOST === '0.0.0.0' ? 'YOUR_SERVER_IP' : HOST}:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/api/health`);
  console.log(`  Auth:    POST /api/auth/login`);
  console.log(`  Static:  ${PUBLIC_DIR}`);
  console.log(`  Data:    ${STATE_FILE}`);
  console.log(`  Env:     ${process.env.NODE_ENV || 'development'}`);
  console.log(`  -----------------------------------------\n`);
});

function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => { console.log('Server closed.'); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
