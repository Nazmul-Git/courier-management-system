import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'agent', 'customer'], default: 'customer' },
  phone: String,
  address: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.users || mongoose.model('users', userSchema);