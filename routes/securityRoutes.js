import express from "express";
import Visitor from "../models/Visitor.js";
import AuditLog from "../models/AuditLog.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * SECURITY QR SCAN
 * POST /api/security/scan
 */
router.post(
  "/scan",
  requireAuth,
  requireRole(["security"]),
  async (req, res) => {
    try {
      const { visitorId } = req.body;
      if (!visitorId) {
        return res.status(400).json({ message: "visitorId required" });
      }

      const visitor = await Visitor.findById(visitorId);
      if (!visitor) {
        return res.status(404).json({ message: "Visitor not found" });
      }

      // QR expiry
      if (visitor.qrExpiresAt && visitor.qrExpiresAt < new Date()) {
        visitor.status = "EXPIRED";
        await visitor.save();
        return res.status(400).json({ message: "QR expired" });
      }

      // 🔁 AUTO IN / OUT
      if (visitor.status === "APPROVED" || visitor.status === "OUT") {
        visitor.status = "IN";
        visitor.checkInTime = new Date();
      } else if (visitor.status === "IN") {
        visitor.status = "OUT";
        visitor.checkOutTime = new Date();
      }

      visitor.lastScannedAt = new Date();
      await visitor.save();

      // 🔥 SOCKET EMIT
      req.io.to(`GATE_${visitor.gate}`).emit("SCAN_RESULT", {
        _id: visitor._id,
        name: visitor.name,
        company: visitor.company,
        purpose: visitor.purpose,
        confidence: visitor.confidence,
        qrExpiresAt: visitor.qrExpiresAt,
        status: visitor.status,
        checkInTime: visitor.checkInTime,
      });

      // Audit
      await AuditLog.create({
        actorId: req.user._id,
        actorRole: "security",
        action: "QR_SCANNED",
        entity: "Visitor",
        entityId: visitor._id,
      });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Scan failed" });
    }
  }
);

router.post(
  "/assign-gate",
  requireAuth,
  requireRole("security"),
  async (req, res) => {
    req.user.gateId = req.body.gateId;
    await req.user.save();
    res.json({ success: true });
  }
);

export default router;