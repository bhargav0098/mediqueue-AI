require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const app = express();

// ── CORS — must be absolute first middleware ──────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Echo back the exact origin (required when credentials:true)
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  // Respond to preflight immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Lazy DB connection for serverless ────────────────────────────────────────
let dbConnected = false;
app.use(async (req, res, next) => {
  if (dbConnected) return next();
  try {
    await connectDB();
    dbConnected = true;
    next();
  } catch (err) {
    console.error('DB connection failed:', err.message);
    return res.status(503).json({
      message: 'Database unavailable. Check MONGODB_URI in environment variables.',
      error: err.message,
    });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
const apptRoutes = require('./routes/appointments');
if (typeof apptRoutes.setIO === 'function') apptRoutes.setIO(null);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'MediQueueAI backend is running', health: '/api/health' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', apptRoutes);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/users', require('./routes/users'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '7.0.0', time: new Date(), dbConnected });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

module.exports = app;
