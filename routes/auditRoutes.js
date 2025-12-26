import express from "express";
import AuditLog from "../models/AuditLog.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Parser } from "json2csv";

const router = express.Router();

/* =========================================================
   GET AUDIT LOGS (FILTERABLE)
   GET /api/audit
========================================================= */
router.get(
  "/",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { from, to, action, role } = req.query;

      const filter = {};
      if (action) filter.action = action;
      if (role) filter.actorRole = role;

      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }

      const logs = await AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(500);

      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Audit fetch failed" });
    }
  }
);

/* =========================================================
   EXPORT AUDIT CSV
   GET /api/audit/csv
========================================================= */
router.get(
  "/csv",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(1000);

      const parser = new Parser({
        fields: [
          "createdAt",
          "actorRole",
          "action",
          "entity",
          "entityId",
          "ip",
        ],
      });

      const csv = parser.parse(logs);

      res.header("Content-Type", "text/csv");
      res.attachment("audit_logs.csv");
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: "CSV export failed" });
    }
  }
);

export default router;


