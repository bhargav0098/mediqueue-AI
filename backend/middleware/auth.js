const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const protect = async (req,res,next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ message:'Not authorized' });
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message:'User not found' });
    next();
  } catch { return res.status(401).json({ message:'Token invalid or expired' }); }
};
const adminOnly  = (req,res,next) => req.user?.role==='admin'  ? next() : res.status(403).json({ message:'Admin only' });
const doctorOnly = (req,res,next) => req.user?.role==='doctor' ? next() : res.status(403).json({ message:'Doctor only' });
module.exports = { protect, adminOnly, doctorOnly };
