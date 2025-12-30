import Visitor from "../models/Visitor.js";

/* ==============================
   GET ALL VISITORS
============================== */
export const getVisitors = async (req, res) => {
  try {
    const visitors = await Visitor.find().sort({ createdAt: -1 });
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ==============================
   SCAN & CHECK-IN (SECURITY)
   QR = visitorId
============================== */
export const scanVisitor = async (req, res) => {
  try {
    const { qr } = req.body;

    if (!qr) {
      return res.status(400).json({ message: "QR data is required" });
    }

    const visitor = await Visitor.findById(qr);

    if (!visitor) {
      return res.status(400).json({ message: "Invalid QR code" });
    }

    if (visitor.status !== "APPROVED") {
      return res
        .status(400)
        .json({ message: `Visitor already ${visitor.status}` });
    }

    visitor.status = "IN";
    visitor.checkInTime = new Date();
    await visitor.save();

    res.json({
      message: "Visitor checked in successfully",
      visitor,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ==============================
   CHECK-OUT (SECURITY / RECEPTION)
============================== */
export const checkOutVisitor = async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);

    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    if (visitor.status !== "IN") {
      return res
        .status(400)
        .json({ message: "Visitor is not checked in" });
    }

    visitor.status = "OUT";
    visitor.checkOutTime = new Date();
    await visitor.save();

    res.json({
      message: "Visitor checked out successfully",
      visitor,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

