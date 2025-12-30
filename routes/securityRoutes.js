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
  "/assign-gate",
  requireAuth,
  requireRole("security"),
  async (req, res) => {
    req.user.gateId = mongoose.Types.ObjectId(req.body.gateId);
    await req.user.save();
    res.json({ success: true });
  }
);

export default router;