/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISITOR ID GENERATION UTILITY (FIXED)
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Changed from CommonJS to ES6 modules
 * ✅ Proper exports for visitor ID generation
 */

import express from "express";
import Visitor from "../models/Visitor.js";

const router = express.Router();

/**
 * Generate a unique visitor ID
 * Format: VST-YYYYMMDD-XXXX (where XXXX is random 4-digit number)
 */
function generateVisitorId() {
  const dt = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VST-${dt}-${rand}`;
}

/**
 * POST /api/security/generate-visitor-id
 * Generate a new unique visitor ID
 */
router.post("/generate", async (req, res) => {
  try {
    let id = generateVisitorId();

    // Ensure it's unique by checking database
    let exists = await Visitor.findOne({ visitorId: id });
    let attempts = 0;
    while (exists && attempts < 5) {
      id = generateVisitorId();
      exists = await Visitor.findOne({ visitorId: id });
      attempts++;
    }

    if (exists) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate unique visitor ID",
      });
    }

    console.log(`✅ Generated visitor ID: ${id}`);

    res.json({
      success: true,
      visitorId: id,
    });
  } catch (err) {
    console.error("❌ Generate visitor ID error:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to generate visitor ID",
      message: err.message,
    });
  }
});

export default router;
