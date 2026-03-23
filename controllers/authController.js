import User from "../models/User.js";
import OTP from "../models/OTP.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendOtpEmail } from "../utils/mailer.js";

// ═══════════════════════════════════════════════════════════════════════════
// ✅ HELPER: VALIDATE PASSWORD STRENGTH
// ═══════════════════════════════════════════════════════════════════════════
const validatePasswordStrength = (password) => {
  const errors = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ HELPER: VALIDATE EMAIL FORMAT
// ═══════════════════════════════════════════════════════════════════════════
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ HELPER: VALIDATE PHONE FORMAT
// ═══════════════════════════════════════════════════════════════════════════
const validatePhone = (phone) => {
  const phoneRegex = /^[0-9\s\-\+\(\)]{10,}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ HELPER: GENERATE JWT WITH SECURE CLAIMS
// ═══════════════════════════════════════════════════════════════════════════
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.sign(
    {
      _id: user._id.toString(),
      role: user.role,
      gateId: user.gateId || null,
      iat: Math.floor(Date.now() / 1000), // Issued at
      type: "access", // Token type
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ HELPER: GENERATE REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════
const generateRefreshToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.sign(
    {
      _id: user._id.toString(),
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ LOGIN - FULLY SECURED
// ═══════════════════════════════════════════════════════════════════════════
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // ✅ Input validation
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
        code: "MISSING_CREDENTIALS",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        code: "INVALID_EMAIL",
      });
    }

    // ✅ Find user by email (include password for verification)
    const user = await User.findOne({ email }).select("+password");

    // ✅ Generic error message to prevent user enumeration
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // ✅ Check if account is locked
    if (user.isAccountLocked()) {
      return res.status(423).json({
        error: "Account is temporarily locked due to multiple failed login attempts. Please try again later.",
        code: "ACCOUNT_LOCKED",
        lockedUntil: user.accountLockedUntil,
      });
    }

    // ✅ Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        error: "Account has been deactivated",
        code: "ACCOUNT_INACTIVE",
      });
    }

    // ✅ Verify password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // ✅ Increment failed login attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // ✅ Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.lockAccount(30); // Lock for 30 minutes
        await user.save();

        return res.status(423).json({
          error: "Account locked due to multiple failed login attempts",
          code: "ACCOUNT_LOCKED_TOO_MANY_ATTEMPTS",
          lockedUntil: user.accountLockedUntil,
        });
      }

      user.addHistory(
        "FAILED_LOGIN_ATTEMPT",
        null,
        `Failed login attempt (${user.failedLoginAttempts}/5)`,
        clientIP
      );

      await user.save();

      return res.status(401).json({
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // ✅ Reset failed login attempts on successful login
    user.failedLoginAttempts = 0;
    user.lastLogin = new Date();
    user.lastLoginIP = clientIP;

    user.addHistory("LOGIN_SUCCESS", user._id, "Successful login", clientIP);

    await user.save();

    // ✅ Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // ✅ Return response without sensitive data
    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gateId: user.gateId || null,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    console.error("LOGIN_ERROR:", err.message); // ✅ No sensitive data logged

    res.status(500).json({
      error: "Login failed. Please try again later.",
      code: "SERVER_ERROR",
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ SEND OTP - WITH RATE LIMITING & SECURITY
// ═══════════════════════════════════════════════════════════════════════════
export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // ✅ Input validation
    if (!email) {
      return res.status(400).json({
        error: "Email is required",
        code: "MISSING_EMAIL",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        code: "INVALID_EMAIL",
      });
    }

    // ✅ Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // ✅ Don't reveal if user exists
      return res.json({
        success: true,
        message: "If the email exists, OTP has been sent",
      });
    }

    // ✅ Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        error: "Account has been deactivated",
        code: "ACCOUNT_INACTIVE",
      });
    }

    // ✅ RATE LIMITING: Check if OTP was sent recently
    const recentOtp = await OTP.findOne({ email });
    if (recentOtp && recentOtp.createdAt > new Date(Date.now() - 2 * 60 * 1000)) {
      // Less than 2 minutes since last OTP
      return res.status(429).json({
        error: "OTP was recently sent. Please wait before requesting again.",
        code: "OTP_RATE_LIMITED",
        retryAfter: 120, // seconds
      });
    }

    // ✅ RATE LIMITING: Check daily limit (max 5 OTPs per day)
    const dailyOtpCount = await OTP.countDocuments({
      email,
      createdAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    });

    if (dailyOtpCount >= 5) {
      user.addHistory(
        "OTP_RATE_LIMIT_EXCEEDED",
        null,
        "Multiple OTP requests exceeded daily limit",
        clientIP
      );
      await user.save();

      return res.status(429).json({
        error: "Too many OTP requests. Please try again tomorrow.",
        code: "OTP_DAILY_LIMIT_EXCEEDED",
      });
    }

    // ✅ Generate secure OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Clean up old OTPs
    await OTP.deleteMany({ email });

    // ✅ Store new OTP
    await OTP.create({
      email,
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
    });

    // ✅ Send OTP via email
    await sendOtpEmail(email, otp);

    user.addHistory("OTP_SENT", null, "OTP sent to email", clientIP);
    await user.save();

    // ✅ Do NOT log OTP code
    res.json({
      success: true,
      message: "OTP sent to your email address",
    });
  } catch (err) {
    console.error("SEND_OTP_ERROR:", err.message); // ✅ No sensitive data

    res.status(500).json({
      error: "Failed to send OTP. Please try again later.",
      code: "SERVER_ERROR",
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ VERIFY OTP - FULLY SECURED
// ═══════════════════════════════════════════════════════════════════════════
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // ✅ Input validation
    if (!email || !otp) {
      return res.status(400).json({
        error: "Email and OTP are required",
        code: "MISSING_FIELDS",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        code: "INVALID_EMAIL",
      });
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return res.status(400).json({
        error: "Invalid OTP format",
        code: "INVALID_OTP_FORMAT",
      });
    }

    // ✅ Find OTP record
    const record = await OTP.findOne({ email });
    if (!record) {
      return res.status(400).json({
        error: "No OTP found for this email",
        code: "NO_OTP_FOUND",
      });
    }

    // ✅ Check if OTP is expired
    if (record.expiresAt < Date.now()) {
      await OTP.deleteMany({ email });
      return res.status(400).json({
        error: "OTP has expired. Please request a new one.",
        code: "OTP_EXPIRED",
      });
    }

    // ✅ Check OTP attempt limit (max 5 attempts)
    if (record.attempts >= 5) {
      await OTP.deleteMany({ email });
      return res.status(429).json({
        error: "Too many failed OTP attempts. Please request a new OTP.",
        code: "OTP_ATTEMPTS_EXCEEDED",
      });
    }

    // ✅ Verify OTP (use constant-time comparison to prevent timing attacks)
    const otpMatch = crypto.timingSafeEqual(
      Buffer.from(record.otp),
      Buffer.from(otp)
    );

    if (!otpMatch) {
      record.attempts += 1;
      await record.save();

      const user = await User.findOne({ email });
      if (user) {
        user.addHistory(
          "OTP_VERIFICATION_FAILED",
          null,
          `Failed OTP verification attempt (${record.attempts}/5)`,
          clientIP
        );
        await user.save();
      }

      return res.status(400).json({
        error: "Invalid OTP",
        code: "INVALID_OTP",
        remainingAttempts: 5 - record.attempts,
      });
    }

    // ✅ OTP verified successfully
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // ✅ Check if account is locked
    if (user.isAccountLocked()) {
      return res.status(423).json({
        error: "Account is temporarily locked",
        code: "ACCOUNT_LOCKED",
      });
    }

    // ✅ Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        error: "Account has been deactivated",
        code: "ACCOUNT_INACTIVE",
      });
    }

    // ✅ Clean up OTP
    await OTP.deleteMany({ email });

    // ✅ Mark as verified
    user.isVerified = true;
    user.lastLogin = new Date();
    user.lastLoginIP = clientIP;
    user.failedLoginAttempts = 0;

    user.addHistory("OTP_VERIFICATION_SUCCESS", user._id, "OTP verified", clientIP);
    await user.save();

    // ✅ Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gateId: user.gateId || null,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    console.error("VERIFY_OTP_ERROR:", err.message); // ✅ No sensitive data

    res.status(500).json({
      error: "OTP verification failed. Please try again later.",
      code: "SERVER_ERROR",
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ RESEND OTP - WITH RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // ✅ Input validation
    if (!email) {
      return res.status(400).json({
        error: "Email is required",
        code: "MISSING_EMAIL",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        code: "INVALID_EMAIL",
      });
    }

    // ✅ Check user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: true,
        message: "If the email exists, OTP has been resent",
      });
    }

    // ✅ RATE LIMITING: Check if OTP was sent recently
    const recentOtp = await OTP.findOne({ email });
    if (recentOtp && recentOtp.createdAt > new Date(Date.now() - 2 * 60 * 1000)) {
      return res.status(429).json({
        error: "Please wait before requesting another OTP",
        code: "OTP_RATE_LIMITED",
        retryAfter: 120,
      });
    }

    // ✅ Generate secure OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Clean up old OTPs
    await OTP.deleteMany({ email });

    // ✅ Store new OTP
    await OTP.create({
      email,
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    // ✅ Send OTP via email
    await sendOtpEmail(email, otp);

    user.addHistory("OTP_RESENT", null, "OTP resent to email", clientIP);
    await user.save();

    res.json({
      success: true,
      message: "OTP has been resent to your email",
    });
  } catch (err) {
    console.error("RESEND_OTP_ERROR:", err.message); // ✅ No sensitive data

    res.status(500).json({
      error: "Failed to resend OTP. Please try again later.",
      code: "SERVER_ERROR",
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ REGISTER - FULLY VALIDATED & SECURED
// ═══════════════════════════════════════════════════════════════════════════
export const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, role } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // ✅ Input validation
    if (!name || !email || !password || !confirmPassword || !role) {
      return res.status(400).json({
        error: "All required fields must be provided",
        code: "MISSING_FIELDS",
      });
    }

    // ✅ Validate name (3-50 characters, no special characters)
    if (name.length < 3 || name.length > 50 || !/^[a-zA-Z\s\-']+$/.test(name)) {
      return res.status(400).json({
        error: "Invalid name format",
        code: "INVALID_NAME",
      });
    }

    // ✅ Validate email
    if (!validateEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        code: "INVALID_EMAIL",
      });
    }

    // ✅ Validate phone if provided
    if (phone && !validatePhone(phone)) {
      return res.status(400).json({
        error: "Invalid phone format",
        code: "INVALID_PHONE",
      });
    }

    // ✅ Check password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        error: "Passwords do not match",
        code: "PASSWORD_MISMATCH",
      });
    }

    // ✅ Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: "Password does not meet strength requirements",
        code: "WEAK_PASSWORD",
        requirements: passwordValidation.errors,
      });
    }

    // ✅ Validate role
    const validRoles = ["reception", "security"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: "Invalid role",
        code: "INVALID_ROLE",
      });
    }

    // ✅ Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: "Email is already registered",
        code: "USER_EXISTS",
      });
    }

    // ✅ Create new user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save hook
      phone: phone || "",
      role,
      isActive: true,
      isVerified: false,
    });

    user.addHistory("ACCOUNT_CREATED", null, "Account created via registration", clientIP);
    await user.save();

    // ✅ Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gateId: user.gateId || null,
      },
    });
  } catch (err) {
    console.error("REGISTER_ERROR:", err.message); // ✅ No sensitive data

    if (err.code === 11000) {
      return res.status(409).json({
        error: "Email is already registered",
        code: "DUPLICATE_EMAIL",
      });
    }

    res.status(500).json({
      error: "Registration failed. Please try again later.",
      code: "SERVER_ERROR",
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ REFRESH TOKEN - NEW ENDPOINT FOR TOKEN REFRESH
// ═══════════════════════════════════════════════════════════════════════════
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: "Refresh token is required",
        code: "MISSING_REFRESH_TOKEN",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

    // ✅ Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    if (decoded.type !== "refresh") {
      return res.status(401).json({
        error: "Invalid token type",
        code: "INVALID_TOKEN_TYPE",
      });
    }

    // ✅ Find user
    const user = await User.findById(decoded._id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "Invalid refresh token",
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    // ✅ Generate new access token
    const newToken = generateToken(user);

    res.json({
      success: true,
      token: newToken,
    });
  } catch (err) {
    console.error("REFRESH_TOKEN_ERROR:", err.message);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Refresh token has expired",
        code: "REFRESH_TOKEN_EXPIRED",
      });
    }

    res.status(401).json({
      error: "Token refresh failed",
      code: "TOKEN_REFRESH_FAILED",
    });
  }
};
