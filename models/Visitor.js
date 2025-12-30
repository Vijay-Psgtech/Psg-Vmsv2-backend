// import mongoose from "mongoose";

// const visitorSchema = new mongoose.Schema(
//   {
//     visitorId: { type: String, required: true, unique: true },
//     name: { type: String, required: true },
//     phone: { type: String, required: true },
//     email: { type: String },
//     company: { type: String },
//     host: { type: String, required: true },
//     purpose: { type: String },
//     gate: { type: String, required: true, index: true },
    
//     // Time management
//     allowedUntil: { type: Date, required: true },
//     expectedDuration: { type: Number, default: 120 }, // minutes
//     gracePeriodMinutes: { type: Number, default: 10 },
    
//     // Status
//     status: {
//       type: String,
//       enum: ["CREATED", "PENDING", "APPROVED", "REJECTED", "IN", "OUT", "EXPIRED", "OVERSTAY"],
//       default: "PENDING",
//     },
    
//     // Check-in/out times
//     checkInTime: { type: Date },
//     checkOutTime: { type: Date },
//     actualDuration: { type: Number }, // calculated in minutes
    
//     // Approval info
//     approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//     approvedAt: { type: Date },
//     rejectionReason: { type: String },
    
//     // Security tracking
//     securityUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//     checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//     checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
//     // Overstay tracking
//     overstayNotified: { type: Boolean, default: false },
//     overstayAlertSentAt: { type: Date },
//     overstayMinutes: { type: Number, default: 0 },
    
//     // Additional info
//     vehicleNumber: { type: String },
//     idProof: { type: String },
//     photoUrl: { type: String },
//     items: [String],
//     temperature: { type: Number },
//     notes: { type: String },
    
//     // QR expiry
//     qrExpiresAt: { type: Date },
    
//     // Face recognition
//     face: {
//       referenceHash: String,
//       verified: { type: Boolean, default: false },
//       lastVerifiedAt: Date,
//       attempts: { type: Number, default: 0 },
//     },
    
//     // History
//     history: [
//       {
//         action: String,
//         by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//         at: { type: Date, default: Date.now },
//         note: String,
//       },
//     ],
//   },
//   { timestamps: true }
// );

// // Index for faster queries
// visitorSchema.index({ status: 1, gate: 1 });
// visitorSchema.index({ checkInTime: 1 });
// visitorSchema.index({ allowedUntil: 1 });

// export default mongoose.model("Visitor", visitorSchema);


// models/Visitor.js
import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema(
  {
    // Basic Info
    visitorId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    company: {
      type: String,
      trim: true,
    },

    // Visit Details
    host: {
      type: String,
      required: true,
    },
    hostEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    purpose: {
      type: String,
      trim: true,
    },
    gate: {
      type: String,
      required: true,
      index: true,
    },

    // Time Management
    allowedUntil: {
      type: Date,
      required: true,
      index: true,
    },
    expectedDuration: {
      type: Number,
      default: 120, // minutes
    },
    gracePeriodMinutes: {
      type: Number,
      default: 10,
    },

    // Status
    status: {
      type: String,
      enum: [
        "CREATED",
        "PENDING",
        "APPROVED",
        "REJECTED",
        "IN",
        "OUT",
        "EXPIRED",
        "OVERSTAY",
      ],
      default: "PENDING",
      index: true,
    },

    // Check-in/out Times
    checkInTime: {
      type: Date,
      index: true,
    },
    checkOutTime: {
      type: Date,
    },
    actualDuration: {
      type: Number, // calculated in minutes
    },

    // Approval Info
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },

    // Email Approval
    approvalToken: {
      type: String,
      index: true,
    },
    approvalExpiresAt: {
      type: Date,
    },

    // Security Tracking
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    checkedOutBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Overstay Tracking
    overstayNotified: {
      type: Boolean,
      default: false,
    },
    overstayAlertSentAt: {
      type: Date,
    },
    overstayMinutes: {
      type: Number,
      default: 0,
    },

    // Additional Info
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    idProof: {
      type: String,
    },
    photoUrl: {
      type: String,
    },
    items: [String],
    temperature: {
      type: Number,
    },
    notes: {
      type: String,
    },

    // QR Code
    qrExpiresAt: {
      type: Date,
    },

    // Face Recognition
    face: {
      referenceHash: String,
      verified: {
        type: Boolean,
        default: false,
      },
      lastVerifiedAt: Date,
      attempts: {
        type: Number,
        default: 0,
      },
    },

    // History Log
    history: [
      {
        action: {
          type: String,
          required: true,
        },
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        at: {
          type: Date,
          default: Date.now,
        },
        note: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for faster queries
visitorSchema.index({ status: 1, gate: 1 });
visitorSchema.index({ checkInTime: 1, status: 1 });
visitorSchema.index({ allowedUntil: 1, status: 1 });
visitorSchema.index({ createdAt: -1 });

// Virtual for checking if visitor is currently inside
visitorSchema.virtual("isInside").get(function () {
  return ["IN", "OVERSTAY"].includes(this.status);
});

// Virtual for checking if visitor is overdue
visitorSchema.virtual("isOverdue").get(function () {
  if (!this.allowedUntil) return false;
  return new Date() > new Date(this.allowedUntil);
});

// Method to calculate overstay duration
visitorSchema.methods.calculateOverstay = function () {
  if (!this.isOverdue) return 0;
  const diff = Date.now() - new Date(this.allowedUntil).getTime();
  return Math.floor(diff / 60000); // minutes
};

// Method to add history entry
visitorSchema.methods.addHistory = function (action, userId, note) {
  this.history.push({
    action,
    by: userId,
    note,
    at: new Date(),
  });
};

// Pre-save middleware to update overstay status
visitorSchema.pre("save", function (next) {
  if (this.status === "IN" && this.isOverdue) {
    this.status = "OVERSTAY";
    this.overstayMinutes = this.calculateOverstay();
  }
  next();
});

// Static method to find visitors by gate
visitorSchema.statics.findByGate = function (gateId) {
  return this.find({ gate: String(gateId) }).sort({ createdAt: -1 });
};

// Static method to find active visitors
visitorSchema.statics.findActive = function () {
  return this.find({
    status: { $in: ["PENDING", "APPROVED", "IN", "OVERSTAY"] },
  }).sort({ createdAt: -1 });
};

// Static method to find overstaying visitors
visitorSchema.statics.findOverstaying = function () {
  return this.find({
    status: "OVERSTAY",
  }).sort({ overstayMinutes: -1 });
};

export default mongoose.model("Visitor", visitorSchema);
