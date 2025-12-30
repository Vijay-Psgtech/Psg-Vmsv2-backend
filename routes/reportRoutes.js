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

router.get("/overstay", requireAuth, requireRole("admin"), async (req, res) => {
  const data = await Visitor.aggregate([
    {
      $match: {
        status: "IN",
        allowedUntil: { $lt: new Date() },
      },
    },
    {
      $project: {
        name: 1,
        gate: 1,
        host: 1,
        overstayMinutes: {
          $divide: [
            { $subtract: [new Date(), "$allowedUntil"] },
            60000,
          ],
        },
      },
    },
  ]);

  res.json(data);
});


export default router;