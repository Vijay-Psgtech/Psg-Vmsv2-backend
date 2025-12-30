import express from "express";
import Alert from "../models/Alert.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/* GET ALERTS */
router.get("/", requireAuth, async (req, res) => {
  try {
    let query = { isRead: false };

    // Security only sees their gate alerts
    if (req.user.role === "security" && req.user.gateId) {
      query.gate = String(req.user.gateId);
    }

    const alerts = await Alert.find(query)
      .populate("visitor", "name visitorId gate phone host")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(alerts);
  } catch (err) {
    console.error("GET ALERTS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch alerts" });
  }
});

/* MARK AS READ */
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        isRead: true,
        readBy: req.user.id,
        readAt: new Date(),
      },
      { new: true }
    );

    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: "Failed to update alert" });
  }
});

/* CREATE ALERT (Admin) */
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const alert = await Alert.create(req.body);
    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ message: "Failed to create alert" });
  }
});

export default router;