import express from "express";
import Visitor from "../models/Visitor.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/* ================= DAILY REPORT ================= */
router.get(
  "/daily",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const data = await Visitor.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data.map(d => ({ date: d._id, count: d.count })));
  }
);

/* ================= CSV EXPORT ================= */
router.get(
  "/csv",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const visitors = await Visitor.find().lean();

    const headers = "Visitor ID,Name,Phone,Host,Status,CheckIn,CheckOut\n";
    const rows = visitors
      .map(v =>
        `${v.visitorId},${v.name},${v.phone},${v.host},${v.status},${v.checkInTime || ""},${v.checkOutTime || ""}`
      )
      .join("\n");

    res.header("Content-Type", "text/csv");
    res.attachment("visitors.csv");
    res.send(headers + rows);
  }
);

export default router;


