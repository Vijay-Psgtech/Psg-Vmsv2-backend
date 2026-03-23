// models/Alert.js
import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "OVERSTAY",
        "UNAUTHORIZED_ENTRY",
        "SYSTEM_ALERT",
        "SECURITY_BREACH",
        "VISITOR_VIOLATION",
      ],
      required: true,
      index: true,
    },

    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
      index: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    // Associated visitor
    visitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visitor",
      index: true,
    },

    // Associated gate
    gate: {
      type: String,
      index: true,
    },

    // Status
    status: {
      type: String,
      enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"],
      default: "ACTIVE",
      index: true,
    },

    // Who acknowledged it
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    acknowledgedAt: {
      type: Date,
    },

    // Additional data
    data: mongoose.Schema.Types.Mixed,

    // Timeline
    resolvedAt: {
      type: Date,
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
alertSchema.index({ createdAt: -1 });
alertSchema.index({ gate: 1, status: 1 });
alertSchema.index({ severity: 1, status: 1 });

// Virtual for time since alert
alertSchema.virtual("timeSince").get(function () {
  const diff = Date.now() - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
});

export default mongoose.model("Alert", alertSchema);