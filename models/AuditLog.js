import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    /* =========================
       ACTOR INFO
    ========================== */
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    actorRole: {
      type: String,
      index: true,
    },

    /* =========================
       ACTION DETAILS
    ========================== */
    action: {
      type: String,
      required: true,
      index: true,
    },

    entity: {
      type: String,
      required: true,
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },

    /* =========================
       VISITOR / SECURITY CONTEXT
    ========================== */
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visitor",
      index: true,
    },

    gateId: {
      type: String,
      index: true,
    },

    /* =========================
       RESULT & SEVERITY
    ========================== */
    outcome: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "DENIED"],
      default: "SUCCESS",
      index: true,
    },

    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
      index: true,
    },

    /* =========================
       TECHNICAL CONTEXT
    ========================== */
    source: {
      type: String,
      enum: ["API", "SOCKET", "SYSTEM"],
      default: "API",
    },

    requestId: {
      type: String,
      index: true,
    },

    ip: String,

    userAgent: String,

    /* =========================
       FLEXIBLE META
    ========================== */
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

/* =========================
   INDEXING STRATEGY
========================== */
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorRole: 1, createdAt: -1 });
auditLogSchema.index({ visitorId: 1, createdAt: -1 });
auditLogSchema.index({ gateId: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);