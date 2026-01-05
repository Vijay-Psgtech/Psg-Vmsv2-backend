import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Visitor from "../models/Visitor.js";
import Departments from "../models/Departments.js";
import Host from "../models/Host.js";
import Gate from "../models/Gate.js";
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

/* =========================================================
   User Management (Admin)
========================================================= */

router.get('/users', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/userSave', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { name, email, phone, password, role, isActive, department }  = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      phone,
      password: hashPassword,
      role,
      isActive: isActive !== undefined ? isActive : true,
      department,
    });

    await newUser.save();
    
    res.json({ message: 'User created successfully', user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role } });

  } catch (err) {
    console.error('User save error:', err);
    res.status(500).json({ error: 'Failed to save user' });
  }
});

router.put('/userUpdate/:id', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, phone, email, department } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone, email, department },
      { new: true }
    );

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('userDelete/:id', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByIdAndDelete(userId);
    if(!user) {
      return res.status(404).json({ error: "User not found" });

    }
    res.json({ message: "User deleted successfully" });
  }
  catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.patch('/userStatus/:id', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.isActive = isActive;
    await user.save();
  } catch (err) {
    console.error('User status update error:', err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

/* =========================================================
   Department Management (Admin)
========================================================= */

router.get('/departments', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const departments = await Departments.find();
    res.json(departments);
  } catch (err) {
    console.error('Fetch departments error:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/departmentSave', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const existingDepartment = await Departments.findOne({ code });
    if (existingDepartment) {
      return res.status(400).json({ error: 'Department code already in use' });
    }

    const newDepartment = new Departments({
      name,
      code,
      description
    });

    await newDepartment.save();

    res.json({ message: 'Department created successfully', department: newDepartment });
  } catch (err) {
    console.error('Department save error:', err);
    res.status(500).json({ error: 'Failed to save department' });
  }
});

router.put('/departmentUpdate/:id', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const departmentId = req.params.id;
    const { name, code, description } = req.body;

    const department = await Departments.findById(departmentId);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const updatedDepartment = await Departments.findByIdAndUpdate(
      departmentId,
      { name, code, description },
      { new: true }
    );

    res.json({ message: 'Department updated successfully', department: updatedDepartment });
  } catch (err) {
    console.error('Department update error:', err);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

router.delete('/departmentDelete/:id', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const departmentId = req.params.id;
    const department = await Departments.findByIdAndDelete(departmentId);
    if(!department) {
      return res.status(404).json({ error: "Department not found" });
      
    }
    res.json({ message: "Department deleted successfully" });
  }
  catch (err) {
    console.error('Department delete error:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

/* =========================================================
   Gate Management (Admin)
========================================================= */

router.get('/gates', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const gates = await Gate.find();
    res.json(gates);
  } catch (err) {
    console.error('Fetch gates error:', err);
    res.status(500).json({ error: 'Failed to fetch gates' });
  }
});

router.post('/gateSave', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const existingGate = await Gate.findOne({ code });
    if (existingGate) {
      return res.status(400).json({ error: 'Gate code already in use' });
    }

    const newGate = new Gate({
      name,
      code,
    });

    await newGate.save();

    res.json({ message: 'Gate created successfully', gate: newGate });
  } catch (err) {
    console.error('Gate save error:', err);
    res.status(500).json({ error: 'Failed to save gate' });
  }
});


export default router;