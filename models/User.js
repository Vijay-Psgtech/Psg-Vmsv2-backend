// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Basic Info
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
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },

    // Role & Permissions
    role: {
      type: String,
      enum: ["superadmin", "admin", "security", "reception"],
      default: "reception",
      required: true,
      index: true,
    },

    // Department (for admins)
    department: {
      type: String,
      trim: true,
      index: true,
    },

    // Gate Assignment (for security)
    gateId: {
      type: String,
      trim: true,
      index: true,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },

    // Profile
    profilePicture: {
      type: String,
    },
    address: {
      type: String,
    },

    // Security
    lastLogin: {
      type: Date,
    },
    lastLoginIP: {
      type: String,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    accountLockedUntil: {
      type: Date,
    },

    // Password Reset
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpiry: {
      type: Date,
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Activity History
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
        ip: String,
      },
    ],

    // Preferences
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for faster queries
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ department: 1, role: 1 });
userSchema.index({ gateId: 1, role: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full role name
userSchema.virtual("roleName").get(function () {
  const roleMap = {
    superadmin: "Super Administrator",
    admin: "Administrator",
    security: "Security Personnel",
    reception: "Reception Staff",
  };
  return roleMap[this.role] || this.role;
});

// Virtual for account status
userSchema.virtual("accountStatus").get(function () {
  if (this.accountLockedUntil && this.accountLockedUntil > new Date()) {
    return "LOCKED";
  }
  if (!this.isVerified) {
    return "UNVERIFIED";
  }
  if (!this.isActive) {
    return "INACTIVE";
  }
  return "ACTIVE";
});

// Method to add history entry
userSchema.methods.addHistory = function (action, userId, note, ip) {
  this.history = this.history || [];
  this.history.push({
    action,
    by: userId,
    note,
    ip,
    at: new Date(),
  });
};

// Method to check if account is locked
userSchema.methods.isAccountLocked = function () {
  return this.accountLockedUntil && this.accountLockedUntil > new Date();
};

// Method to lock account
userSchema.methods.lockAccount = function (durationInMinutes = 30) {
  this.accountLockedUntil = new Date(Date.now() + durationInMinutes * 60 * 1000);
  this.addHistory(
    "ACCOUNT_LOCKED",
    null,
    `Account locked for ${durationInMinutes} minutes due to failed login attempts`
  );
};

// Method to unlock account
userSchema.methods.unlockAccount = function () {
  this.accountLockedUntil = null;
  this.failedLoginAttempts = 0;
  this.addHistory("ACCOUNT_UNLOCKED", null, "Account manually unlocked");
};

// Static method to find by role
userSchema.statics.findByRole = function (role) {
  return this.find({ role, isActive: true }).sort({ name: 1 });
};

// Static method to find active users
userSchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find by department
userSchema.statics.findByDepartment = function (department) {
  return this.find({ department, role: "admin", isActive: true }).sort({ name: 1 });
};

// Static method to find security by gate
userSchema.statics.findSecurityByGate = function (gateId) {
  return this.find({ gateId, role: "security", isActive: true }).sort({ name: 1 });
};

// Pre-save middleware to update timestamps
userSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Ensure virtuals are included in JSON
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

export default mongoose.model("User", userSchema);

