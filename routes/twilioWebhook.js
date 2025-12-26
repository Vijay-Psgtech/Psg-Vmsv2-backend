import express from "express";
import Visitor from "../models/Visitor.js";

const router = express.Router();

router.post("/twilio", async (req, res) => {
  const body = req.body.Body?.trim();
  if (!body) return res.sendStatus(200);

  const [action, visitorId] = body.split(" ");

  const visitor = await Visitor.findOne({ visitorId });
  if (!visitor) return res.sendStatus(200);

  if (action === "YES") visitor.status = "APPROVED";
  if (action === "NO") visitor.status = "REJECTED";

  await visitor.save();

  req.io.emit("VISITOR_APPROVAL", visitor);

  res.send("<Response></Response>");
});

export default router;
