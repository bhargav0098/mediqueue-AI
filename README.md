# 🏥 MediScanAI 

**AI-Powered Hospital Management System — Complete Edition**

> Live Queue · Prescriptions · AI Triage · Email Notifications · Doctor Fees · Emergency Reordering

---

## 🆕  New Features

| Feature | Details |
|---------|---------|
| 🔴 **Live Queue** | Real-time queue page for all roles — updates via WebSocket |
| 💊 **Prescriptions** | Doctor issues prescriptions with AI drug suggestions + allergy warnings |
| 💰 **Doctor Fees** | Consultation/follow-up/emergency fees shown during booking |
| 📊 **Status Lifecycle** | 9 appointment statuses with counters in admin dashboard |
| 🚨 **Emergency Reordering** | AI shifts all patients when emergency arrives, emails everyone |
| ⏰ **5 Cron Jobs** | Reminders(1h), No-show(30m), Queue(5m), Fatigue(9pm), Reset(midnight) |
| 📧 **12 Email Templates** | Including prescription email, no-show notice |
| 🤖 **AI Drug Suggestions** | Rule-based AI suggests medicines, warns about patient allergies |
| 📋 **Status History Audit** | Every status change logged with role + reason |

---

## 🚀 Quick Start

```bash
unzip mediscanai-v7-final.zip && cd mediscanai-v7

# Backend
cd backend
cp .env.example .env
# Edit .env: add MONGODB_URI and JWT_SECRET
npm install
node seed.js       # Creates demo accounts
node server.js

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open: **https://mediqueue-ai.vercel.app/login**

---

## 🔑 Demo Accounts

| Role | Email | Password | Fee |
|------|-------|----------|-----|
| Admin | admin@mediscanai.com | Admin@12345 | — |
| Dr. Sarah (Cardiology) | doctor@demo.com | Doctor@123 | $150 consult |
| Dr. Raj (General) | doctor2@demo.com | Doctor@123 | $100 consult |
| Dr. Priya (Pediatrics) | doctor3@demo.com | Doctor@123 | $120 consult |
| Patient (John) | patient@demo.com | Patient@123 | — |
| Patient (Mary) | patient2@demo.com | Patient@123 | — |

---

## 📁 What's New in V7

```
backend/
├── routes/
│   ├── prescriptions.js   ← NEW: issue/get prescriptions, AI drug suggestions
│   └── queue.js           ← NEW: live queue endpoints (hospital/doctor/patient)
├── services/
│   └── queueManager.js    ← UPDATED: emergency reorder + hospital broadcast
├── models/
│   ├── Appointment.js     ← UPDATED: prescription schema, consultationFee, statusHistory
│   └── User.js            ← UPDATED: consultationFee, followUpFee, emergencyFee, bio
├── templates/emails/
│   ├── prescription.js    ← NEW: prescription email with medicine table
│   └── noShow.js          ← NEW: no-show notice email
└── server.js              ← UPDATED: 5 cron jobs, new socket rooms, new routes

frontend/
├── pages/
│   ├── LiveQueue.jsx       ← NEW: real-time queue for all roles
│   ├── DoctorPrescriptions.jsx ← NEW: doctor issues prescriptions w/ AI
│   ├── Prescriptions.jsx   ← NEW: patient views/prints their prescriptions
│   ├── BookAppointment.jsx ← UPDATED: shows doctor fee during booking
│   ├── AdminDashboard.jsx  ← UPDATED: status lifecycle counters + fee column
│   ├── EditProfile.jsx     ← UPDATED: fee fields for doctors
│   └── DoctorAppointments.jsx ← UPDATED: prescription link after completion
├── components/
│   └── Sidebar.jsx         ← UPDATED: Live Queue 🔴 and Prescriptions links
└── App.jsx                 ← UPDATED: all new routes registered
```

---

## 🤖 AI Triage: 14/14 Test Cases Pass

| Input | Result |
|-------|--------|
| "cant able to breath from 2 hour" | 🚨 EMERGENCY |
| "chest pain sweating" | 🚨 EMERGENCY |
| "seizure convulsions" | 🚨 EMERGENCY |
| "fever 103 degrees" | ⚠️ HIGH |
| "mild headache tiredness" | ✅ LOW |

---

## 📧 Email Notifications Sent For

Booking · Acceptance · Rejection · Cancellation (patient/doctor) ·
Rescheduling (doctor/AI) · Reminder (1hr before) · No-show ·
Prescription · Doctor Approved/Rejected

---

## 🌐 Key API Endpoints

```
GET  /api/queue/hospital          — Full hospital live queue
GET  /api/queue/doctor/:id        — Single doctor queue
GET  /api/queue/patient/my        — Patient's queue position
GET  /api/queue/stats             — Status lifecycle counters

POST /api/prescriptions/:apptId   — Issue prescription (doctor)
GET  /api/prescriptions/:apptId   — Get prescription
GET  /api/prescriptions/patient/all — Patient's all prescriptions

GET  /api/doctors                  — List doctors WITH fee info
GET  /api/doctors/fees/:id         — Get single doctor fees
```


