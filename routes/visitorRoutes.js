import express from "express";
import Visitor from "../models/Visitor.js";
import AuditLog from "../models/AuditLog.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";
import { decryptQR } from "../utils/qrCrypto.js";
import { generateBadge } from "../utils/pdf.js";
import { hashFace, compareFace } from "../utils/face.js";
import { sendEmail } from "../utils/mailer.js";
import { safeTwilio } from "../server.js";

const router = express.Router();

/* =========================================================
   CREATE VISITOR (Reception)
========================================================= */
router.post(
  "/create",
  requireAuth,
  requireRole("reception"),
  async (req, res) => {
    try {
      const { firstName, lastName, phone, host, gate } = req.body;

      if (!firstName || !lastName || !phone || !host || !gate) {
        return res.status(400).json({
          message: "Missing required fields",
        });
      }

      const visitor = await Visitor.create({
        visitorId: `VIS-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name: `${firstName} ${lastName}`,
        phone,
        host,
        gate, // 🔒 Gate bound permanently
        qrExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        history: [
          {
            action: "CREATED",
            by: req.user.id,
          },
        ],
      });

      req.io?.emit("visitors:update");

      // Email
      sendEmail(
        "rvk.its@psgtech.ac.in",
        "New Visitor Approval Required",
        `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f8; padding: 30px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); overflow: hidden;">
          
          <div style="background-color: #2563eb; color: #ffffff; padding: 16px 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">New Visitor Approval Required</h2>
          </div>

          <div style="padding: 24px; color: #333;">
            <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
              A new visitor has been registered and is awaiting your approval in the <strong>VPass System</strong>.
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #111;">Name:</td>
                <td style="padding: 8px 0; color: #555;">${visitor.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #111;">Phone:</td>
                <td style="padding: 8px 0; color: #555;">${visitor.phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #111;">Host:</td>
                <td style="padding: 8px 0; color: #555;">${visitor.host}</td>
              </tr>
            </table>

            <p style="font-size: 15px; line-height: 1.6;">
              Please <a href="http://localhost:5173/login" style="color: #2563eb; text-decoration: none; font-weight: 600;">log in</a> to the VPass system to approve or reject this visitor.
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:5173/login"
                style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Review Visitor
              </a>
            </div>
          </div>

          <div style="background-color: #f0f4f8; color: #666; font-size: 13px; text-align: center; padding: 16px;">
            <p style="margin: 0;">This is an automated message from <strong>VPass System</strong>. Please do not reply to this email.</p>
          </div>
        </div>
      </div>`
      ).catch((e) => console.warn("Email failed:", e.message));

      res.status(201).json(visitor);
    } catch (err) {
      console.error("CREATE VISITOR ERROR:", err);
      res.status(500).json({ message: "Failed to create visitor" });
    }
  }
);
/* =========================================================
   GET VISITORS
========================================================= */
router.get(
  "/",
  requireAuth,
  requireRole("reception", "security", "admin"),
  async (req, res) => {
    try {
      const visitors = await Visitor.find().sort({ createdAt: -1 });
      res.json(visitors);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch visitors" });
    }
  }
);

/* =========================================================
   CHECK-IN VISITOR (Security)
========================================================= */
router.post(
  "/checkin",
  requireAuth,
  requireRole("security"),
  async (req, res) => {
    try {
      const { visitorId } = req.body;
      if (!visitorId) {
        return res.status(400).json({ message: "visitorId required" });
      }

      const visitor = await Visitor.findOne({ visitorId });
      if (!visitor) {
        return res.status(404).json({ message: "Visitor not found" });
      }

      /* 🔐 Gate enforcement */
      if (visitor.gate !== req.user.gateId) {
        return res.status(403).json({
          message: "Visitor assigned to different gate",
        });
      }

      if (visitor.status !== "APPROVED") {
        return res.status(403).json({
          message: "Visitor not approved",
        });
      }

      if (visitor.status === "IN") {
        return res.status(409).json({
          message: "Visitor already checked in",
        });
      }

      if (visitor.qrExpiresAt < new Date()) {
        return res.status(400).json({ message: "QR expired" });
      }

      visitor.status = "IN";
      visitor.checkInTime = new Date();
      await visitor.save();

      /* 🔔 Gate-only socket */
      req.io?.to(`GATE_${visitor.gate}`).emit("visitor:checked-in", {
        visitorId: visitor.visitorId,
        name: visitor.name,
        gate: visitor.gate,
        time: visitor.checkInTime,
      });

      /* 🧾 Audit */
      AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: "VISITOR_CHECKED_IN",
        entity: "Visitor",
        entityId: visitor._id,
        ip: req.ip,
      }).catch(console.error);

      res.json(visitor);
    } catch (err) {
      console.error("CHECKIN ERROR:", err);
      res.status(500).json({ message: "Check-in failed" });
    }
  }
);

/* =========================================================
   CHECK-OUT VISITOR
========================================================= */
router.post(
  "/check-out/:id",
  requireAuth,
  requireRole("security"),
  async (req, res) => {
    try {
      const visitor = await Visitor.findById(req.params.id);

      if (!visitor) {
        return res.status(404).json({ message: "Visitor not found" });
      }

      if (visitor.gate !== req.user.gateId) {
        return res.status(403).json({
          message: "Visitor assigned to different gate",
        });
      }

      if (visitor.status !== "IN") {
        return res.status(400).json({
          message: "Visitor is not checked in",
        });
      }

      visitor.status = "OUT";
      visitor.checkOutTime = new Date();

      visitor.history.push({
        action: "CHECKED_OUT",
        by: req.user.id,
      });

      await visitor.save();

      req.io?.to(`GATE_${req.user.gateId}`).emit("visitor:checked-out", {
        visitorId: visitor.visitorId,
        name: visitor.name,
        at: visitor.checkOutTime,
      });

      res.json({ success: true, visitor });
    } catch (err) {
      console.error("CHECK-OUT ERROR:", err);
      res.status(500).json({ message: "Check-out failed" });
    }
  }
);

/* =========================================================
   TODAY STATS (Admin)
========================================================= */
router.get("/stats", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, inCount, outCount] = await Promise.all([
      Visitor.countDocuments({ createdAt: { $gte: today } }),
      Visitor.countDocuments({ status: "IN", createdAt: { $gte: today } }),
      Visitor.countDocuments({ status: "OUT", createdAt: { $gte: today } }),
    ]);

    res.json({
      today: total,
      checkedIn: inCount,
      checkedOut: outCount,
    });
  } catch {
    res.status(500).json({ message: "Stats fetch failed" });
  }
});

/* =========================================================
   APPROVE / REJECT VISITOR (Admin)
========================================================= */
router.post(
  "/approve/:id",
  requireAuth,
  requireRole("admin"),
  audit("VISITOR_APPROVED", "Visitor"),
  async (req, res) => {
    try {
      const { action, reason, faceImageBase64 } = req.body;

      if (!["APPROVED", "REJECTED"].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      const visitor = await Visitor.findById(req.params.id);
      if (!visitor) {
        return res.status(404).json({ message: "Visitor not found" });
      }

      visitor.status = action;

      /* 🔐 ONE-TIME FACE REFERENCE STORAGE */
      if (action === "APPROVED" && faceImageBase64) {
        visitor.face = {
          referenceHash: await hashFace(faceImageBase64),
          verified: false,
          lastVerifiedAt: null,
        };
      }

      if (action === "REJECTED") {
        visitor.rejectionReason = reason || "Not specified";
      }

      await visitor.save();
      res.locals.entityId = visitor._id;

      req.io?.emit("VISITOR_APPROVAL", visitor);
      res.json(visitor);
    } catch (err) {
      console.error("APPROVAL ERROR:", err);
      res.status(500).json({ message: "Approval failed" });
    }
  }
);

/* =========================================================
   QR SCAN (Gate)
========================================================= */
router.post("/scan", requireAuth, requireRole("security"), async (req, res) => {
  try {
    const { qr } = req.body;

    const payload = decryptQR(qr);

    if (!payload?.visitorId || !payload?.gateId) {
      return res.status(400).json({
        message: "Invalid QR code",
      });
    }

    /* 🔒 Gate mismatch from QR */
    if (payload.gateId !== req.user.gateId) {
      return res.status(403).json({
        message: "QR not valid for this gate",
      });
    }

    const visitor = await Visitor.findOne({
      visitorId: payload.visitorId,
    });

    if (!visitor) {
      return res.status(404).json({
        message: "Visitor not found",
      });
    }

    /* 🔒 Visitor gate enforcement */
    if (visitor.gate !== req.user.gateId) {
      return res.status(403).json({
        message: "Visitor assigned to different gate",
      });
    }

    if (visitor.status !== "APPROVED") {
      return res.status(400).json({
        message: `Visitor status is ${visitor.status}`,
      });
    }

    if (visitor.qrExpiresAt < new Date()) {
      return res.status(400).json({
        message: "QR expired",
      });
    }

    /* Emit gate-specific event */
    req.io?.to(`GATE_${req.user.gateId}`).emit("visitor:scanned", {
      visitorId: visitor.visitorId,
      name: visitor.name,
      gate: visitor.gate,
      scannedAt: new Date(),
    });

    res.json({ success: true, visitor });
  } catch (err) {
    console.error("QR SCAN ERROR:", err);
    res.status(500).json({ message: "Scan failed" });
  }
});

/* =====================================================
   3️⃣ CHECK-IN — SECURITY (GATE + FACE LOCKED)
===================================================== */
router.post(
  "/check-in/:id",
  requireAuth,
  requireRole("security"),
  async (req, res) => {
    try {
      const visitor = await Visitor.findById(req.params.id);

      if (!visitor) {
        return res.status(404).json({
          message: "Visitor not found",
        });
      }

      /* 🔒 Gate enforcement */
      if (visitor.gate !== req.user.gateId) {
        return res.status(403).json({
          message: "Visitor assigned to different gate",
        });
      }

      if (visitor.status !== "APPROVED") {
        return res.status(400).json({
          message: `Cannot check-in. Status: ${visitor.status}`,
        });
      }

      /* 🔐 Face verification enforcement */
      if (!visitor.face?.verified) {
        return res.status(403).json({
          message: "Face verification required",
        });
      }

      visitor.status = "IN";
      visitor.checkInTime = new Date();
      visitor.securityUser = req.user.id;

      visitor.history.push({
        action: "CHECKED_IN",
        by: req.user.id,
      });

      await visitor.save();

      req.io?.to(`GATE_${req.user.gateId}`).emit("visitor:checked-in", {
        visitorId: visitor.visitorId,
        name: visitor.name,
        gate: visitor.gate,
        at: visitor.checkInTime,
      });

      res.json({ success: true, visitor });
    } catch (err) {
      console.error("CHECK-IN ERROR:", err);
      res.status(500).json({ message: "Check-in failed" });
    }
  }
);

/* =========================================================
   FACE VERIFICATION (Security)
========================================================= */
router.post(
  "/verify-face",
  requireAuth,
  requireRole("security"),
  async (req, res) => {
    try {
      const { visitorId, faceImageBase64 } = req.body;

      if (!visitorId || !faceImageBase64) {
        return res.status(400).json({ message: "Missing data" });
      }

      const visitor = await Visitor.findOne({ visitorId });
      if (!visitor || !visitor.face?.referenceHash) {
        return res.status(404).json({ message: "Face reference not found" });
      }

      const liveHash = await hashFace(faceImageBase64);
      const match = compareFace(liveHash, visitor.face.referenceHash);

      visitor.face.attempts += 1;

      if (match) {
        visitor.face.verified = true;
        visitor.face.lastVerifiedAt = new Date();
      }

      await visitor.save();

      AuditLog.create({
        actorId: req.user._id,
        actorRole: "security",
        action: match ? "FACE_VERIFIED" : "FACE_MISMATCH",
        entity: "Visitor",
        entityId: visitor._id,
        meta: { attempts: visitor.face.attempts },
        ip: req.ip,
      });

      req.io?.emit("FACE_VERIFICATION", {
        visitorId,
        verified: match,
      });

      res.json({ verified: match });
    } catch (err) {
      console.error("FACE VERIFY ERROR:", err);
      res.status(500).json({ message: "Verification failed" });
    }
  }
);

/* =========================================================
   BADGE PDF
========================================================= */
router.get("/badge/:id", async (req, res) => {
  const visitor = await Visitor.findById(req.params.id);
  generateBadge(visitor, res);
});

export default router;
