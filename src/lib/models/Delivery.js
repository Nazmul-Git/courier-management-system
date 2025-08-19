import mongoose from 'mongoose';

const deliverySchema = new mongoose.Schema({
  parcel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parcel',
    required: true
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  route: {
    start: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number]
    },
    end: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number]
    },
    waypoints: [{
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number],
      timestamp: Date
    }]
  },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'completed', 'cancelled', 'failed'],
    default: 'assigned'
  },
  estimatedDuration: Number, // in minutes
  actualDuration: Number,
  distance: Number, // in km
  startedAt: Date,
  completedAt: Date,
  notes: String,
  rating: { type: Number, min: 1, max: 5 },
  feedback: String
}, {
  timestamps: true
});

export default mongoose.models.deliveries || mongoose.model('deliveries', deliverySchema);