import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    // ═══════════════════════════════════════════════════════════════════════
    // BASIC INFORMATION
    // ═══════════════════════════════════════════════════════════════════════
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [3, "Name must be at least 3 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Invalid email format",
      ],
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Don't return by default for security
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ROLE & PERMISSIONS
    // ═══════════════════════════════════════════════════════════════════════
    role: {
      type: String,
      enum: {
        values: ["superadmin", "admin", "security", "reception", "hostadmin"],
        message: "Invalid role",
      },
      default: "reception",
      required: true,
      index: true,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // DEPARTMENT & ASSIGNMENT
    // ═══════════════════════════════════════════════════════════════════════
    department: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },

    // ✅ SECURED: Only admin can assign gates (not auto-random)
    gateId: {
      type: String,
      trim: true,
      index: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true; // Can be null
          return /^GATE-\d+$/.test(v);
        },
        message: "Gate ID must be in format GATE-#",
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ACCOUNT STATUS
    // ═══════════════════════════════════════════════════════════════════════
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICATION & OTP
    // ═══════════════════════════════════════════════════════════════════════
    otp: {
      type: String,
      select: false, // Don't return in queries
    },

    otpExpiry: {
      type: Date,
      select: false,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PROFILE INFORMATION
    // ═══════════════════════════════════════════════════════════════════════
    profilePicture: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECURITY & AUTHENTICATION
    // ═══════════════════════════════════════════════════════════════════════

    // Login tracking
    lastLogin: {
      type: Date,
      default: null,
    },

    lastLoginIP: {
      type: String,
      default: null,
    },

    // ✅ SECURED: Failed login attempts tracking
    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    // ✅ SECURED: Account lock mechanism
    accountLockedUntil: {
      type: Date,
      default: null,
      select: false,
    },

    // 2FA (Two-Factor Authentication) fields
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    twoFactorSecret: {
      type: String,
      select: false,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PASSWORD RESET
    // ═══════════════════════════════════════════════════════════════════════
    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpiry: {
      type: Date,
      select: false,
    },

    resetPasswordAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PASSWORD HISTORY (Prevent reuse)
    // ═══════════════════════════════════════════════════════════════════════
    passwordHistory: [
      {
        password: {
          type: String,
          select: false,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    lastPasswordChange: {
      type: Date,
      default: Date.now,
      select: false,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // METADATA
    // ═══════════════════════════════════════════════════════════════════════
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // AUDIT HISTORY
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // PREFERENCES
    // ═══════════════════════════════════════════════════════════════════════
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// ✅ INDEXES FOR PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ department: 1, role: 1 });
userSchema.index({ gateId: 1, role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ email: 1, isActive: 1 });

// ═══════════════════════════════════════════════════════════════════════════
// ✅ VIRTUALS
// ═══════════════════════════════════════════════════════════════════════════

// Virtual for role name
userSchema.virtual("roleName").get(function () {
  const roleMap = {
    superadmin: "Super Administrator",
    admin: "Administrator",
    security: "Security Personnel",
    reception: "Reception Staff",
    hostadmin: "Host Administrator",
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

// ═══════════════════════════════════════════════════════════════════════════
// ✅ PRE-SAVE MIDDLEWARE - PASSWORD HASHING
// ═══════════════════════════════════════════════════════════════════════════
userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();

    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);

    this.lastPasswordChange = new Date();

    next();
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ✅ INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare password with hashed password
 */
userSchema.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

/**
 * Add entry to user history
 */
userSchema.methods.addHistory = function (action, userId, note, ip) {
  if (!Array.isArray(this.history)) {
    this.history = [];
  }

  this.history.push({
    action,
    by: userId,
    note,
    ip,
    at: new Date(),
  });

  // Keep only last 100 history entries
  if (this.history.length > 100) {
    this.history = this.history.slice(-100);
  }
};

/**
 * Check if account is locked
 */
userSchema.methods.isAccountLocked = function () {
  return this.accountLockedUntil && this.accountLockedUntil > new Date();
};

/**
 * Lock account for specified duration
 */
userSchema.methods.lockAccount = function (durationInMinutes = 30) {
  this.accountLockedUntil = new Date(
    Date.now() + durationInMinutes * 60 * 1000
  );
  this.addHistory(
    "ACCOUNT_LOCKED",
    null,
    `Account locked for ${durationInMinutes} minutes due to failed login attempts`
  );
};

/**
 * Unlock account
 */
userSchema.methods.unlockAccount = function () {
  this.accountLockedUntil = null;
  this.failedLoginAttempts = 0;
  this.addHistory("ACCOUNT_UNLOCKED", null, "Account manually unlocked");
};

/**
 * Increment failed login attempts
 */
userSchema.methods.incrementFailedAttempts = function () {
  this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;

  // Auto-lock after 5 failed attempts
  if (this.failedLoginAttempts >= 5) {
    this.lockAccount(30);
  }
};

/**
 * Reset failed login attempts
 */
userSchema.methods.resetFailedAttempts = function () {
  this.failedLoginAttempts = 0;
  if (this.accountLockedUntil) {
    this.accountLockedUntil = null;
  }
};

/**
 * Check if password was used before (for password history)
 */
userSchema.methods.wasPasswordUsedBefore = async function (password) {
  if (!Array.isArray(this.passwordHistory) || this.passwordHistory.length === 0) {
    return false;
  }

  for (const historyEntry of this.passwordHistory) {
    const isMatch = await bcrypt.compare(password, historyEntry.password);
    if (isMatch) return true;
  }

  return false;
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ STATIC METHODS - FIND OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find active users by role
 */
userSchema.statics.findByRole = function (role) {
  return this.find({ role, isActive: true }).sort({ name: 1 });
};

/**
 * Find all active users
 */
userSchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

/**
 * Find users by department
 */
userSchema.statics.findByDepartment = function (department) {
  return this.find({ department, role: "admin", isActive: true }).sort({
    name: 1,
  });
};

/**
 * Find security personnel assigned to gate
 */
userSchema.statics.findSecurityByGate = function (gateId) {
  return this.find({ gateId, role: "security", isActive: true }).sort({
    name: 1,
  });
};

/**
 * Find locked accounts
 */
userSchema.statics.findLockedAccounts = function () {
  return this.find({
    accountLockedUntil: { $gt: new Date() },
  }).select("+accountLockedUntil");
};

/**
 * Find inactive users (for cleanup/auditing)
 */
userSchema.statics.findInactive = function () {
  return this.find({ isActive: false }).sort({ updatedAt: -1 });
};

export default mongoose.model("User", userSchema);

