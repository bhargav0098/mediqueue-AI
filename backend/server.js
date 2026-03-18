require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const cron    = require('node-cron');
const connectDB = require('./config/db');

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
];

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true, methods: ['GET','POST'] },
  pingTimeout: 60000,
});

connectDB();

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Pass io to routes & services
const apptRoutes = require('./routes/appointments');
apptRoutes.setIO(io);
const { setIO: qmSetIO, recalculateQueue, getHospitalQueue, broadcastHospitalQueue } = require('./services/queueManager');
qmSetIO(io);

// ── Routes ──────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/appointments',  apptRoutes);
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/doctors',       require('./routes/doctors'));
app.use('/api/patients',      require('./routes/patients'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/queue',         require('./routes/queue'));
app.use('/api/prescriptions', require('./routes/prescriptions'));

app.get('/api/health', (req,res) => res.json({
  status:'ok', version:'7.0.0', time: new Date(),
  features: ['live-queue','prescriptions','ai-triage','email-notifications','emergency-reordering'],
}));
app.use((req,res) => res.status(404).json({ message:'Route not found' }));
app.use((err,req,res,next) => { console.error(err.stack); res.status(500).json({ message:'Server error' }); });

// ── Socket.io ────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Socket: ${socket.id}`);

  // Personal room (all users)
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
  });

  // Doctor room
  socket.on('join_doctor', (doctorId) => {
    socket.join(`doctor:${doctorId}`);
    socket.join(`user:${doctorId}`);
    console.log(`🩺 Doctor ${doctorId} joined`);
  });

  // Live queue room — any role can subscribe
  socket.on('join_live_queue', ({ doctorId, date }) => {
    if (doctorId && date) {
      socket.join(`livequeue:${doctorId}:${date}`);
    }
    socket.join(`livequeue:all:${date || new Date().toISOString().slice(0,10)}`);
    console.log(`📋 Joined live queue room`);
  });

  // Admin room
  socket.on('join_admin', () => {
    socket.join('admin_room');
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Disconnected: ${socket.id}`);
  });
});

// ── CRON JOBS ────────────────────────────────────────
const Appointment  = require('./models/Appointment');
const Notification = require('./models/Notification');
const User         = require('./models/User');
const DoctorCapacity = require('./models/DoctorCapacity');
const { queueEmail } = require('./services/emailService');
const reminderTpl  = require('./templates/emails/appointmentReminder');
const noShowTpl    = require('./templates/emails/noShow');

// ① Appointment reminders — every 60 minutes
cron.schedule('0 * * * *', async () => {
  try {
    const now   = new Date();
    const today = now.toISOString().slice(0,10);
    const appts = await Appointment.find({
      date: today, status: { $in: ['pending','confirmed'] }, reminderSent: { $ne: true },
    }).populate('patient','name email').populate('doctor','name');

    let sent = 0;
    for (const a of appts) {
      const [h,m] = (a.time||'09:00').split(':').map(Number);
      const apptTime = new Date(); apptTime.setHours(h,m,0,0);
      const diff = apptTime - now;
      if (diff > 0 && diff <= 3600000) {
        a.reminderSent = true; await a.save();
        queueEmail(a.patient?.email,
          `⏰ Reminder: Appointment in ~${Math.round(diff/60000)} min`,
          reminderTpl({ patientName:a.patient?.name, doctorName:a.doctor?.name, date:a.date, time:a.time, ticketNumber:a.ticketNumber, queuePosition:a.queuePosition, estimatedWait:a.estimatedWaitMinutes }),
          'reminder', a._id);
        sent++;
      }
    }
    if (sent) console.log(`⏰ Reminders sent: ${sent}`);
  } catch(e) { console.error('reminder cron:', e.message); }
});

// ② No-show detection — every 30 minutes
cron.schedule('*/30 8-20 * * *', async () => {
  try {
    const now  = new Date();
    const today = now.toISOString().slice(0,10);
    const threshold = new Date(now - 45 * 60 * 1000);
    const candidates = await Appointment.find({
      status: { $in: ['pending','confirmed'] }, date: today,
    }).populate('patient','name email').populate('doctor','name');

    let count = 0;
    for (const a of candidates) {
      const [h,m] = (a.time||'09:00').split(':').map(Number);
      const apptTime = new Date(); apptTime.setHours(h,m,0,0);
      if (apptTime < threshold) {
        a.status = 'no-show';
        a.statusHistory.push({ status:'no-show', changedByRole:'system', timestamp:new Date(), reason:'Auto-detected: Patient did not arrive within 45 minutes' });
        await a.save(); count++;
        const n = await Notification.create({ user:a.doctor._id, title:'No-Show', message:`Patient ${a.patient?.name} did not arrive`, type:'no_show', relatedId:a._id });
        io.to(`user:${a.doctor._id}`).emit('notification', n);
        io.to(`doctor:${a.doctor._id}`).emit('no_show_detected', { appointmentId:a._id, patientName:a.patient?.name });
        queueEmail(a.patient?.email, `Missed Appointment Notice`,
          noShowTpl({ patientName:a.patient?.name, doctorName:a.doctor?.name, date:a.date, time:a.time, ticketNumber:a.ticketNumber }),
          'no_show', a._id);
      }
    }
    if (count) console.log(`⚠️  No-shows: ${count}`);
  } catch(e) { console.error('no-show cron:', e.message); }
});

// ③ Queue priority validation — every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    const today = new Date().toISOString().slice(0,10);
    const doctors = await User.find({ role:'doctor', status:'approved' });
    for (const doc of doctors) {
      const count = await recalculateQueue(doc._id, today);
      if (count > 0) broadcastHospitalQueue(today);
    }
  } catch(e) { console.error('queue cron:', e.message); }
});

// ④ Fatigue check — 9pm
cron.schedule('0 21 * * *', async () => {
  try {
    const today = new Date().toISOString().slice(0,10);
    const caps  = await DoctorCapacity.find({ date: today });
    for (const cap of caps) {
      const pct = Math.round((cap.usedSlots / Math.max(cap.calculatedCapacity,1)) * 100);
      if (pct > 90) {
        await User.findByIdAndUpdate(cap.doctor, { fatigueScore: pct });
        const n = await Notification.create({ user:cap.doctor, title:'😓 Fatigue Alert', message:`You saw ${pct}% capacity today. Tomorrow's limit slightly reduced.`, type:'fatigue_alert' });
        io.to(`user:${cap.doctor}`).emit('notification', n);
      }
    }
  } catch(e) { console.error('fatigue cron:', e.message); }
});

// ⑤ Daily reset — midnight
cron.schedule('0 0 * * *', async () => {
  try {
    await User.updateMany({ role:'doctor' }, { todayBookingCount:0 });
    console.log('✅ Daily reset');
  } catch(e) { console.error('reset cron:', e.message); }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\nMediQueueAI V7 running on port ${PORT}`);
  console.log(`📡 WebSocket | 🤖 AI Triage | 📋 Live Queue | 💊 Prescriptions`);
  console.log(`⏰ Crons: reminders(1h) no-show(30m) queue(5m) fatigue(9pm)\n`);
});

module.exports = { app, io };
