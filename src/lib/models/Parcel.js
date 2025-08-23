import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: 'Bangladesh' }
});

const ParcelSchema = new mongoose.Schema({
  trackingNumber: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  origin: { type: addressSchema, required: true },
  destination: { type: addressSchema, required: true },
  weight: { type: Number, required: true, min: 0.1, max: 100 },
  dimensions: { type: String, required: true },
  paymentType: { type: String, enum: ['prepaid', 'cod'], default: 'prepaid' },
  codAmount: { type: Number, min: 0, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  location: {
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
  specialInstructions: { type: String, maxlength: 500 },
  estimatedDelivery: { type: Date },
  actualDelivery: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create index
ParcelSchema.index({ location: '2dsphere' });

ParcelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method for status metrics
ParcelSchema.statics.getStatusMetrics = async function() {
  try {
    const metrics = await this.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = {};
    const allStatuses = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
    
    // Initialize all statuses with 0
    allStatuses.forEach(status => {
      result[status] = 0;
    });
    
    // Update with actual counts
    metrics.forEach(metric => {
      if (metric._id && allStatuses.includes(metric._id)) {
        result[metric._id] = metric.count;
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error in getStatusMetrics:', error);
    throw error;
  }
};

// Check if model already exists to prevent OverwriteModelError
const Parcel = mongoose.models.parcels || mongoose.model('parcels', ParcelSchema);

export default Parcel;