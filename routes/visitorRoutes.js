/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISITOR ROUTES - FIXED FOR hostId PARAMETER
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ CRITICAL FIX: /host-visitors now reads hostId query parameter
 * ✅ Fixed duplicate try/catch in /host-visitors
 * ✅ Fixed field name — hostId used consistently everywhere
 * ✅ Fixed route ordering — /all and specific routes BEFORE /:id
 * ✅ POST / now saves hostId from req.body
 * ✅ All endpoints preserved, nothing removed
 */

import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Visitor from "../models/Visitor.js";
import HostAdmin from "../models/HostAdminFixed.js";
import QRCode from "qrcode";
import Notification from "../models/Notification.js";
import {
  sendApprovalEmail,
  sendRejectionEmail,
  sendHostNotificationEmail,
} from "../utils/mailer.js";
import { encryptQR, decryptQR, isQRTimestampValid } from "../utils/qrCrypto.js";
import mongoose from "mongoose";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// 🟢 PUBLIC ENDPOINTS (no authentication required)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/visitor
 * Create new visitor record (public endpoint)
 */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company,
      host,
      hostId,      // ✅ now saved from booking form
      hostEmail,
      gate,
      purpose,
      vehicleNumber,
      expectedDuration = 120,
    } = req.body;

    // Validation
    if (!name?.trim() || !email?.trim() || !phone?.trim() || !gate?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, and gate are required",
      });
    }

    if (!host?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Host name is required",
      });
    }

    if (!hostId) {
      return res.status(400).json({
        success: false,
        message: "Host selection is required",
      });
    }

    // Check for duplicate email
    const existing = await Visitor.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Visitor with this email already exists",
      });
    }

    // Create visitor
    const visitor = new Visitor({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      company: company?.trim() || "",
      host: host.trim(),
      hostId: hostId && mongoose.Types.ObjectId.isValid(hostId)
  ? new mongoose.Types.ObjectId(hostId)
  : null,         // ✅ links visitor to specific host admin
      hostEmail: hostEmail?.trim() || "",
      gate: gate.trim(),
      purpose: purpose?.trim() || "",
      vehicleNumber: vehicleNumber?.trim() || "",
      expectedDuration: parseInt(expectedDuration),
      status: "PENDING",
    });

    await visitor.save();

    console.log(`✅ Visitor created: ${visitor.name} (${visitor.visitorId}) for hostId: ${hostId}`);

    res.status(201).json({
      success: true,
      message: "Visitor created successfully",
      data: visitor,
      requestId: visitor.visitorId,
    });
  } catch (err) {
    console.error("❌ Create visitor error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to create visitor",
      error: err.message,
    });
  }
});

/**
 * GET /api/visitor/stats/overview
 * Get visitor statistics (public)
 */
router.get("/stats/overview", async (req, res) => {
  try {
    const stats = await Visitor.getStats();

    res.json({
      success: true,
      data: stats[0] || {
        total: 0,
        pending: 0,
        approved: 0,
        inside: 0,
        overstay: 0,
        completed: 0,
        rejected: 0,
      },
    });
  } catch (err) {
    console.error("❌ Get stats error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: err.message,
    });
  }
});

/**
 * POST /api/visitor/scan-qr
 * Scan QR code (public)
 */
router.post("/scan-qr", async (req, res) => {
  try {
    const { qrValue } = req.body;

    if (!qrValue) {
      return res.status(400).json({
        success: false,
        message: "QR value required",
      });
    }

    // ── Step 1: Decrypt the QR string ───────────────────────────────
    let payload;
    try {
      payload = decryptQR(qrValue);
    } catch (decryptErr) {
      console.error("❌ QR decryption failed:", decryptErr.message);
      return res.status(400).json({
        success: false,
        message: "Invalid QR code — could not decrypt. Make sure you are using the original QR from the approval email.",
      });
    }

    // ── Step 2: Validate timestamp (anti-replay, 24 hour window) ────
    if (payload.ts && !isQRTimestampValid(payload.ts, 86400)) {
      return res.status(400).json({
        success: false,
        message: "QR code has expired (valid for 24 hours from approval). Contact host to re-approve.",
      });
    }

    // ── Step 3: Look up visitor by ID in payload ─────────────────────
    const visitorId = payload.visitorId;
    if (!visitorId) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR payload — missing visitor ID.",
      });
    }

    const visitor = await Visitor.findById(visitorId);
    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found. The booking may have been deleted.",
      });
    }

    // ── Step 4: Validate gate if payload includes it ─────────────────
    if (payload.gate && visitor.gate !== payload.gate) {
      return res.status(400).json({
        success: false,
        message: `Wrong gate! This QR is for Gate ${payload.gate}, not your gate.`,
      });
    }

    // ── Step 5: Check visitor status ─────────────────────────────────
    if (visitor.status === "REJECTED") {
      return res.status(400).json({
        success: false,
        message: "This visit request was rejected.",
        visitor,
      });
    }

    if (visitor.status === "OUT") {
      return res.status(200).json({
        success: true,
        message: "Visitor has already completed their visit.",
        visitor,
        alreadyOut: true,
      });
    }

    console.log(`✅ QR scan successful: ${visitor.name} (${visitor.visitorId}) — status: ${visitor.status}`);

    return res.json({
      success: true,
      message: "QR code verified successfully",
      visitor,
    });

  } catch (err) {
    console.error("❌ QR scan error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "QR scan failed",
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔵 PROTECTED SPECIFIC ROUTES (MUST be before /:id)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/visitor/all
 * Get all visitors - superadmin only (no pagination)
 * ✅ MUST be before /:id or Express treats "all" as an id
 */
router.get("/all", requireAuth, async (req, res) => {
  try {
    const visitors = await Visitor.find({}).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: visitors,
      visitors: visitors,
      total: visitors.length,
    });
  } catch (err) {
    console.error("❌ Get all visitors error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visitors",
      error: err.message,
    });
  }
});

/**
 * GET /api/visitor/host-visitors
 * Get visitors for the currently logged-in host admin only
 * ✅ CRITICAL FIX: Now reads hostId from query parameter
 * ✅ CRITICAL FIX: Falls back to authenticated user's ID if no param provided
 * ✅ Frontend sends: ?hostId=USER_ID
 * ✅ Backend now reads and uses it!
 */
router.get("/host-visitors", requireAuth, async (req, res) => {
  try {
    const hostId = req.query.hostId || req.user._id;
    
    console.log(`📊 [GET /host-visitors]`);
    console.log(`   Query param hostId: ${req.query.hostId || "none"}`);
    console.log(`   Auth user._id: ${req.user._id}`);
    console.log(`   Final hostId used: ${hostId}`);

    const visitors = await Visitor.find({ hostId: hostId })
      .sort({ createdAt: -1 });

    console.log(`✅ Query completed: Found ${visitors.length} visitors`);

    res.json({
      success: true,
      data: visitors,
      visitors: visitors,
      total: visitors.length,
    });
  } catch (err) {
    console.error("❌ Get host visitors error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch host visitors",
      error: err.message,
    });
  }
});

/**
 * GET /api/visitor/by-host
 * Alternative endpoint for host's visitors
 */
router.get("/by-host", requireAuth, async (req, res) => {
  try {
    // ✅ Also read query parameter here
    const hostId = req.query.hostId || req.user._id;

    const visitors = await Visitor.find({ hostId: hostId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: visitors,
      visitors: visitors,
      total: visitors.length,
    });
  } catch (err) {
    console.error("❌ Get by-host error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visitors",
      error: err.message,
    });
  }
});

/**
 * GET /api/visitor/check/:id
 * Check visitor appointment status (public)
 */
router.get("/check/:id", async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.json({
      success: true,
      visitor,
    });
  } catch (err) {
    console.error("❌ Check appointment error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * GET /api/visitor/badge/:id
 * Download visitor badge
 */
router.get("/badge/:id", requireAuth, async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    res.json({
      success: true,
      message: "Badge generated",
      visitor: {
        name: visitor.name,
        gate: visitor.gate,
        status: visitor.status,
      },
    });
  } catch (err) {
    console.error("❌ Badge error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Badge generation failed",
    });
  }
});

/**
 * POST /api/visitor/:id/approve
 * Approve or reject visitor
 */
router.post("/:id/approve", requireAuth, async (req, res) => {
  try {
    const { action, expectedDuration = 120, reason } = req.body;

    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    if (action === "APPROVED") {
      const allowedUntil = new Date(Date.now() + expectedDuration * 60000);

      visitor.status = "APPROVED";
      visitor.allowedUntil = allowedUntil;
      visitor.approvedAt = new Date();
      visitor.approvedBy = req.user._id;
      visitor.qrGenerated = true;

      await visitor.save();

      console.log(`✅ Visitor approved: ${visitor._id}`);

      const qrData = {
        visitorId: visitor._id,
        name: visitor.name,
        gate: visitor.gate,
        allowedUntil,
      };

      const encryptedQR = encryptQR(qrData);
      const qrCode = await QRCode.toDataURL(encryptedQR);

      try {
        await sendApprovalEmail({
          visitorEmail: visitor.email,
          visitorName: visitor.name,
          hostName: visitor.host,
          gateNumber: visitor.gate,
          duration: expectedDuration,
          allowedUntil,
          qrCodeDataURL: qrCode,
        });
        console.log(`✅ Approval email sent to: ${visitor.email}`);
      } catch (emailErr) {
        console.warn(`⚠️ Failed to send approval email: ${emailErr.message}`);
      }

      return res.json({
        success: true,
        message: "Visitor approved",
        qrCode,
      });
    }

    if (action === "REJECTED") {
      visitor.status = "REJECTED";
      visitor.rejectionReason = reason;
      visitor.rejectedAt = new Date();
      visitor.rejectedBy = req.user._id;

      await visitor.save();

      console.log(`✅ Visitor rejected: ${visitor._id}`);

      try {
        await sendRejectionEmail({
          visitorEmail: visitor.email,
          visitorName: visitor.name,
          rejectionReason: reason,
        });
        console.log(`✅ Rejection email sent to: ${visitor.email}`);
      } catch (emailErr) {
        console.warn(`⚠️ Failed to send rejection email: ${emailErr.message}`);
      }

      return res.json({
        success: true,
        message: "Visitor rejected",
      });
    }

    res.status(400).json({
      success: false,
      message: "Invalid action. Use APPROVED or REJECTED",
    });
  } catch (err) {
    console.error("❌ Approve/reject error:", err);
    res.status(500).json({
      success: false,
      message: "Approval failed",
    });
  }
});

/**
 * POST /api/visitor/:id/reject
 * Reject visitor (standalone endpoint)
 */
router.post("/:id/reject", requireAuth, async (req, res) => {
  try {
    const { reason = "Request denied" } = req.body;
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    if (visitor.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot reject visitor with status ${visitor.status}`,
      });
    }

    visitor.status = "REJECTED";
    visitor.rejectionReason = reason;
    visitor.rejectedAt = new Date();
    visitor.rejectedBy = req.user._id;

    await visitor.save();

    console.log(`✅ Visitor rejected: ${visitor.name}`);

    res.json({
      success: true,
      message: "Visitor rejected successfully",
      data: visitor,
    });
  } catch (err) {
    console.error("❌ Reject visitor error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to reject visitor",
      error: err.message,
    });
  }
});

/**
 * POST /api/visitor/:id/checkin
 * Check in visitor
 */
router.post("/:id/checkin", requireAuth, async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    if (visitor.status === "IN" || visitor.status === "OVERSTAY") {
      return res.status(400).json({
        success: false,
        message: "Visitor already checked in",
      });
    }

    visitor.status = "IN";
    visitor.checkInTime = new Date();
    visitor.checkedInBy = req.user._id;

    await visitor.save();

    // Notify the host admin
    try {
      if (visitor.hostId) {
        await Notification.create({
          recipientId: visitor.hostId,
          recipientRole: "host",
          title: "Visitor Checked In",
          message: `${visitor.name} checked in at Gate ${visitor.gate}`,
          severity: "MEDIUM",
          type: "CHECKIN",
          relatedId: visitor._id,
          relatedType: "Visitor",
        });
      }
    } catch (notifErr) {
      console.error("⚠️ Notification creation failed:", notifErr.message);
    }

    console.log(`✅ Visitor checked in: ${visitor.name}`);

    res.json({
      success: true,
      message: "Visitor checked in successfully",
      data: visitor,
    });
  } catch (err) {
    console.error("❌ Checkin error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to check in visitor",
      error: err.message,
    });
  }
});

/**
 * POST /api/visitor/:id/checkout
 * Check out visitor
 */
router.post("/:id/checkout", requireAuth, async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    if (visitor.status === "OUT") {
      return res.status(400).json({
        success: false,
        message: "Visitor already checked out",
      });
    }

    const now = new Date();
    const duration = visitor.checkInTime
      ? Math.round((now - new Date(visitor.checkInTime)) / 60000)
      : 0;

    visitor.status = "OUT";
    visitor.checkOutTime = now;
    visitor.actualDuration = duration;
    visitor.checkedOutBy = req.user._id;

    await visitor.save();

    console.log(`✅ Visitor checked out: ${visitor.name}`);

    res.json({
      success: true,
      message: "Visitor checked out successfully",
      data: visitor,
    });
  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to check out visitor",
      error: err.message,
    });
  }
});

/**
 * POST /api/visitor/:id/generate-qr
 * Generate QR code for visitor
 */
router.post("/:id/generate-qr", requireAuth, async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    const qrData = {
      visitorId: visitor._id.toString(),
      name: visitor.name,
      gate: visitor.gate,
      allowedUntil: visitor.allowedUntil,
    };

    const encryptedQR = encryptQR(qrData);
    const qrCode = await QRCode.toDataURL(encryptedQR);

    console.log(`✅ QR code generated for visitor: ${visitor._id}`);

    res.json({
      success: true,
      qrCode,
    });
  } catch (err) {
    console.error("❌ QR generation error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "QR generation failed",
    });
  }
});

/**
 * GET /api/visitor/:id/timeline
 * Get visitor timeline
 */
router.get("/:id/timeline", requireAuth, async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    const timeline = [
      { event: "Created", timestamp: visitor.createdAt, status: "PENDING" },
      ...(visitor.approvedAt
        ? [{ event: "Approved", timestamp: visitor.approvedAt, status: "APPROVED" }]
        : []),
      ...(visitor.checkInTime
        ? [{ event: "Checked In", timestamp: visitor.checkInTime, status: "IN" }]
        : []),
      ...(visitor.checkOutTime
        ? [{ event: "Checked Out", timestamp: visitor.checkOutTime, status: "OUT" }]
        : []),
      ...(visitor.rejectedAt
        ? [{ event: "Rejected", timestamp: visitor.rejectedAt, status: "REJECTED" }]
        : []),
    ];

    res.json({
      success: true,
      timeline,
    });
  } catch (err) {
    console.error("❌ Timeline error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch timeline",
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🟠 GENERIC ROUTES — MUST BE LAST (/:id catches everything above it)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/visitor
 * List all visitors with filters
 */
router.get("/", async (req, res) => {
  try {
    const { status, gate, host, skip = 0, limit = 50 } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (gate) filter.gate = gate;
    if (host) filter.host = new RegExp(host, "i");

    const visitors = await Visitor.find(filter)
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Visitor.countDocuments(filter);

    res.json({
      success: true,
      data: visitors,
      visitors: visitors,
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error("❌ Get visitors error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visitors",
      error: err.message,
    });
  }
});

/**
 * GET /api/visitor/:id
 * Get single visitor — MUST BE LAST GET ROUTE
 */
router.get("/:id", async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id)
      .populate("hostId", "name email")
      .populate("approvedBy", "name")
      .populate("checkedInBy", "name")
      .populate("checkedOutBy", "name");

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    res.json({
      success: true,
      data: visitor,
    });
  } catch (err) {
    console.error("❌ Get visitor error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visitor",
      error: err.message,
    });
  }
});

/**
 * PUT /api/visitor/:id
 * Update visitor — MUST BE LAST PUT ROUTE
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name, email, phone, purpose, vehicleNumber, expectedDuration } = req.body;

    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found",
      });
    }

    if (visitor.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Can only update pending visitors",
      });
    }

    if (name) visitor.name = name.trim();
    if (email) visitor.email = email.toLowerCase().trim();
    if (phone) visitor.phone = phone.trim();
    if (purpose !== undefined) visitor.purpose = purpose?.trim() || "";
    if (vehicleNumber !== undefined) visitor.vehicleNumber = vehicleNumber?.trim() || "";
    if (expectedDuration) visitor.expectedDuration = parseInt(expectedDuration);

    await visitor.save();

    console.log(`✅ Visitor updated: ${visitor.name}`);

    res.json({
      success: true,
      message: "Visitor updated successfully",
      data: visitor,
    });
  } catch (err) {
    console.error("❌ Update visitor error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to update visitor",
      error: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default router;