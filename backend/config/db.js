const mongoose = require('mongoose');

// Cache connection across serverless invocations
let cached = global._mongoConn || null;

const connectDB = async () => {
  if (cached && mongoose.connection.readyState === 1) {
    return cached;
  }

  try {
    cached = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    global._mongoConn = cached;
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    return cached;
  } catch (err) {
    console.error('❌ MongoDB Error:', err.message);
    throw err;
  }
};

module.exports = connectDB;
