require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow localhost dev + any Vercel deployment (preview & production)
app.use(cors({
  origin: function (origin, callback) {
    // Allow server-to-server / curl (no origin header)
    if (!origin) return callback(null, true);
    if (
      origin === 'http://localhost:5173' ||
      origin === 'http://localhost:3000' ||
      origin.endsWith('.vercel.app') ||
      origin === process.env.FRONTEND_URL
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

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
  res.json({
    status: 'ok',
    message: 'MediQueueAI backend is running',
    health: '/api/health',
  });
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
  res.json({
    status: 'ok',
    version: '7.0.0',
    time: new Date(),
    dbConnected,
    features: ['live-queue', 'prescriptions', 'ai-triage', 'email-notifications'],
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // CORS errors
  if (err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ message: err.message });
  }
  console.error(err.stack);
  res.status(500).json({
    message: 'Server error',
    error: err.message,
  });
});

module.exports = app;
