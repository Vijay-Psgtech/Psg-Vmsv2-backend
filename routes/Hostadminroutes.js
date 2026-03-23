import express from "express";
import HostAdmin from "../models/HostAdminFixed.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE ORDER IS CRITICAL — specific routes MUST come before /:id
// Express matches top to bottom — once /:id matches, nothing below runs
// Order: GET / → GET /me → POST / → PUT /:id → DELETE /:id → GET /:id (last)
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. GET /api/hostadmin  ─────────────────────────────────────────────────
// PUBLIC — no auth, visitor booking portal uses this to list hosts
router.get("/", async (req, res) => {
  try {
    const hostAdmins = await HostAdmin.find({ active: true })
      .select("_id name email phone company department")
      .lean();

    console.log(`✅ GET /hostadmin — ${hostAdmins.length} hosts`);

    res.json({ success: true, data: hostAdmins, total: hostAdmins.length });
  } catch (err) {
    console.error("❌ GET /hostadmin error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch host admins" });
  }
});

// ── 2. GET /api/hostadmin/me  ──────────────────────────────────────────────
// PROTECTED — host admin gets their own profile
// ✅ MUST be registered before GET /:id
// "me" is not a valid ObjectId so /:id would return 404 if it runs first
router.get("/me", requireAuth, async (req, res) => {
  try {
    console.log(`📍 GET /hostadmin/me — user: ${req.user.email}, _id: ${req.user._id}`);

    const hostAdmin = await HostAdmin.findById(req.user._id)
      .select("-password -otp -otpExpiry")
      .lean();

    if (!hostAdmin) {
      // ✅ Fallback: build a profile from the JWT claims so the dashboard
      //    still renders even if the HostAdmin document is missing
      console.warn(`⚠️ HostAdmin doc not found for _id: ${req.user._id} — using JWT data`);
      return res.json({
        success: true,
        data: {
          _id:        req.user._id,
          name:       req.user.name  || req.user.email,
          email:      req.user.email,
          role:       req.user.role,
          department: req.user.department || "N/A",
          company:    req.user.company    || "N/A",
        },
      });
    }

    console.log(`✅ GET /hostadmin/me — found: ${hostAdmin._id}`);
    res.json({ success: true, data: hostAdmin });
  } catch (err) {
    console.error("❌ GET /hostadmin/me error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch host admin profile", error: err.message });
  }
});

// ── 3. POST /api/hostadmin  ────────────────────────────────────────────────
// PROTECTED — superadmin creates a host admin
const _recentCreations = new Map();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, email, phone, company, department, password } = req.body;

    if (!name)    return res.status(400).json({ success: false, message: "Name is required",    field: "name" });
    if (!email)   return res.status(400).json({ success: false, message: "Email is required",   field: "email" });
    if (!phone)   return res.status(400).json({ success: false, message: "Phone is required",   field: "phone" });
    if (!company) return res.status(400).json({ success: false, message: "Company is required", field: "company" });

    const emailLower = email.toLowerCase().trim();

    // Dedup window — same email within 5s returns the existing record (handles rapid duplicate POSTs)
    const lastCreation = _recentCreations.get(emailLower);
    if (lastCreation && Date.now() - lastCreation < 5000) {
      const existing = await HostAdmin.findOne({ email: emailLower }).select("-password -otp -otpExpiry");
      if (existing) {
        console.log(`⚠️ Duplicate POST within 5s for ${emailLower} — returning existing`);
        return res.status(201).json({ success: true, message: "Host admin created successfully", data: existing });
      }
    }

    // Check if already exists in HostAdmin collection
    const existingHost = await HostAdmin.findOne({ email: emailLower }).select("-password -otp -otpExpiry");
    if (existingHost) {
      // Return 409 with the existing record data so frontend can show a meaningful message
      return res.status(409).json({
        success: false,
        message: `A host admin with email "${emailLower}" already exists`,
        field: "email",
        existing: {
          _id: existingHost._id,
          name: existingHost.name,
          email: existingHost.email,
        },
      });
    }

    const hostAdmin = new HostAdmin({
      name:       name.trim(),
      email:      emailLower,
      phone:      phone.trim(),
      company:    company.trim(),
      department: department ? department.trim() : "N/A",
      password:   password || undefined,
      role:       "hostadmin",
      active:     true,
    });

    await hostAdmin.save();

    _recentCreations.set(emailLower, Date.now());
    setTimeout(() => _recentCreations.delete(emailLower), 10000);

    console.log(`✅ Host admin created: ${hostAdmin._id}`);

    res.status(201).json({
      success: true,
      message: "Host admin created successfully",
      data: {
        _id:        hostAdmin._id,
        name:       hostAdmin.name,
        email:      hostAdmin.email,
        phone:      hostAdmin.phone,
        company:    hostAdmin.company,
        department: hostAdmin.department,
        role:       hostAdmin.role,
        active:     hostAdmin.active,
      },
    });
  } catch (err) {
    console.error("❌ POST /hostadmin error:", err.message);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists", field: "email" });
    }
    res.status(500).json({ success: false, message: "Failed to create host admin", error: err.message });
  }
});

// ── 4. PUT /api/hostadmin/:id  ─────────────────────────────────────────────
// PROTECTED — update a host admin
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name, phone, company, department } = req.body;

    const hostAdmin = await HostAdmin.findByIdAndUpdate(
      req.params.id,
      { name, phone, company, department },
      { new: true, runValidators: true }
    ).select("-password -otp -otpExpiry");

    if (!hostAdmin) {
      return res.status(404).json({ success: false, message: "Host admin not found" });
    }

    console.log(`✅ Host admin updated: ${hostAdmin._id}`);
    res.json({ success: true, message: "Host admin updated successfully", data: hostAdmin });
  } catch (err) {
    console.error("❌ PUT /hostadmin/:id error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update host admin", error: err.message });
  }
});

// ── 5. DELETE /api/hostadmin/:id  ─────────────────────────────────────────
// PROTECTED — delete a host admin
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const hostAdmin = await HostAdmin.findByIdAndDelete(req.params.id);

    if (!hostAdmin) {
      return res.status(404).json({ success: false, message: "Host admin not found" });
    }

    console.log(`✅ Host admin deleted: ${hostAdmin._id}`);
    res.json({ success: true, message: "Host admin deleted successfully" });
  } catch (err) {
    console.error("❌ DELETE /hostadmin/:id error:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete host admin", error: err.message });
  }
});

// ── 6. GET /api/hostadmin/:id  ─────────────────────────────────────────────
// PROTECTED — get single host admin by MongoDB ID
// ✅ MUST be LAST — catches everything not matched above
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid host admin ID format" });
    }

    const hostAdmin = await HostAdmin.findById(id)
      .select("-password -otp -otpExpiry")
      .lean();

    if (!hostAdmin) {
      return res.status(404).json({ success: false, message: "Host admin not found" });
    }

    console.log(`✅ GET /hostadmin/${id} — found`);
    res.json({ success: true, data: hostAdmin });
  } catch (err) {
    console.error("❌ GET /hostadmin/:id error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch host admin", error: err.message });
  }
});

export default router;