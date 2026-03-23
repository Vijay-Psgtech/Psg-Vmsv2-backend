/**
 * ═══════════════════════════════════════════════════════
 * VISITOR ID ROUTES - PRODUCTION READY
 * ═══════════════════════════════════════════════════════
 */

import express from "express";
import { body, validationResult } from "express-validator";
import Visitor from "../models/Visitor.js";

const router = express.Router();

/**
 * Generate secure visitor ID
 * Format: VST-YYYYMMDD-XXXX
 */
const generateVisitorId = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);

  return `VST-${date}-${random}`;
};

/**
 * POST /api/visitor/generate
 * Generate new visitor ID
 */
router.post(
  "/generate",

  [
    body("name")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Invalid visitor name"),

    body("phone")
      .optional()
      .isMobilePhone("any")
      .withMessage("Invalid phone number"),
  ],

  async (req, res) => {
    try {
      /* Validate request */
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      /* Ensure unique visitor ID */
      let visitorId;
      let exists = true;

      while (exists) {
        visitorId = generateVisitorId();

        const found = await Visitor.findOne({ visitorId });

        if (!found) exists = false;
      }

      return res.status(200).json({
        success: true,
        visitorId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Visitor ID generation error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to generate visitor ID",
      });
    }
  }
);

export default router;