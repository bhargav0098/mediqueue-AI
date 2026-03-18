require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch(e) { console.error('❌', e.message); process.exit(1); }

  const User = require('./models/User');
  const demoEmails = ['admin@mediscanai.com','doctor@demo.com','doctor2@demo.com',
                      'doctor3@demo.com','patient@demo.com','patient2@demo.com'];
  const removed = await User.deleteMany({ email: { $in: demoEmails } });
  console.log(`Removed ${removed.deletedCount} old accounts`);

  const demos = [
    { name:'System Admin', email:'admin@mediscanai.com', password:'Admin@12345',
      role:'admin', status:'approved', age:35, gender:'Male' },

    { name:'Dr. Sarah Johnson', email:'doctor@demo.com', password:'Doctor@123',
      role:'doctor', status:'approved', specialization:'Cardiology',
      licenseNumber:'MED-CARD-001', experience:12, age:40, gender:'Female',
      workingHoursStart:'09:00', workingHoursEnd:'17:00',
      avgConsultTime:15, breakTime:60, dailyCapacity:25, emergencyBufferSlots:3,
      qualifications:'MBBS, MD Cardiology', department:'Cardiology', isAvailable:true,
      consultationFee:150, followUpFee:80, emergencyFee:300, currency:'USD',
      bio:'Experienced cardiologist with 12 years in cardiac care.',
      languages:['English','Hindi'],
    },

    { name:'Dr. Raj Patel', email:'doctor2@demo.com', password:'Doctor@123',
      role:'doctor', status:'approved', specialization:'General Medicine',
      licenseNumber:'MED-GM-002', experience:8, age:36, gender:'Male',
      workingHoursStart:'08:00', workingHoursEnd:'16:00',
      avgConsultTime:12, breakTime:45, dailyCapacity:30, emergencyBufferSlots:3,
      qualifications:'MBBS, MD', department:'General Medicine', isAvailable:true,
      consultationFee:100, followUpFee:60, emergencyFee:200, currency:'USD',
      bio:'General physician specializing in preventive medicine.',
      languages:['English','Gujarati'],
    },

    { name:'Dr. Priya Sharma', email:'doctor3@demo.com', password:'Doctor@123',
      role:'doctor', status:'approved', specialization:'Pediatrics',
      licenseNumber:'MED-PED-003', experience:6, age:34, gender:'Female',
      workingHoursStart:'10:00', workingHoursEnd:'18:00',
      avgConsultTime:20, breakTime:60, dailyCapacity:18, emergencyBufferSlots:2,
      qualifications:'MBBS, MD Pediatrics', department:'Pediatrics', isAvailable:true,
      consultationFee:120, followUpFee:70, emergencyFee:250, currency:'USD',
      bio:'Dedicated pediatrician focused on child development and preventive care.',
      languages:['English','Hindi'],
    },

    { name:'John Patient', email:'patient@demo.com', password:'Patient@123',
      role:'patient', status:'approved', age:28, gender:'Male',
      phone:'+1-555-0100', bloodGroup:'O+',
      medicalHistory:['Hypertension','Diabetes Type 2'], allergies:['Penicillin'] },

    { name:'Mary Smith', email:'patient2@demo.com', password:'Patient@123',
      role:'patient', status:'approved', age:65, gender:'Female',
      phone:'+1-555-0200', bloodGroup:'A+',
      medicalHistory:['Asthma','Heart Disease'], allergies:['Aspirin'] },
  ];

  for (const u of demos) {
    await User.create(u);
    console.log(`${u.email} (${u.role})${u.consultationFee ? ' fee:$'+u.consultationFee : ''}`);
  }

  console.log('\nSeed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin:    admin@mediscanai.com  / Admin@12345');
  console.log('Doctor 1: doctor@demo.com       / Doctor@123  ($150/consult)');
  console.log('Doctor 2: doctor2@demo.com      / Doctor@123  ($100/consult)');
  console.log('Doctor 3: doctor3@demo.com      / Doctor@123  ($120/consult)');
  console.log('Patient:  patient@demo.com      / Patient@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
