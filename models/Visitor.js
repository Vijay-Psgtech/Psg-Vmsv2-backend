import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema(
  {
    /* =========================
       CORE VISITOR INFO
    ========================== */
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
      index: true,
    },

    host: {
      type: String,
      required: true,
    },

    /* =========================
       GATE & SECURITY
    ========================== */
    gate: {
      type: String,
      required: true,
      index: true,
      immutable: true,
    },

    securityUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /* =========================
       STATUS FLOW
    ========================== */
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "IN", "OUT", "EXPIRED"],
      default: "PENDING",
      index: true,
    },

    rejectionReason: {
      type: String,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /* =========================
       TIME TRACKING
    ========================== */
    checkInTime: Date,
    checkOutTime: Date,

    qrExpiresAt: {
      type: Date,
      index: true,
    },

    /* =========================
       FACE VERIFICATION
    ========================== */
    faceCapture: {
      imageUrl: String, // stored face image
      verified: {
        type: Boolean,
        default: false,
      },
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      confidence: Number,
    },

    face: {
      referenceHash: String, // stored at admin approval
      verified: { type: Boolean, default: false },
      lastVerifiedAt: Date,
      attempts: { type: Number, default: 0 },
    },
    /* =========================
       SECURITY / AUDIT HISTORY
    ========================== */
    history: [
      {
        action: {
          type: String,
          enum: [
            "CREATED",
            "APPROVED",
            "REJECTED",
            "CHECKED_IN",
            "CHECKED_OUT",
            "FACE_VERIFIED",
            "EXPIRED",
          ],
        },
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        at: {
          type: Date,
          default: Date.now,
        },
        meta: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);

/* =========================
   AUTO EXPIRE VISITOR
========================== */
visitorSchema.pre("save", function (next) {
  if (
    this.qrExpiresAt &&
    this.qrExpiresAt < new Date() &&
    this.status === "APPROVED"
  ) {
    this.status = "EXPIRED";
  }
  next();
});

export default mongoose.model("Visitor", visitorSchema);