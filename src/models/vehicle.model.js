const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['car', 'bike'],
      required: true,
      index: true,
    },
    bodyType: {
      type: String,
      enum: [
        'sedan',
        'suv',
        'hatchback',
        'luxury',
        'super-bike',
        'sports-bike',
        'cruiser',
        'scooty',
        // Legacy values retained temporarily for backward compatibility
        'scooter',
        'motorcycle',
      ],
      required: true,
      index: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    model: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: 3000,
    },
    plateNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
      index: true,
    },
    color: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'hybrid', 'cng', null],
      default: null,
    },
    isPrimary: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
        if (ret.user) {
          ret.userId = String(ret.user);
          delete ret.user;
        }
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Vehicle', vehicleSchema);


