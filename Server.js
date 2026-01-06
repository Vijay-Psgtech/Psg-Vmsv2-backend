/***************************************************************
 * VPASS — Production Server
 * Author: Sarath Kannan
 * ✅ UPDATED: Added Super Admin Routes, Alert System, Overstay Monitoring
 ***************************************************************/
import dotenv from "dotenv";
dotenv.config();
import express from "express";

import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import twilio from "twilio";

/* ROUTES */
import authRoutes from "./routes/authRoutes.js";
import visitorRoutes from "./routes/visitorRoutes.js";
import securityRoutes from "./routes/securityRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import gateRoutes from "./routes/gateRoutes.js";
import notifyRoutes from "./routes/notifyRoutes.js";
import twilioWebhook from "./routes/twilioWebhook.js";
import auditRoutes from "./routes/auditRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js"; // ✅ NEW

import "./utils/mailer.js"; // 🔔 INITIALIZE SMTP

/* ✅ Import Overstay Watcher */
import { startOverstayWatcher } from "./utils/overstayWatcher.js";

/* MODELS */
import Visitor from "./models/Visitor.js";

/* SOCKET HANDLER */
import socketHandler from "./socket.js";

/* ----------------------------------------------------------- */
const app = express();
const server = http.createServer(app);

/* ----------------------------------------------------------- */
/* TRUST PROXY (IMPORTANT FOR IP LOGGING) */
app.set("trust proxy", 1);

/* ----------------------------------------------------------- */
/* MIDDLEWARE */
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(helmet());
app.use(morgan("dev"));
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* ----------------------------------------------------------- */
/* RATE LIMIT */
// app.use(
//   "/api/",
//   rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 200,
//     standardHeaders: true,
//     legacyHeaders: false,
//   })
// );

/* ----------------------------------------------------------- */
/* 🔥 SOCKET.IO — SINGLE INSTANCE */
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
  transports: ["websocket", "polling"],
  allowUpgrades: true,
});

/* 🔌 ATTACH SOCKET TO REQUEST */
app.use((req, res, next) => {
  req.io = io;
  next();
});

/* 🔌 INITIALIZE SOCKET HANDLER */
socketHandler(io);

/* ✅ Start Overstay Monitoring with Socket.IO */
startOverstayWatcher(io);
console.log("⚠️ Overstay monitoring initialized");

/* ----------------------------------------------------------- */
/* SOCKET HELPER */
export const emitVisitorUpdate = async () => {
  if (mongoose.connection.readyState !== 1) return;

  const visitors = await Visitor.find().sort({ createdAt: -1 }).limit(100);

  io.emit("visitors:update", visitors);
};

/* ----------------------------------------------------------- */
/* TWILIO SAFE WRAPPER */
let twilioClient = null;

function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }

  if (!twilioClient) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  return twilioClient;
}

export const safeTwilio = {
  sendSMS: async (to, message) => {
    const client = getTwilioClient();
    if (!client) return;
    return client.messages.create({
      body: message,
      to,
      from: process.env.TWILIO_SMS_FROM,
    });
  },
};

/* ----------------------------------------------------------- */
/* ROUTES */
app.use("/api/auth", authRoutes);
app.use("/api/visitor", visitorRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/gates", gateRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/notify", notifyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/alert", alertRoutes);
app.use("/api/superadmin", superAdminRoutes); // ✅ NEW: Super Admin Routes

app.use("/webhook", twilioWebhook);

/* ----------------------------------------------------------- */
/* ✅ Health Check with More Info */
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "VPASS Visitor Management API",
    version: "2.1.0", // ✅ Updated version
    features: {
      socketIO: true,
      overstayMonitoring: true,
      alertSystem: true,
      superAdminPanel: true, // ✅ NEW
    },
    timestamp: new Date().toISOString(),
  });
});

/* ----------------------------------------------------------- */
/* 404 */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ----------------------------------------------------------- */
/* ERROR HANDLER */
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});


// Add this to your server.js for testing
app.get("/api/test-email", async (req, res) => {
  const { sendTestEmail } = await import("./utils/mailer.js");
  const result = await sendTestEmail("sk123Sarath@gmail.com");
  res.json({ success: result, message: result ? "Email sent!" : "Failed to send" });
});

/* ----------------------------------------------------------- */
/* START SERVER */
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    /* ⏳ AUTO EXPIRE VISITORS (every 15 minutes) */
    cron.schedule("*/15 * * * *", async () => {
      if (mongoose.connection.readyState !== 1) return;

      const result = await Visitor.updateMany(
        {
          status: { $in: ["APPROVED", "IN"] },
          qrExpiresAt: { $lt: new Date() },
        },
        { $set: { status: "EXPIRED" } }
      );

      if (result.modifiedCount > 0) {
        console.log(`⏳ Expired ${result.modifiedCount} visitors`);
        await emitVisitorUpdate();
      }
    });

    /* ✅ Enhanced startup message */
    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════╗
║   🚀 VPASS SERVER RUNNING                      ║
╠════════════════════════════════════════════════╣
║   📡 URL: http://localhost:${PORT.toString().padEnd(21)}║
║   🔌 Socket.IO: ENABLED                        ║
║   ⚠️  Overstay Monitor: ACTIVE                 ║
║   🔔 Alert System: READY                       ║
║   👑 Super Admin: ENABLED                      ║
╚════════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error("❌ Startup failed:", err.message);
    process.exit(1);
  }
}

startServer();

/* ----------------------------------------------------------- */
/* GRACEFUL SHUTDOWN */
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await mongoose.disconnect();
  io.close();
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

/* ✅ Handle uncaught errors */
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  process.exit(1);
});