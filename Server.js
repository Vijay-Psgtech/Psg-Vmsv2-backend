// server.js - Main Express Server - PRODUCTION FIXED
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import {
  securityHeaders,
  corsConfig,
  dataSanitization,
  globalRateLimit,
  authRateLimit,
  requestIdMiddleware,
  loggingMiddleware,
  errorHandler,
  notFoundHandler,
} from "./middleware/Security.js";

import { requireAuth } from "./middleware/auth.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import visitorRoutes from "./routes/visitorRoutes.js";
import hostAdminRoutes from "./routes/Hostadminroutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import notificationRoutes from "./routes/notification.js";
import securityRoutes from "./routes/securityRoutes.js";
import gateRoutes from "./routes/gateRoutes.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5100", "http://127.0.0.1:5173", "https://vmstest.psginstitutions.in"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
});

// Socket auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Socket authentication failed: no token"));
  next();
});

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);
  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", socket.id, reason);
  });
});

app.set("io", io);
app.set("etag", false);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(securityHeaders());
app.use(corsConfig());
app.use(globalRateLimit);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(...dataSanitization());
app.use(requestIdMiddleware);
app.use(loggingMiddleware);

// =====================================================
// DATABASE
// =====================================================

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/vpass");
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};
connectDB();

// =====================================================
// ROUTES
// =====================================================

// Auth routes (rate limited)
app.use("/api/auth", authRateLimit, authRoutes);

// Verify token endpoint
app.post("/api/auth/verify", requireAuth, (req, res) => {
  res.json({ success: true, message: "Token valid", user: req.user });
});

// Get current user
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch {
    res.status(500).json({ success: false, message: "Error fetching user" });
  }
});

// Core API routes
app.use("/api/visitor", visitorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hostadmin", hostAdminRoutes);
app.use("/api/superadmin", superAdminRoutes);  // FIX: was missing
app.use("/api/notification", notificationRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/gate", gateRoutes);
// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// =====================================================
// ERROR HANDLING
// =====================================================

app.use(notFoundHandler);
app.use(errorHandler);

// =====================================================
// START SERVER
// =====================================================

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         VPASS Security Dashboard API             ║
║                                                  ║
║  🚀 Server: http://localhost:${PORT}              ║
║  🔌 Socket.IO: Enabled                           ║
║  🌍 Environment: ${NODE_ENV}                     ║
║                                                  ║
║  API Routes:                                     ║
║  POST /api/auth/login                            ║
║  POST /api/auth/send-otp                         ║
║  POST /api/auth/verify-otp                       ║
║  GET  /api/visitor                               ║
║  POST /api/visitor                               ║
║  POST /api/visitor/:id/approve                   ║
║  POST /api/visitor/:id/checkin                   ║
║  POST /api/visitor/:id/checkout                  ║
║  GET  /api/hostadmin                             ║
║  POST /api/hostadmin                             ║
║  GET  /api/superadmin/statistics                 ║
║  GET  /api/superadmin/hostadmins                 ║
║  POST /api/superadmin/hostadmins                 ║
╚══════════════════════════════════════════════════╝
  `);
});

process.on("SIGINT", async () => {
  console.log("\n📴 Shutting down gracefully...");
  await mongoose.connection.close();
  process.exit(0);
});

export default app;