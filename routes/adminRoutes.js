  // backend/routes/adminRoutes.js
  import express from "express";
  import bcrypt from "bcrypt";
  import User from "../models/User.js";
  import { requireAuth, requireRole } from "../middleware/auth.js";

  const router = express.Router();

  // All admin routes require auth + superadmin role
  router.use(requireAuth);
  router.use(requireRole("superadmin"));

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/admin/users
  // List all users (excluding superadmins and passwords)
  // ═══════════════════════════════════════════════════════════════════════════
  router.get("/users", async (req, res) => {
    try {
      const users = await User.find({ role: { $ne: "superadmin" } })
        .select("-password -otp -otpExpiry")
        .sort({ createdAt: -1 });

      res.json({ success: true, data: users });
    } catch (error) {
      console.error("❌ Get users error:", error.message);
      res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/admin/users
  // Create a new user
  // ═══════════════════════════════════════════════════════════════════════════
  router.post("/users", async (req, res) => {
    try {
      const { name, email, phone, password, role, department, gateId, isActive } = req.body;

      // Validation
      if (!name?.trim() || !email?.trim() || !password?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name, email, and password are required",
        });
      }

      if (!["admin", "security", "reception"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role. Must be admin, security, or reception",
        });
      }

      if (role === "security" && !gateId) {
        return res.status(400).json({
          success: false,
          message: "Gate assignment is required for security personnel",
        });
      }

      if (role === "admin" && !department) {
        return res.status(400).json({
          success: false,
          message: "Department is required for admin users",
        });
      }

      // Check duplicate email
      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Email already registered",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || "",
        password: hashedPassword,
        role,
        department: role === "admin" ? department : undefined,
        gateId: role === "security" ? gateId : undefined,
        isActive: isActive !== false,
        isVerified: true, // Admin-created users are pre-verified
      });

      await user.save();

      console.log(`✅ User created by superadmin: ${email} (${role})`);

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          department: user.department,
          gateId: user.gateId,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error("❌ Create user error:", error.message);
      res.status(500).json({ success: false, message: "Failed to create user" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PUT /api/admin/users/:id
  // Update a user
  // ═══════════════════════════════════════════════════════════════════════════
  router.put("/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, department, gateId, isActive } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Prevent editing superadmins
      if (user.role === "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Cannot modify superadmin accounts",
        });
      }

      // Check email collision if email is being changed
      if (email && email.toLowerCase().trim() !== user.email) {
        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: "Email already in use",
          });
        }
        user.email = email.toLowerCase().trim();
      }

      if (name?.trim()) user.name = name.trim();
      if (phone !== undefined) user.phone = phone?.trim() || "";
      if (department !== undefined) user.department = department;
      if (gateId !== undefined) user.gateId = gateId;
      if (isActive !== undefined) user.isActive = isActive;

      await user.save();

      console.log(`✅ User updated: ${user.email}`);

      res.json({
        success: true,
        message: "User updated successfully",
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          department: user.department,
          gateId: user.gateId,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error("❌ Update user error:", error.message);
      res.status(500).json({ success: false, message: "Failed to update user" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE /api/admin/users/:id
  // Delete a user
  // ═══════════════════════════════════════════════════════════════════════════
  router.delete("/users/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if (user.role === "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Cannot delete superadmin accounts",
        });
      }

      // Prevent self-deletion
      if (user._id.toString() === req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Cannot delete your own account",
        });
      }

      await User.findByIdAndDelete(id);

      console.log(`✅ User deleted: ${user.email}`);

      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("❌ Delete user error:", error.message);
      res.status(500).json({ success: false, message: "Failed to delete user" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /api/admin/users/:id/toggle-status
  // Toggle user active/inactive
  // ═══════════════════════════════════════════════════════════════════════════
  router.patch("/users/:id/toggle-status", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if (user.role === "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Cannot modify superadmin accounts",
        });
      }

      user.isActive = isActive !== undefined ? isActive : !user.isActive;
      await user.save();

      console.log(`✅ User status toggled: ${user.email} → ${user.isActive}`);

      res.json({
        success: true,
        message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
        data: { _id: user._id, isActive: user.isActive },
      });
    } catch (error) {
      console.error("❌ Toggle status error:", error.message);
      res.status(500).json({ success: false, message: "Failed to toggle user status" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/admin/departments
  // List departments (static — extend with a DB model if needed)
  // ═══════════════════════════════════════════════════════════════════════════
  router.get("/departments", async (req, res) => {
    try {
      // Derive departments from existing users + built-in defaults
      const usersWithDept = await User.find({ department: { $exists: true, $ne: "" } })
        .select("department")
        .distinct("department");

      const defaults = ["Engineering", "Human Resources", "Sales", "Marketing", "Operations", "Finance"];
      const all = [...new Set([...defaults, ...usersWithDept])];

      const departments = all.map((name, i) => ({
        _id: String(i + 1),
        name,
        code: name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase(),
      }));

      res.json({ success: true, data: departments });
    } catch (error) {
      console.error("❌ Get departments error:", error.message);
      res.status(500).json({ success: false, message: "Failed to fetch departments" });
    }
  });

  export default router;

