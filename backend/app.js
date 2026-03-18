require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const connectDB = require('./config/db');

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
];

const app = express();

// Ensure DB is connected before handling requests (safe for serverless cold starts)
let dbConnected = false;
app.use(async (req, res, next) => {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
  }
  next();
});

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
const apptRoutes = require('./routes/appointments');
// Socket.io not available in serverless — pass null so routes degrade gracefully
if (typeof apptRoutes.setIO === 'function') apptRoutes.setIO(null);

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/appointments',  apptRoutes);
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/doctors',       require('./routes/doctors'));
app.use('/api/patients',      require('./routes/patients'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/queue',         require('./routes/queue'));
app.use('/api/prescriptions', require('./routes/prescriptions'));

app.get('/api/health', (req, res) => res.json({
  status: 'ok', version: '7.0.0', time: new Date(),
  features: ['live-queue', 'prescriptions', 'ai-triage', 'email-notifications'],
}));

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error' });
});

module.exports = app;
