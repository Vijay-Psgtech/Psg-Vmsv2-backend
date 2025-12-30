import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["OVERSTAY", "EMERGENCY", "SUSPICIOUS", "SYSTEM"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
    },
    visitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visitor",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    gate: { type: String },
    isRead: { type: Boolean, default: false },
    readBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    readAt: Date,
    resolvedAt: Date,
  },
  { timestamps: true }
);

alertSchema.index({ isRead: 1, createdAt: -1 });
alertSchema.index({ gate: 1 });

export default mongoose.model("Alert", alertSchema);