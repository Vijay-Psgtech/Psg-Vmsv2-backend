import express from "express";
import Visitor from "../models/Visitor.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Add to watchlist
router.post(
  "/add/:id",
  requireAuth,
  requireRole(["admin", "reception"]),
  async (req, res) => {
    await Visitor.findByIdAndUpdate(req.params.id, { watchList: true });

    const updated = await Visitor.findById(req.params.id);
    req.io?.emit("visitor:update", updated);

    res.json({ success: true });
  }
);

// Remove from watchlist
router.post(
  "/remove/:id",
  requireAuth,
  requireRole(["admin", "reception"]),
  async (req, res) => {
    await Visitor.findByIdAndUpdate(req.params.id, { watchList: false });
    res.json({ success: true });
  }
);

// Block visitor
router.post(
  "/block/:id",
  requireAuth,
  requireRole(["admin", "reception"]),
  async (req, res) => {
    await Visitor.findByIdAndUpdate(req.params.id, { blocked: true });
    res.json({ success: true });
  }
);

// Unblock visitor
router.post(
  "/unblock/:id",
  requireAuth,
  requireRole(["admin", "reception"]),
  async (req, res) => {
    await Visitor.findByIdAndUpdate(req.params.id, { blocked: false });
    res.json({ success: true });
  }
);

export default router;
