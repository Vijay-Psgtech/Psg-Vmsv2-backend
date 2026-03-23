/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURITY ROUTES - Complete Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ GET /api/security - List all security personnel
 * ✅ POST /api/security - Create security personnel
 * ✅ GET /api/security/:id - Get single security
 * ✅ PUT /api/security/:id - Update security
 * ✅ DELETE /api/security/:id - Delete security
 * ═══════════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import User from '../models/User.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/security
// List all security personnel
// ═══════════════════════════════════════════════════════════════════════════

router.get('/', async (req, res) => {
  try {
    const security = await User.find({ role: 'security' })
      .select('-password -otp -otpExpiry')
      .sort({ createdAt: -1 });

    console.log(`✅ [Security Routes] Found ${security.length} security personnel`);

    res.json({
      success: true,
      data: security,
      total: security.length,
    });
  } catch (error) {
    console.error('❌ [Security Routes] Get all error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security personnel',
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/security
// Create new security personnel (SuperAdmin only)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      department,
      badge,
      shift = 'DAY',
      password = 'TempPassword@123',
    } = req.body;

    // Validation
    if (!name?.trim() || !email?.trim() || !badge?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and badge are required',
      });
    }

    if (!['DAY', 'NIGHT', 'FLEXIBLE'].includes(shift)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shift. Must be DAY, NIGHT, or FLEXIBLE',
      });
    }

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Check duplicate badge
    const existingBadge = await User.findOne({ badge });
    if (existingBadge) {
      return res.status(409).json({
        success: false,
        message: 'Badge ID already in use',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const security = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      password: hashedPassword,
      role: 'security',
      department: department?.trim() || 'Security',
      badge: badge.trim(),
      shift,
      status: 'ACTIVE',
      isVerified: true, // Admin-created users are pre-verified
    });

    await security.save();

    console.log(`✅ [Security Routes] Security personnel created: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Security personnel created successfully',
      data: {
        _id: security._id,
        name: security.name,
        email: security.email,
        phone: security.phone,
        badge: security.badge,
        shift: security.shift,
        department: security.department,
        status: security.status,
        createdAt: security.createdAt,
      },
    });
  } catch (error) {
    console.error('❌ [Security Routes] Create error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create security personnel',
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/security/:id
// Get single security personnel
// ═══════════════════════════════════════════════════════════════════════════

router.get('/:id', async (req, res) => {
  try {
    const security = await User.findById(req.params.id)
      .select('-password -otp -otpExpiry');

    if (!security || security.role !== 'security') {
      return res.status(404).json({
        success: false,
        message: 'Security personnel not found',
      });
    }

    res.json({
      success: true,
      data: security,
    });
  } catch (error) {
    console.error('❌ [Security Routes] Get single error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security personnel',
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/security/:id
// Update security personnel (SuperAdmin only)
// ═══════════════════════════════════════════════════════════════════════════

router.put('/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { name, email, phone, department, badge, shift, status } = req.body;

    const security = await User.findById(req.params.id);
    if (!security || security.role !== 'security') {
      return res.status(404).json({
        success: false,
        message: 'Security personnel not found',
      });
    }

    // Check email collision if email is being changed
    if (email && email.toLowerCase().trim() !== security.email) {
      const existing = await User.findOne({
        email: email.toLowerCase().trim(),
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use',
        });
      }
      security.email = email.toLowerCase().trim();
    }

    // Check badge collision if badge is being changed
    if (badge && badge !== security.badge) {
      const existingBadge = await User.findOne({ badge });
      if (existingBadge) {
        return res.status(409).json({
          success: false,
          message: 'Badge ID already in use',
        });
      }
      security.badge = badge;
    }

    if (name?.trim()) security.name = name.trim();
    if (phone !== undefined) security.phone = phone?.trim() || '';
    if (department?.trim()) security.department = department.trim();
    if (shift && ['DAY', 'NIGHT', 'FLEXIBLE'].includes(shift)) {
      security.shift = shift;
    }
    if (status && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      security.status = status;
    }

    await security.save();

    console.log(`✅ [Security Routes] Security updated: ${security.email}`);

    res.json({
      success: true,
      message: 'Security personnel updated successfully',
      data: {
        _id: security._id,
        name: security.name,
        email: security.email,
        phone: security.phone,
        badge: security.badge,
        shift: security.shift,
        department: security.department,
        status: security.status,
        createdAt: security.createdAt,
      },
    });
  } catch (error) {
    console.error('❌ [Security Routes] Update error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update security personnel',
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/security/:id
// Delete security personnel (SuperAdmin only)
// ═══════════════════════════════════════════════════════════════════════════

router.delete('/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const security = await User.findById(req.params.id);
    if (!security || security.role !== 'security') {
      return res.status(404).json({
        success: false,
        message: 'Security personnel not found',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    console.log(`✅ [Security Routes] Security deleted: ${security.email}`);

    res.json({
      success: true,
      message: 'Security personnel deleted successfully',
    });
  } catch (error) {
    console.error('❌ [Security Routes] Delete error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete security personnel',
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/security/:id/toggle-status
// Toggle security active/inactive
// ═══════════════════════════════════════════════════════════════════════════

router.patch('/:id/toggle-status', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { status } = req.body;

    const security = await User.findById(req.params.id);
    if (!security || security.role !== 'security') {
      return res.status(404).json({
        success: false,
        message: 'Security personnel not found',
      });
    }

    if (status && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      security.status = status;
    } else {
      security.status = security.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    await security.save();

    console.log(`✅ [Security Routes] Status toggled: ${security.email} → ${security.status}`);

    res.json({
      success: true,
      message: `Security ${security.status.toLowerCase()} successfully`,
      data: {
        _id: security._id,
        status: security.status,
      },
    });
  } catch (error) {
    console.error('❌ [Security Routes] Toggle status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle security status',
      error: error.message,
    });
  }
});

export default router;