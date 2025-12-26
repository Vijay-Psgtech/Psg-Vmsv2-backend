import express from "express";
import QRCode from "qrcode";
import Visitor from "../models/Visitor.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get("/:id", auth, async (req, res) => {
  const visitor = await Visitor.findById(req.params.id);
  if (!visitor) return res.status(404).json({ message: "Not found" });

  const qr = await QRCode.toDataURL(
    JSON.stringify({
      id: visitor._id,
      name: visitor.name,
    })
  );

  res.json({ qr });
});

export default router;
