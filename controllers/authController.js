import User from "../models/User.js";
import OTP from "../models/OTP.js";
import jwt from "jsonwebtoken";

/* ================================
   HELPER: GENERATE JWT
================================ */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,            
      gateId: user.gateId || null 
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

/* ================================
   LOGIN
================================ */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    // AUTO-ASSIGN GATE FOR SECURITY
    if (user.role === "security" && !user.gateId) {
      user.gateId = `GATE-${Math.floor(Math.random() * 10) + 1}`;
      await user.save();
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gateId: user.gateId || null,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Login failed" });
  }
};

/* ================================
   SEND OTP
================================ */
export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.deleteMany({ email });
    await OTP.create({
      email,
      otp,
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes
    });

    console.log("OTP SENT:", email, otp);
    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("SEND OTP ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/* ================================
   VERIFY OTP
================================ */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

    const record = await OTP.findOne({ email, otp });
    if (!record) return res.status(400).json({ error: "Invalid OTP" });

    if (record.expiresAt < Date.now()) {
      await OTP.deleteMany({ email });
      return res.status(400).json({ error: "OTP expired" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    await OTP.deleteMany({ email });

    // AUTO-ASSIGN GATE FOR SECURITY
    if (user.role === "security" && !user.gateId) {
      user.gateId = `GATE-${Math.floor(Math.random() * 10) + 1}`;
      await user.save();
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gateId: user.gateId || null,
      },
    });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({ error: "OTP verification failed" });
  }
};

/* ================================
   RESEND OTP
================================ */
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.deleteMany({ email });
    await OTP.create({
      email,
      otp,
      expiresAt: Date.now() + 2 * 60 * 1000,
    });

    console.log("OTP RESENT:", email, otp);
    res.json({ message: "OTP resent successfully" });
  } catch (err) {
    console.error("RESEND OTP ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/* ================================
   REGISTER USER
================================ */
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: "All fields required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "User already exists" });

    const user = await User.create({ name, email, password, role });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gateId: user.gateId,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};