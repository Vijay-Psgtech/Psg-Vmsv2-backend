/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALERT ROUTES - COMPLETE
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ GET endpoints for listing and filtering alerts
 * ✅ PATCH endpoints for acknowledging and resolving alerts
 * ✅ Proper authentication and filtering
 */

import express from "express";
import Alert from "../models/Alert.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/alert - List alerts with filtering
// ═══════════════════════════════════════════════════════════════════════════
router.get("/", requireAuth, async (req, res) => {
  try {
    const {
      status = "ACTIVE",
      severity,
      gate,
      type,
      skip = 0,
      limit = 50,
    } = req.query;

    let filter = {};
    if (status !== "ALL") {
      filter.status = status;
    }
    if (severity) filter.severity = severity;
    if (gate) filter.gate = gate;
    if (type) filter.type = type;

    const alerts = await Alert.find(filter)
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate("visitor", "name email phone")
      .populate("acknowledgedBy", "name")
      .populate("resolvedBy", "name");

    const total = await Alert.countDocuments(filter);

    console.log(`✅ Alerts loaded: ${alerts.length} (status: ${status})`);

    res.json({
      success: true,
      data: alerts,
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error("❌ Get alerts error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts",
      error: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/alert/:id - Get single alert
// ═══════════════════════════════════════════════════════════════════════════
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate("visitor", "name email phone")
      .populate("acknowledgedBy", "name")
      .populate("resolvedBy", "name");

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (err) {
    console.error("❌ Get alert error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alert",
      error: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/alert/:id/acknowledge - Acknowledge alert
// ═══════════════════════════════════════════════════════════════════════════
router.patch("/:id/acknowledge", requireAuth, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    if (alert.status === "RESOLVED") {
      return res.status(400).json({
        success: false,
        message: "Cannot acknowledge resolved alert",
      });
    }

    alert.status = "ACKNOWLEDGED";
    alert.acknowledgedBy = req.user._id;
    alert.acknowledgedAt = new Date();

    await alert.save();

    console.log(`✅ Alert acknowledged: ${alert._id}`);

    res.json({
      success: true,
      message: "Alert acknowledged",
      data: alert,
    });
  } catch (err) {
    console.error("❌ Acknowledge alert error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to acknowledge alert",
      error: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/alert/:id/resolve - Resolve alert
// ═══════════════════════════════════════════════════════════════════════════
router.patch("/:id/resolve", requireAuth, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    alert.status = "RESOLVED";
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();

    await alert.save();

    console.log(`✅ Alert resolved: ${alert._id}`);

    res.json({
      success: true,
      message: "Alert resolved",
      data: alert,
    });
  } catch (err) {
    console.error("❌ Resolve alert error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to resolve alert",
      error: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/alert/stats - Get alert statistics
// ═══════════════════════════════════════════════════════════════════════════
router.get("/stats/overview", requireAuth, async (req, res) => {
  try {
    const total = await Alert.countDocuments();
    const active = await Alert.countDocuments({ status: "ACTIVE" });
    const acknowledged = await Alert.countDocuments({
      status: "ACKNOWLEDGED",
    });
    const resolved = await Alert.countDocuments({ status: "RESOLVED" });

    const bySeverity = await Alert.aggregate([
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]);

    const byType = await Alert.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        acknowledged,
        resolved,
        bySeverity: Object.fromEntries(
          bySeverity.map((s) => [s._id, s.count])
        ),
        byType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
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

export default router;