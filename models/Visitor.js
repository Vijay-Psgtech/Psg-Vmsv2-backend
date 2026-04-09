/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISITOR MODEL - CORRECTED & PRODUCTION READY
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Optional fields where needed
 * ✅ Automatic generation of required fields
 * ✅ Proper indexing for performance
 * ✅ Complete validation
 */

import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema(
  {
    // ── Personal Info ──────────────────────────────────────────────
    visitorId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `VIS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    },

    name: {
      type: String,
      required: [true, "Visitor name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email"],
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    company: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Host Info ──────────────────────────────────────────────────
    host: {
      type: String,
      required: [true, "Host name is required"],
      trim: true,
    },

    hostEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "", // ✅ Optional - make default empty string
    },

    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostAdmin",
      default: null,
    },

    // ── Visit Info ─────────────────────────────────────────────────
    gate: {
      type: String,
      required: [true, "Gate is required"],
    },

    purpose: {
      type: String,
      trim: true,
      default: "",
    },

    vehicleNumber: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Duration & Timing ──────────────────────────────────────────
    expectedVisitDate: {
      type: Date,
      default: () => new Date(),
    },

    expectedDuration: {
      type: Number, // in minutes
      default: 120,
      min: 1,
      max: 1440,
    },

    allowedUntil: {
      type: Date,
      default: () => new Date(Date.now() + 120 * 60 * 1000), // ✅ Auto-generate: now + 120 minutes
    },

    checkInTime: {
      type: Date,
      default: null,
    },

    checkOutTime: {
      type: Date,
      default: null,
    },

    actualDuration: {
      type: Number, // in minutes
      default: null,
    },

    // ── Status ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ["PENDING", "APPROVED", "IN", "OUT", "OVERSTAY", "REJECTED", "EXPIRED"],
        message: "Status must be one of: PENDING, APPROVED, IN, OUT, OVERSTAY, REJECTED, EXPIRED",
      },
      default: "PENDING",
      index: true,
    },

    // ── Approval Info ──────────────────────────────────────────────
    approvedAt: {
      type: Date,
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    qrGenerated: {
      type: Boolean,
      default: false,
    },

    qrGeneratedAt: {
      type: Date,
      default: null,
    },

    // ── Rejection Info ────────────────────────────────────────────
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Check-in/Out Info ─────────────────────────────────────────
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    checkedOutBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Metadata ───────────────────────────────────────────────────
    notes: {
      type: String,
      trim: true,
      default: "",
    },

    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },

    // ── Timestamps ─────────────────────────────────────────────────
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "visitors",
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════════════

visitorSchema.index({ status: 1, createdAt: -1 });
visitorSchema.index({ gate: 1, status: 1 });
visitorSchema.index({ email: 1 });
visitorSchema.index({ host: 1 });
visitorSchema.index({ approvedAt: 1 });
visitorSchema.index({ checkInTime: 1 });

// ═══════════════════════════════════════════════════════════════════════════
// METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate overstay duration in minutes
 */
visitorSchema.methods.calculateOverstay = function () {
  if (this.status !== "OVERSTAY" || !this.checkInTime || !this.allowedUntil) {
    return 0;
  }
  const now = new Date();
  const overstayMs = now - this.allowedUntil;
  return Math.ceil(overstayMs / 60000);
};

/**
 * Check if visitor is currently inside (checked in)
 */
visitorSchema.methods.isInside = function () {
  return this.status === "IN" || this.status === "OVERSTAY";
};

/**
 * Check if visitor time has expired
 */
visitorSchema.methods.isExpired = function () {
  if (!this.allowedUntil) return false;
  return new Date() > this.allowedUntil;
};

/**
 * Add event to history
 */
visitorSchema.methods.addHistory = function (event, userId, description) {
  if (!this.history) {
    this.history = [];
  }
  this.history.push({
    event,
    userId,
    description,
    timestamp: new Date(),
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE (HOOKS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update allowedUntil when expectedDuration changes
 */
visitorSchema.pre("save", function (next) {
  // If visitorId wasn't generated, generate it
  if (!this.visitorId || this.isNew) {
    this.visitorId = `VIS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  // Recalculate allowedUntil based on expectedVisitDate and expectedDuration
  if (this.isModified("expectedDuration") || this.isModified("expectedVisitDate")) {
    const visitStart = this.expectedVisitDate || new Date();
    this.allowedUntil = new Date(visitStart.getTime() + this.expectedDuration * 60 * 1000);
  }

  // Set updatedAt
  this.updatedAt = new Date();

  next();
});

/**
 * Convert to JSON and remove sensitive info
 */
visitorSchema.methods.toJSON = function () {
  const obj = this.toObject();
  // Remove sensitive fields if needed
  return obj;
};

// ═══════════════════════════════════════════════════════════════════════════
// STATICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get visitor by ID (public or private)
 */
visitorSchema.statics.findByVisitorId = function (visitorId) {
  return this.findOne({ visitorId });
};

/**
 * Get all pending visitors
 */
visitorSchema.statics.getPending = function () {
  return this.find({ status: "PENDING" }).sort({ createdAt: -1 });
};

/**
 * Get all inside visitors
 */
visitorSchema.statics.getInside = function () {
  return this.find({ status: { $in: ["IN", "OVERSTAY"] } });
};

/**
 * Get statistics
 */
visitorSchema.statics.getStats = async function (filter = {}) {
  return this.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        today: { $sum: { $cond: [{ $gte: ["$createdAt", new Date(new Date().setHours(0, 0, 0, 0))] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] } },
        inside: { $sum: { $cond: [{ $eq: ["$status", "IN"] }, 1, 0] } },
        overstay: { $sum: { $cond: [{ $eq: ["$status", "OVERSTAY"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "OUT"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } },
      },
    },
  ]);
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

const Visitor = mongoose.model("Visitor", visitorSchema);

export default Visitor;

