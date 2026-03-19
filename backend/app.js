require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
];

const app = express();

// Lazy DB connection for serverless
let dbConnected = false;
app.use(async (req, res, next) => {
  try {
    if (!dbConnected) {
      await connectDB();
      dbConnected = true;
    }
    next();
  } catch (err) {
    next(err);
  }
});

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
const apptRoutes = require('./routes/appointments');

// Socket.io not available in serverless
if (typeof apptRoutes.setIO === 'function') {
  apptRoutes.setIO(null);
}

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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '7.0.0',
    time: new Date(),
    features: ['live-queue', 'prescriptions', 'ai-triage', 'email-notifications'],
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    available: ['/', '/api/health'],
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Server error',
    error: err.message,
  });
});

module.exports = app;
