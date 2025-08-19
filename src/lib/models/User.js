import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: 'Bangladesh' },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  }
});

// Remove the duplicate index definition from addressSchema
// addressSchema.index({ location: '2dsphere' }); // This is causing the duplicate warning

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 100
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, // This creates an index automatically
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: true,
    minlength: 8,
    select: false // Don't include password in queries by default
  },
  role: { 
    type: String, 
    enum: ['admin', 'agent', 'customer'], 
    default: 'customer',
    required: true
  },
  phone: {
    type: String,
    required: function() {
      return this.role !== 'admin'; // Admin phone is optional
    },
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  address: addressSchema,
  
  // Agent-specific fields
  agentInfo: {
    isAvailable: { type: Boolean, default: true },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    },
    vehicleType: {
      type: String,
      enum: ['bike', 'car', 'van', 'truck', null],
      default: null
    },
    licensePlate: String,
    capacity: { type: Number, default: 0 }, // kg capacity
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalDeliveries: { type: Number, default: 0 },
    activeDeliveries: { type: Number, default: 0 }
  },
  
  // Customer-specific fields
  customerInfo: {
    preferredPaymentMethod: {
      type: String,
      enum: ['cod', 'prepaid', 'card'],
      default: 'cod'
    },
    totalShipments: { type: Number, default: 0 },
    loyaltyPoints: { type: Number, default: 0 }
  },
  
  // Common fields
  profileImage: String,
  dateOfBirth: Date,
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  
  // Security fields - ADDED FOR AUTHENTICATION
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  lastFailedAttempt: { Date },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  emailVerificationToken: String,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive information when converting to JSON
      delete ret.password;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpires;
      delete ret.twoFactorSecret;
      delete ret.emailVerificationToken;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      delete ret.lastFailedAttempt;
      return ret;
    }
  }
});

// Remove duplicate index definitions - these are already created by the schema options
// userSchema.index({ email: 1 }); // Duplicate of 'unique: true' on email field
// userSchema.index({ 'address.location': '2dsphere' }); // Already defined in addressSchema

// Keep only the additional indexes that aren't automatically created
userSchema.index({ role: 1 });
userSchema.index({ 'agentInfo.currentLocation': '2dsphere' });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lockUntil: 1 }); // For checking locked accounts
userSchema.index({ loginAttempts: 1 }); // For security queries

// Virtual for full address
userSchema.virtual('fullAddress').get(function() {
  if (this.address) {
    return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}, ${this.address.country}`;
  }
  return null;
});

// Virtual to check if account is currently locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to get user role display name
userSchema.methods.getRoleDisplayName = function() {
  const roleNames = {
    admin: 'Administrator',
    agent: 'Delivery Agent',
    customer: 'Customer'
  };
  return roleNames[this.role] || this.role;
};

// Method to check if user can be assigned deliveries
userSchema.methods.canAcceptDelivery = function() {
  if (this.role !== 'agent') return false;
  return this.agentInfo.isAvailable && this.agentInfo.activeDeliveries < 5; // Max 5 active deliveries
};

// Method to increment login attempts and lock account if needed
userSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Otherwise increment
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock the account if we've reached max attempts and it's not locked already
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // 30 minutes
  }
  
  return this.updateOne(updates);
};

// Password hashing middleware
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(12);
    // Hash the password along with our new salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to reset login attempts after successful login
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { 
      loginAttempts: 0,
      lastLogin: new Date() 
    },
    $unset: { lockUntil: 1 }
  });
};

// Fix for the export statement
export default mongoose.models.users || mongoose.model('users', userSchema);