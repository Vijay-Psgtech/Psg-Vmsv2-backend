/**
 * HOST ADMIN MODEL - PRODUCTION FIXED
 * File: Server/models/HostAdminFixed.js
 *
 * FIXES:
 * 1. Auto-drops stale indexes (userId_1) that cause E11000 duplicate key errors
 * 2. Prevents "Cannot overwrite model" error on hot reload
 */

import mongoose from "mongoose";
import bcrypt from "bcrypt";

const HostAdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: false,
      default: null,
    },
    department: {
      type: String,
      required: false,
      default: "N/A",
    },
    company: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["hostadmin", "admin", "superadmin"],
      default: "hostadmin",
    },
    profileImage: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
HostAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
HostAdminSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Prevent model recompile on hot reload
let HostAdmin;
if (mongoose.models.HostAdmin) {
  HostAdmin = mongoose.model("HostAdmin");
} else {
  HostAdmin = mongoose.model("HostAdmin", HostAdminSchema);
}

// ── Drop stale indexes automatically on first connection ──────────────────
// The userId_1 index (and any other orphaned indexes) cause E11000 errors
// for every record where the field is null/missing. This runs once on startup.
mongoose.connection.once("open", async () => {
  try {
    const collection = mongoose.connection.collection("hostadmins");
    const indexes = await collection.indexes();
    const schemaFields = Object.keys(HostAdminSchema.paths);

    for (const index of indexes) {
      const indexField = Object.keys(index.key)[0];
      if (indexField === "_id") continue; // never drop _id
      if (!schemaFields.includes(indexField)) {
        await collection.dropIndex(index.name);
        console.log(`✅ Dropped stale index from hostadmins: ${index.name} (field: "${indexField}")`);
      }
    }
  } catch (err) {
    console.warn("⚠️ HostAdmin index cleanup warning:", err.message);
  }
});

export default HostAdmin;