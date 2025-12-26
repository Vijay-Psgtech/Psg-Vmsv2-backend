import express from "express";
import User from "../models/User.js";
import Visitor from "../models/Visitor.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   ASSIGN GATE TO SECURITY (Admin)
========================================================= */
router.post(
  "/assign-gate",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { userId, gateId } = req.body;

      if (!userId || !gateId) {
        return res
          .status(400)
          .json({ error: "userId and gateId required" });
      }

      const user = await User.findById(userId);

      if (!user || user.role !== "security") {
        return res.status(400).json({ error: "Invalid security user" });
      }

      user.gateId = gateId;
      await user.save();

      res.json({
        message: "Gate assigned successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          gateId: user.gateId,
        },
      });
    } catch (err) {
      console.error("Assign gate error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/* =========================================================
   GET SECURITY USERS (Admin)
========================================================= */
router.get(
  "/security-users",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const users = await User.find({ role: "security" }).select("-password");
      res.json(users);
    } catch (err) {
      console.error("Fetch security users error:", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);

/* =========================================================
   ANALYTICS (Admin)
========================================================= */
router.get(
  "/analytics",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = await Visitor.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
          $group: {
            _id: "$gateId",
            count: { $sum: 1 },
          },
        },
      ]);

      res.json(stats);
    } catch (err) {
      console.error("Analytics error:", err);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  }
);

export default router;

