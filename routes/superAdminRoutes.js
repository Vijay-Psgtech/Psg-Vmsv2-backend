/**
 * SUPER ADMIN ROUTES - PRODUCTION FIXED
 * File: backend/routes/superAdminRoutes.js
 *
 * FIXES APPLIED:
 * 1. Added GET /api/superadmin/hostadmins - SuperAdmin dashboard was fetching this
 * 2. Added POST /api/superadmin/hostadmins - create host admin from SuperAdmin dashboard
 * 3. Added DELETE /api/superadmin/hostadmins/:id
 * 4. Added PATCH /api/superadmin/hostadmins/:id/toggle-status
 * 5. Statistics endpoint now includes host admin count
 * 6. requireRole now accepts array properly
 */

import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import HostAdmin from "../models/HostAdminFixed.js";
import Visitor from "../models/Visitor.js";
import Alert from "../models/Alert.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes in this router
router.use(requireAuth);
router.use(requireRole(["superadmin", "admin"]));

// ═══════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("-password -otp -otpExpiry -twoFactorSecret -resetPasswordToken")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: users, users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { name, email, phone, password, role, department, gateId, isActive } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    if (role === "security" && !gateId) {
      return res.status(400).json({ success: false, message: "Gate ID required for security role" });
    }

    if (role === "admin" && !department) {
      return res.status(400).json({ success: false, message: "Department required for admin role" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || "",
      password: hashedPassword,
      role,
      department: department || "",
      gateId: gateId || null,
      isActive: isActive !== false,
      isVerified: true,
      createdBy: req.user._id,
    });

    user.addHistory("USER_CREATED", req.user._id, `Created by ${req.user.email}`);
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({ success: true, message: "User created successfully", data: userResponse, user: userResponse });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ success: false, message: "Failed to create user" });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { name, email, phone, department, gateId, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (phone !== undefined) user.phone = phone || "";
    if (department !== undefined) user.department = department;
    if (gateId !== undefined) user.gateId = gateId;
    if (isActive !== undefined) user.isActive = isActive;

    user.addHistory("USER_UPDATED", req.user._id, `Updated by ${req.user.email}`);
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ success: true, message: "User updated successfully", data: userResponse });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot delete your own account" });
    }

    if (user.role === "superadmin") {
      return res.status(403).json({ success: false, message: "Cannot delete superadmin account" });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

router.patch("/users/:id/toggle-status", async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.isActive = isActive !== undefined ? isActive : !user.isActive;
    user.addHistory(user.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", req.user._id, `Status changed by ${req.user.email}`);
    await user.save();

    res.json({ success: true, message: `User ${user.isActive ? "activated" : "deactivated"}`, data: { _id: user._id, isActive: user.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to toggle user status" });
  }
});

router.patch("/users/:id/reset-password", requireRole(["superadmin"]), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.addHistory("PASSWORD_RESET", req.user._id, `Password reset by ${req.user.email}`);
    await user.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reset password" });
  }
});

router.get("/users/:id/activity", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("history");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user.history || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch activity" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HOST ADMIN MANAGEMENT (from SuperAdmin dashboard)
// FIX: These routes were missing — SuperAdmin dashboard calls /superadmin/hostadmins
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/superadmin/hostadmins
 * List all host admins
 */
router.get("/hostadmins", async (req, res) => {
  try {
    const hostAdmins = await HostAdmin.find()
      .select("-password -otp -otpExpiry")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: hostAdmins, hostAdmins, total: hostAdmins.length });
  } catch (err) {
    console.error("Get host admins error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch host admins" });
  }
});

/**
 * POST /api/superadmin/hostadmins
 * Create a new host admin — this is the main creation endpoint for SuperAdmin dashboard
 * FIX: SuperAdmin dashboard was posting here but it didn't exist
 */
router.post("/hostadmins", async (req, res) => {
  try {
    const { name, email, phone, company, department, password } = req.body;

    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required", field: "name" });
    if (!email?.trim()) return res.status(400).json({ success: false, message: "Email is required", field: "email" });
    if (!phone?.trim()) return res.status(400).json({ success: false, message: "Phone is required", field: "phone" });
    if (!company?.trim()) return res.status(400).json({ success: false, message: "Company is required", field: "company" });

    const emailLower = email.toLowerCase().trim();

    // Check both User and HostAdmin collections
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already registered as a system user" });
    }

    const existingHost = await HostAdmin.findOne({ email: emailLower });
    if (existingHost) {
      return res.status(409).json({ success: false, message: "Host admin with this email already exists" });
    }

    const hostAdmin = new HostAdmin({
      name: name.trim(),
      email: emailLower,
      phone: phone.trim(),
      company: company.trim(),
      department: department?.trim() || "N/A",
      password: password || undefined,
      role: "hostadmin",
      active: true,
    });

    await hostAdmin.save();

    console.log(`✅ Host admin created by superadmin: ${hostAdmin.email}`);

    res.status(201).json({
      success: true,
      message: "Host admin created successfully",
      data: {
        _id: hostAdmin._id,
        name: hostAdmin.name,
        email: hostAdmin.email,
        phone: hostAdmin.phone,
        company: hostAdmin.company,
        department: hostAdmin.department,
        role: hostAdmin.role,
        active: hostAdmin.active,
        createdAt: hostAdmin.createdAt,
      },
    });
  } catch (err) {
    console.error("Create host admin error:", err.message);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to create host admin", error: err.message });
  }
});

/**
 * PUT /api/superadmin/hostadmins/:id
 */
router.put("/hostadmins/:id", async (req, res) => {
  try {
    const { name, phone, company, department, active } = req.body;

    const hostAdmin = await HostAdmin.findByIdAndUpdate(
      req.params.id,
      { name, phone, company, department, active },
      { new: true, runValidators: true }
    ).select("-password -otp -otpExpiry");

    if (!hostAdmin) return res.status(404).json({ success: false, message: "Host admin not found" });

    res.json({ success: true, message: "Host admin updated", data: hostAdmin });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update host admin" });
  }
});

/**
 * DELETE /api/superadmin/hostadmins/:id
 */
router.delete("/hostadmins/:id", async (req, res) => {
  try {
    const hostAdmin = await HostAdmin.findByIdAndDelete(req.params.id);
    if (!hostAdmin) return res.status(404).json({ success: false, message: "Host admin not found" });

    res.json({ success: true, message: "Host admin deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete host admin" });
  }
});

/**
 * PATCH /api/superadmin/hostadmins/:id/toggle-status
 */
router.patch("/hostadmins/:id/toggle-status", async (req, res) => {
  try {
    const { active } = req.body;
    const hostAdmin = await HostAdmin.findById(req.params.id);
    if (!hostAdmin) return res.status(404).json({ success: false, message: "Host admin not found" });

    hostAdmin.active = active !== undefined ? active : !hostAdmin.active;
    await hostAdmin.save();

    res.json({ success: true, message: `Host admin ${hostAdmin.active ? "activated" : "deactivated"}`, data: { _id: hostAdmin._id, active: hostAdmin.active } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to toggle status" });
  }
});

/**
 * PATCH /api/superadmin/hostadmins/:id/reset-password
 */
router.patch("/hostadmins/:id/reset-password", requireRole(["superadmin"]) , async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    
    const hostAdmin = await HostAdmin.findById(req.params.id);
    if (!hostAdmin) return res.status(404).json({ success: false, message: "Host admin not found" });

    hostAdmin.password = await bcrypt.hash(newPassword, 10);
    await hostAdmin.save();
    
    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reset password" });
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/statistics", async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      adminCount,
      securityCount,
      receptionCount,
      totalHostAdmins,
      activeHostAdmins,
      totalVisitors,
      pendingVisitors,
      approvedVisitors,
      insideVisitors,
      overstayVisitors,
      completedVisitors,
      rejectedVisitors,
      totalAlerts,
      criticalAlerts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "security" }),
      User.countDocuments({ role: "reception" }),
      HostAdmin.countDocuments(),
      HostAdmin.countDocuments({ active: true }),
      Visitor.countDocuments(),
      Visitor.countDocuments({ status: "PENDING" }),
      Visitor.countDocuments({ status: "APPROVED" }),
      Visitor.countDocuments({ status: "IN" }),
      Visitor.countDocuments({ status: "OVERSTAY" }),
      Visitor.countDocuments({ status: "OUT" }),
      Visitor.countDocuments({ status: "REJECTED" }),
      Alert.countDocuments(),
      Alert.countDocuments({ severity: "CRITICAL" }),
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers, admin: adminCount, security: securityCount, reception: receptionCount },
        hostAdmins: { total: totalHostAdmins, active: activeHostAdmins },
        visitors: { total: totalVisitors, pending: pendingVisitors, approved: approvedVisitors, inside: insideVisitors, overstay: overstayVisitors, completed: completedVisitors, rejected: rejectedVisitors },
        alerts: { total: totalAlerts, critical: criticalAlerts },
      },
    });
  } catch (err) {
    console.error("Statistics error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch statistics" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/departments", async (req, res) => {
  try {
    const dbDepts = await User.distinct("department", { department: { $exists: true, $ne: "" } });
    const defaults = ["Engineering", "Human Resources", "Sales", "Marketing", "Operations", "Finance", "IT Support", "Legal"];
    const all = [...new Set([...defaults, ...dbDepts])];
    const departments = all.map((name, i) => ({
      _id: String(i + 1),
      name,
      code: name.split(" ").map((w) => w[0]).join("").toUpperCase(),
    }));
    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch departments" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// VISITORS (for super admin view)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/visitors", async (req, res) => {
  try {
    const visitors = await Visitor.find().sort({ createdAt: -1 }).limit(1000);
    res.json({ success: true, data: visitors, visitors });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch visitors" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/alerts", async (req, res) => {
  try {
    const alerts = await Alert.find()
      .populate("visitor", "name visitorId")
      .sort({ createdAt: -1 })
      .limit(500);
    res.json({ success: true, data: alerts, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch alerts" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

router.post("/users/bulk-action", requireRole(["superadmin"]), async (req, res) => {
  try {
    const { action, userIds } = req.body;
    if (!action || !Array.isArray(userIds)) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    let result;
    if (action === "activate") {
      result = await User.updateMany({ _id: { $in: userIds } }, { $set: { isActive: true } });
    } else if (action === "deactivate") {
      result = await User.updateMany({ _id: { $in: userIds } }, { $set: { isActive: false } });
    } else if (action === "delete") {
      const filteredIds = userIds.filter((id) => id !== req.user._id.toString());
      result = await User.deleteMany({ _id: { $in: filteredIds }, role: { $ne: "superadmin" } });
    } else {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    res.json({ success: true, message: `Bulk ${action} completed`, affected: result.modifiedCount || result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to perform bulk action" });
  }
});

export default router;