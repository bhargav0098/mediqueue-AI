const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Notification = require('../models/Notification');
const { queueEmail } = require('../services/emailService');
const { protect }   = require('../middleware/auth');
const registeredTpl = require('../templates/emails/userRegistered');
const doctorReqTpl  = require('../templates/emails/doctorRequest');
const doctorApprovedTpl = require('../templates/emails/doctorApproved');
const doctorRejectedTpl = require('../templates/emails/doctorRejected');

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn:'7d' });

router.post('/register', async (req,res) => {
  try {
    const { name,email,password,role,specialization,licenseNumber,experience,phone,age,gender,qualifications,department } = req.body;
    if (!name||!email||!password) return res.status(400).json({ message:'Name, email, password required' });
    if (await User.findOne({ email:email.toLowerCase() })) return res.status(400).json({ message:'Email already exists' });
    const userData = { name,email,password,phone,age,gender,
      role:role==='doctor'?'doctor':role==='admin'?'admin':'patient',
      status:role==='doctor'?'pending':'approved'
    };
    if (role==='doctor') Object.assign(userData, { specialization,licenseNumber,experience,qualifications,department });
    const user = await User.create(userData);

    // Send welcome email (non-blocking)
    if (role !== 'doctor') {
      queueEmail(user.email, 'Welcome to MediQueueAI', registeredTpl({ name:user.name, email:user.email, role:user.role }), 'registration', user._id);
      await Notification.create({ user:user._id, title:'Welcome!', message:`Account created successfully. Welcome to MediQueueAI!`, type:'registration' });
    }
    // Notify admin of doctor request
    if (role==='doctor' && process.env.ADMIN_EMAIL) {
      queueEmail(process.env.ADMIN_EMAIL, 'New Doctor Registration Request',
        doctorReqTpl({ doctorName:name,specialization,experience,licenseNumber,email,phone }),
        'doctor_request', user._id);
    }

    const token = sign(user._id);
    res.status(201).json({
      message: role==='doctor' ? 'Registration submitted. Awaiting admin approval.' : 'Registration successful',
      token, user:{ _id:user._id,name:user.name,email:user.email,role:user.role,status:user.status,specialization:user.specialization }
    });
  } catch(err) {
    console.error('Register error:',err);
    res.status(500).json({ message:err.message });
  }
});

router.post('/login', async (req,res) => {
  try {
    const { email,password } = req.body;
    if (!email||!password) return res.status(400).json({ message:'Email and password required' });
    const user = await User.findOne({ email:email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message:'Invalid credentials' });
    if (user.role==='doctor' && user.status!=='approved') return res.status(403).json({ message:user.status==='pending'?'Awaiting admin approval':'Account not approved' });
    if (user.isBlocked) return res.status(403).json({ message:'Account is blocked' });

    // Login notification (non-blocking)
    setImmediate(async () => {
      try {
        await Notification.create({ user:user._id, title:'Login Alert', message:`New login to your account at ${new Date().toLocaleString()}`, type:'login_alert' });
      } catch(_){}
    });

    res.json({ message:'Login successful', token:sign(user._id),
      user:{ _id:user._id,name:user.name,email:user.email,role:user.role,status:user.status,specialization:user.specialization,dailyCapacity:user.dailyCapacity,fatigueScore:user.fatigueScore,isRunningLate:user.isRunningLate,isAvailable:user.isAvailable }
    });
  } catch(err) { res.status(500).json({ message:err.message }); }
});

router.get('/me', protect, async (req,res) => {
  try { res.json(await User.findById(req.user._id).select('-password')); }
  catch(err) { res.status(500).json({ message:err.message }); }
});

router.put('/profile', protect, async (req,res) => {
  try {
    const allowed = ['name','phone','age','gender','bloodGroup','address','avgConsultTime','breakTime','workingHoursStart','workingHoursEnd','qualifications','department','medicalHistory','allergies'];
    const updates = {};
    allowed.forEach(f => { if(req.body[f]!==undefined) updates[f]=req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new:true }).select('-password');
    res.json({ message:'Profile updated', user });
  } catch(err) { res.status(500).json({ message:err.message }); }
});

// Expose approve/reject (called by admin)
router.put('/doctors/:id/approve', protect, require('../middleware/auth').adminOnly, async (req,res) => {
  try {
    const doctor = await User.findByIdAndUpdate(req.params.id, { status:'approved' }, { new:true }).select('-password');
    if (!doctor) return res.status(404).json({ message:'Not found' });
    queueEmail(doctor.email,'Welcome to Our Hospital Platform', doctorApprovedTpl({ doctorName:doctor.name,specialization:doctor.specialization }), 'doctor_approved', doctor._id);
    await Notification.create({ user:doctor._id,title:'Application Approved!',message:'Your doctor application has been approved. You can now log in.',type:'doctor_approved' });
    res.json({ message:'Doctor approved', doctor });
  } catch(err) { res.status(500).json({ message:err.message }); }
});
router.put('/doctors/:id/reject', protect, require('../middleware/auth').adminOnly, async (req,res) => {
  try {
    const { reason='Does not meet requirements' } = req.body;
    const doctor = await User.findByIdAndUpdate(req.params.id, { status:'rejected' }, { new:true }).select('-password');
    if (!doctor) return res.status(404).json({ message:'Not found' });
    queueEmail(doctor.email,'Doctor Application Status Update', doctorRejectedTpl({ doctorName:doctor.name,reason }), 'doctor_rejected', doctor._id);
    await Notification.create({ user:doctor._id,title:'Application Update',message:`Application not approved: ${reason}`,type:'doctor_rejected' });
    res.json({ message:'Doctor rejected', doctor });
  } catch(err) { res.status(500).json({ message:err.message }); }
});

module.exports = router;

// Change password (self)
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
    const user = await User.findById(req.user._id);
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});
