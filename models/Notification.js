/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTIFICATION MODEL
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Stores notifications for visitors, hosts, and admin users
 * ✅ Supports filtering by recipient and role
 * ✅ Read/unread status tracking
 */

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // ── Recipient ──────────────────────────────────────────────────
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    recipientRole: {
      type: String,
      enum: ["admin", "security", "host", "superadmin"],
      default: "admin",
      index: true,
    },

    // ── Notification Content ──────────────────────────────────────
    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "VISITOR_CREATED",
        "VISITOR_APPROVED",
        "VISITOR_REJECTED",
        "CHECKIN",
        "CHECKOUT",
        "OVERSTAY",
        "ALERT",
        "SYSTEM",
      ],
      default: "SYSTEM",
      index: true,
    },

    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },

    // ── Status ─────────────────────────────────────────────────────
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    // ── Related Data ───────────────────────────────────────────────
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true, // Can reference visitor, alert, user, etc.
    },

    relatedType: {
      type: String,
      enum: ["Visitor", "Alert", "User", "HostAdmin"],
      default: "Visitor",
    },

    // ── Metadata ───────────────────────────────────────────────────
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ── Timestamps ─────────────────────────────────────────────────
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "notifications",
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════════════

notificationSchema.index({ recipientId: 1, read: 1 });
notificationSchema.index({ recipientRole: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ relatedId: 1, relatedType: 1 });

// Auto-delete after expiration
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ═══════════════════════════════════════════════════════════════════════════
// METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mark notification as read
 */
notificationSchema.methods.markAsRead = function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

/**
 * Mark notification as unread
 */
notificationSchema.methods.markAsUnread = function () {
  this.read = false;
  this.readAt = null;
  return this.save();
};

// ═══════════════════════════════════════════════════════════════════════════
// STATICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get unread notifications for user
 */
notificationSchema.statics.getUnread = function (userId) {
  return this.find({ recipientId: userId, read: false })
    .sort({ createdAt: -1 });
};

/**
 * Get notifications by role
 */
notificationSchema.statics.getByRole = function (role) {
  return this.find({ recipientRole: role, read: false })
    .sort({ createdAt: -1 });
};

/**
 * Mark all as read for user
 */
notificationSchema.statics.markAllAsRead = function (userId) {
  return this.updateMany(
    { recipientId: userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
