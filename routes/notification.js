/**
 * NOTIFICATION ROUTES
 * File: backend/routes/notification.js
 */

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";

const router = express.Router();

/**
 * GET /api/notification
 * Get notifications for the logged-in user
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { limit = 50, unreadOnly } = req.query;

    const filter = { recipientId: req.user._id };
    if (unreadOnly === "true") filter.read = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ recipientId: req.user._id, read: false });

    res.json({ success: true, data: notifications, notifications, unreadCount });
  } catch (err) {
    console.error("❌ Get notifications error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

/**
 * GET /api/notification/role/:role
 * Get notifications by role (for admin/security dashboards)
 */
router.get("/role/:role", requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.getByRole(req.params.role);
    res.json({ success: true, data: notifications, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

/**
 * PATCH /api/notification/:id/read
 * Mark a single notification as read
 */
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update notification" });
  }
});

/**
 * PATCH /api/notification/mark-all-read
 * Mark all notifications as read for current user
 */
router.patch("/mark-all-read", requireAuth, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user._id);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark notifications as read" });
  }
});

/**
 * DELETE /api/notification/:id
 * Delete a notification
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipientId: req.user._id });
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
});

export default router;