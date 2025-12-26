import express from "express";
import Visitor from "../models/Visitor.js";

const router = express.Router();

router.post("/incoming", async (req, res) => {
  const msg = req.body.Body?.trim().toUpperCase();
  const [action, visitorId] = msg.split(" ");

  if (!["YES", "NO"].includes(action) || !visitorId) {
    return res.send("Invalid response");
  }

  const visitor = await Visitor.findOne({ visitorId });
  if (!visitor) return res.send("Visitor not found");

  visitor.status = action === "YES" ? "APPROVED" : "REJECTED";
  await visitor.save();

  req.io.emit("VISITOR_APPROVAL", visitor);

  res.send("Decision recorded");
});

export default router;

