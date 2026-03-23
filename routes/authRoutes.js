// backend/routes/authRoutes.js
// FIXED - supports both User and HostAdmin models for OTP login
// ✅ ADDED: Detailed debugging for JWT token issue
import express from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import HostAdmin from "../models/HostAdminFixed.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// HELPER — find account in User OR HostAdmin collection
// ═══════════════════════════════════════════════════════════════════════════

async function findAccount(email, selectFields = "") {
  // Check User model first
  let account = await User.findOne({ email: email.toLowerCase().trim() })
    .select(selectFields);
  if (account) return { account, modelType: "user" };

  // Check HostAdmin model
  account = await HostAdmin.findOne({ email: email.toLowerCase().trim() })
    .select(selectFields);
  if (account) return { account, modelType: "hostadmin" };

  return { account: null, modelType: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER — build JWT + user response object
// ═══════════════════════════════════════════════════════════════════════════

function buildAuthResponse(account, modelType) {
  // ✅ DEBUGGING: Log the actual _id being used
  console.log(`\n🔐 BUILDING JWT TOKEN:`);
  console.log(`   Model Type: ${modelType}`);
  console.log(`   Account _id: ${account._id}`);
  console.log(`   Account _id Type: ${typeof account._id}`);
  console.log(`   Account _id String: ${account._id.toString()}`);

  // Determine role:
  // - User model: use account.role directly
  // - HostAdmin model: always "hostadmin"
  const role = modelType === "hostadmin" ? "hostadmin" : account.role;

  const tokenPayload = {
    _id: account._id.toString(),   // ✅ Convert to string explicitly
    id: account._id.toString(),    // keep id too for backward compat
    email: account.email,
    role,
  };

  console.log(`   JWT Payload: ${JSON.stringify(tokenPayload)}`);

  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
  );

  console.log(`   Token generated: ${token.substring(0, 50)}...`);
  console.log(`✅ JWT built successfully\n`);

  return {
    token,
    user: {
      _id: account._id.toString(),
      name: account.name,
      email: account.email,
      role,
      isVerified: account.isVerified ?? true,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN — email + password
// ═══════════════════════════════════════════════════════════════════════════

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`\n📤 Login attempt: ${email}`);

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // ✅ Search both models
    const { account, modelType } = await findAccount(email, "+password");

    console.log(`   Model found: ${modelType}`);
    console.log(`   Account exists: ${account ? "YES" : "NO"}`);

    if (!account) {
      console.log(`❌ Account not found: ${email}`);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log(`   Account ID: ${account._id}`);

    // Only User model has isActive / account lock — skip for HostAdmin
    if (modelType === "user") {
      if (!account.isActive) {
        return res.status(403).json({ error: "Account is inactive. Contact administrator." });
      }
      if (account.accountLockedUntil && account.accountLockedUntil > new Date()) {
        return res.status(423).json({ error: "Account temporarily locked. Try again later." });
      }
    }

    // HostAdmin may not have a password (superadmin created without one)
    if (!account.password) {
      return res.status(400).json({ error: "This account uses OTP login. Use the OTP tab." });
    }

    const isPasswordValid = await bcryptjs.compare(password, account.password);

    if (!isPasswordValid) {
      if (modelType === "user") {
        account.failedLoginAttempts = (account.failedLoginAttempts || 0) + 1;
        if (account.failedLoginAttempts >= 5) {
          account.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
          console.log(`🔒 Account locked: ${email}`);
        }
        await account.save();
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Reset failed attempts
    if (modelType === "user") {
      account.failedLoginAttempts = 0;
      account.accountLockedUntil = null;
    }
    account.lastLogin = new Date();
    await account.save();

    const { token, user } = buildAuthResponse(account, modelType);
    console.log(`✅ Login successful: ${email} (${user.role})`);

    return res.json({ success: true, token, user });
  } catch (error) {
    console.error("❌ Login error:", error.message);
    return res.status(500).json({ error: "Login failed. Please try again later." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════════════════

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    console.log(`📤 Register attempt: ${email}`);

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3) return res.status(400).json({ error: "Name must be at least 3 characters" });
    if (trimmedName.length > 50) return res.status(400).json({ error: "Name must not exceed 50 characters" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email address" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: "Email already registered." });

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newUser = new User({
      name: trimmedName,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role || "reception",
      isActive: true,
      isVerified: false,
    });

    await newUser.save();

    const { token, user } = buildAuthResponse(newUser, "user");
    console.log(`✅ User registered: ${email}`);

    return res.status(201).json({ success: true, token, user });
  } catch (error) {
    console.error("❌ Register error:", error.message);
    return res.status(500).json({ error: "Registration failed. Please try again later." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SEND OTP — searches BOTH User and HostAdmin
// ═══════════════════════════════════════════════════════════════════════════

router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`\n📤 Send OTP attempt: ${email}`);

    if (!email) return res.status(400).json({ error: "Email is required" });

    // ✅ FIXED: search both collections
    const { account, modelType } = await findAccount(email);

    console.log(`   Model found: ${modelType}`);
    console.log(`   Account exists: ${account ? "YES" : "NO"}`);
    if (account) {
      console.log(`   Account ID: ${account._id}`);
    }

    if (!account) {
      console.log(`❌ Account not found for OTP: ${email}`);
      // Security: don't reveal if account exists
      return res.json({ success: true, message: "If email exists, OTP has been sent" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    console.log(`📌 Generated OTP for ${modelType}: ${otp}`);

    account.otp = otp;
    account.otpExpiry = otpExpiry;
    await account.save();

    console.log(`✅ OTP saved to ${modelType}: ${email}\n`);

    return res.json({
      success: true,
      message: "OTP sent to your email",
      testOtp: otp, // remove in production
    });
  } catch (error) {
    console.error("❌ Send OTP error:", error.message);
    return res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY OTP — searches BOTH User and HostAdmin
// ═══════════════════════════════════════════════════════════════════════════

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log(`\n📤 Verify OTP attempt: ${email}, OTP: ${otp}`);

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    // ✅ FIXED: search both collections, select OTP fields
    const { account, modelType } = await findAccount(email, "+otp +otpExpiry");

    console.log(`   Model found: ${modelType}`);
    console.log(`   Account exists: ${account ? "YES" : "NO"}`);
    if (account) {
      console.log(`   Account ID: ${account._id}`);
    }

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    console.log(`   OTP in DB: ${account.otp}, Expiry: ${account.otpExpiry}`);

    if (!account.otp || !account.otpExpiry) {
      return res.status(400).json({ error: "No OTP found. Request a new one." });
    }

    if (account.otpExpiry < new Date()) {
      account.otp = null;
      account.otpExpiry = null;
      await account.save();
      return res.status(400).json({ error: "OTP expired. Request a new one." });
    }

    console.log(`   Comparing: "${account.otp}" === "${otp}"`);
    if (account.otp !== otp) {
      return res.status(401).json({ error: "Invalid OTP" });
    }

    // ✅ OTP correct — clear it and log in
    account.otp = null;
    account.otpExpiry = null;
    account.isVerified = true;
    account.lastLogin = new Date();
    await account.save();

    const { token, user } = buildAuthResponse(account, modelType);
    console.log(`✅ OTP verified: ${email} (${user.role})\n`);

    return res.json({ success: true, token, user });
  } catch (error) {
    console.error("❌ Verify OTP error:", error.message);
    return res.status(500).json({ error: "OTP verification failed. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// RESEND OTP — searches BOTH User and HostAdmin
// ═══════════════════════════════════════════════════════════════════════════

router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`📤 Resend OTP attempt: ${email}`);

    if (!email) return res.status(400).json({ error: "Email is required" });

    // ✅ FIXED: search both collections
    const { account, modelType } = await findAccount(email);

    if (!account) {
      return res.json({ success: true, message: "If email exists, OTP has been resent" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    account.otp = otp;
    account.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await account.save();

    console.log(`✅ OTP resent to ${modelType}: ${email}, OTP: ${otp}`);

    return res.json({
      success: true,
      message: "OTP has been resent",
      testOtp: otp, // remove in production
    });
  } catch (error) {
    console.error("❌ Resend OTP error:", error.message);
    return res.status(500).json({ error: "Failed to resend OTP. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════

router.post("/logout", (req, res) => {
  console.log(`\n👋 Logout successful`);
  res.json({ success: true, message: "Logged out successfully" });
});

export default router;