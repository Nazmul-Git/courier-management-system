import mongoose from 'mongoose';

const trackingSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'assigned',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'failed',
      'cancelled',
      'returned'
    ],
    default: 'pending'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number]
  },
  description: String,
  timestamp: { type: Date, default: Date.now }
});

const parcelSchema = new mongoose.Schema({
  trackingNumber: {
    type: String,
    required: true,
    unique: true,        // This automatically creates an index
    uppercase: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Sender information
  sender: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    address: { type: String, required: true }
  },
  
  // Recipient information
  recipient: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    address: { type: String, required: true }
  },
  
  // Parcel details
  parcelType: {
    type: String,
    enum: ['document', 'small_package', 'medium_package', 'large_package', 'fragile', 'perishable'],
    required: true
  },
  weight: { type: Number, required: true },
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  description: String,
  
  // Pricing and payment
  basePrice: { type: Number, required: true },
  additionalCharges: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['cod', 'prepaid', 'card'],
    required: true
  },
  codAmount: { type: Number, default: 0 },
  isPaid: { type: Boolean, default: false },
  
  // Delivery information
  pickupDate: Date,
  estimatedDelivery: Date,
  actualDelivery: Date,
  deliveryNotes: String,
  signature: String,
  
  // Status and tracking
  currentStatus: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'assigned',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'failed',
      'cancelled',
      'returned'
    ],
    default: 'pending'
  },
  trackingHistory: [trackingSchema],
  
  // Special instructions
  specialInstructions: String,
  fragile: { type: Boolean, default: false },
  requiresSignature: { type: Boolean, default: false },
  insurance: { type: Boolean, default: false },
  insuranceAmount: { type: Number, default: 0 },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes - REMOVE the trackingNumber index since it's already created by unique: true
parcelSchema.index({ customer: 1 });
parcelSchema.index({ assignedAgent: 1 });
parcelSchema.index({ currentStatus: 1 });
parcelSchema.index({ createdAt: -1 });
parcelSchema.index({ 'recipient.address': 'text' });

export default mongoose.models.parcels || mongoose.model('parcels', parcelSchema);