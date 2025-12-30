import crypto from "crypto";
import Visitor from "../models/Visitor.js";
import { sendApprovalMail } from "../utils/mailer.js";

export const createVisitor = async (req, res) => {
  try {
    const approvalToken = crypto.randomBytes(32).toString("hex");

    const visitor = await Visitor.create({
      ...req.body,
      visitorId: `VIS-${Date.now()}`,
      approvalToken,
      approvalExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      status: "PENDING",
    });

    // 📩 Send approval mail to HOST
    await sendApprovalMail(visitor);

    res.json({
      success: true,
      message: "Visitor request sent for approval",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};