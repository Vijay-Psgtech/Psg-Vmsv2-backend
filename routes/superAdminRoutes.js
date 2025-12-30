// routes/superAdminRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Visitor from "../models/Visitor.js";
import Alert from "../models/Alert.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   GET ALL USERS (Super Admin Only)
========================================================= */
router.get("/users", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/* =========================================================
   CREATE NEW USER (Super Admin Only)
========================================================= */
router.post("/users", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const { name, email, phone, password, role, department, gateId, isActive } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Role-specific validation
    if (role === "security" && !gateId) {
      return res.status(400).json({ message: "Gate ID required for security role" });
    }

    if (role === "admin" && !department) {
      return res.status(400).json({ message: "Department required for admin role" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      phone: phone || "",
      password: hashedPassword,
      role,
      department: department || "",
      gateId: gateId || "",
      isActive: isActive !== false,
      createdBy: req.user.id,
    });

    // Add to history
    user.history = user.history || [];
    user.history.push({
      action: "USER_CREATED",
      by: req.user.id,
      at: new Date(),
      note: `Created by ${req.user.name}`,
    });

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ message: "Failed to create user" });
  }
});

/* =========================================================
   UPDATE USER (Super Admin Only)
========================================================= */
router.put("/users/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const { name, email, phone, department, gateId, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (gateId !== undefined) user.gateId = gateId;
    if (isActive !== undefined) user.isActive = isActive;

    // Add to history
    user.history = user.history || [];
    user.history.push({
      action: "USER_UPDATED",
      by: req.user.id,
      at: new Date(),
      note: `Updated by ${req.user.name}`,
    });

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: "User updated successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
});

/* =========================================================
   DELETE USER (Super Admin Only)
========================================================= */
router.delete("/users/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    // Prevent deleting super admin
    if (user.role === "superadmin") {
      return res.status(403).json({ message: "Cannot delete super admin account" });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

/* =========================================================
   TOGGLE USER STATUS (Super Admin Only)
========================================================= */
router.patch(
  "/users/:id/toggle-status",
  requireAuth,
  requireRole("superadmin", "admin"),
  async (req, res) => {
    try {
      const { isActive } = req.body;

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.isActive = isActive;
      user.history = user.history || [];
      user.history.push({
        action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        by: req.user.id,
        at: new Date(),
        note: `Status changed by ${req.user.name}`,
      });

      await user.save();

      res.json({
        success: true,
        message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      });
    } catch (err) {
      console.error("Toggle status error:", err);
      res.status(500).json({ message: "Failed to toggle user status" });
    }
  }
);

/* =========================================================
   GET SYSTEM STATISTICS (Super Admin Only)
========================================================= */
router.get("/statistics", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      adminCount,
      securityCount,
      receptionCount,
      totalVisitors,
      pendingVisitors,
      approvedVisitors,
      insideVisitors,
      overstayVisitors,
      totalAlerts,
      criticalAlerts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "security" }),
      User.countDocuments({ role: "reception" }),
      Visitor.countDocuments(),
      Visitor.countDocuments({ status: "PENDING" }),
      Visitor.countDocuments({ status: "APPROVED" }),
      Visitor.countDocuments({ status: "IN" }),
      Visitor.countDocuments({ status: "OVERSTAY" }),
      Alert.countDocuments(),
      Alert.countDocuments({ severity: "CRITICAL" }),
    ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        admin: adminCount,
        security: securityCount,
        reception: receptionCount,
      },
      visitors: {
        total: totalVisitors,
        pending: pendingVisitors,
        approved: approvedVisitors,
        inside: insideVisitors,
        overstay: overstayVisitors,
      },
      alerts: {
        total: totalAlerts,
        critical: criticalAlerts,
      },
    });
  } catch (err) {
    console.error("Statistics error:", err);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
});

/* =========================================================
   GET DEPARTMENTS (Super Admin Only)
========================================================= */
router.get("/departments", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    // For now, return static departments
    // You can create a Department model later
    const departments = [
      { _id: "1", name: "Engineering", code: "ENG", description: "Engineering Department" },
      { _id: "2", name: "Human Resources", code: "HR", description: "HR Department" },
      { _id: "3", name: "Sales", code: "SALES", description: "Sales Department" },
      { _id: "4", name: "Marketing", code: "MKT", description: "Marketing Department" },
      { _id: "5", name: "Operations", code: "OPS", description: "Operations Department" },
      { _id: "6", name: "Finance", code: "FIN", description: "Finance Department" },
      { _id: "7", name: "IT Support", code: "IT", description: "IT Support Department" },
      { _id: "8", name: "Legal", code: "LEGAL", description: "Legal Department" },
    ];

    res.json(departments);
  } catch (err) {
    console.error("Get departments error:", err);
    res.status(500).json({ message: "Failed to fetch departments" });
  }
});

/* =========================================================
   GET ALL VISITORS (Super Admin Only)
========================================================= */
router.get("/visitors", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const visitors = await Visitor.find()
      .sort({ createdAt: -1 })
      .limit(1000);

    res.json(visitors);
  } catch (err) {
    console.error("Get visitors error:", err);
    res.status(500).json({ message: "Failed to fetch visitors" });
  }
});

/* =========================================================
   GET ALL ALERTS (Super Admin Only)
========================================================= */
router.get("/alerts", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const alerts = await Alert.find()
      .populate("visitor", "name visitorId")
      .sort({ createdAt: -1 })
      .limit(500);

    res.json(alerts);
  } catch (err) {
    console.error("Get alerts error:", err);
    res.status(500).json({ message: "Failed to fetch alerts" });
  }
});

/* =========================================================
   GET USER ACTIVITY LOG (Super Admin Only)
========================================================= */
router.get(
  "/users/:id/activity",
  requireAuth,
  requireRole("superadmin", "admin"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select("history");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user.history || []);
    } catch (err) {
      console.error("Get activity error:", err);
      res.status(500).json({ message: "Failed to fetch activity log" });
    }
  }
);

/* =========================================================
   RESET USER PASSWORD (Super Admin Only)
========================================================= */
router.patch(
  "/users/:id/reset-password",
  requireAuth,
  requireRole("superadmin"),
  async (req, res) => {
    try {
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password
      user.password = await bcrypt.hash(newPassword, 10);

      // Add to history
      user.history = user.history || [];
      user.history.push({
        action: "PASSWORD_RESET",
        by: req.user.id,
        at: new Date(),
        note: `Password reset by ${req.user.name}`,
      });

      await user.save();

      res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Failed to reset password" });
    }
  }
);

/* =========================================================
   BULK OPERATIONS (Super Admin Only)
========================================================= */
router.post(
  "/users/bulk-action",
  requireAuth,
  requireRole("superadmin"),
  async (req, res) => {
    try {
      const { action, userIds } = req.body;

      if (!action || !userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ message: "Invalid request" });
      }

      let result;

      switch (action) {
        case "activate":
          result = await User.updateMany(
            { _id: { $in: userIds } },
            { $set: { isActive: true } }
          );
          break;

        case "deactivate":
          result = await User.updateMany(
            { _id: { $in: userIds } },
            { $set: { isActive: false } }
          );
          break;

        case "delete":
          // Prevent deleting yourself
          const filteredIds = userIds.filter((id) => id !== req.user.id);
          result = await User.deleteMany({ _id: { $in: filteredIds } });
          break;

        default:
          return res.status(400).json({ message: "Invalid action" });
      }

      res.json({
        success: true,
        message: `Bulk ${action} completed`,
        affected: result.modifiedCount || result.deletedCount,
      });
    } catch (err) {
      console.error("Bulk action error:", err);
      res.status(500).json({ message: "Failed to perform bulk action" });
    }
  }
);

export default router;